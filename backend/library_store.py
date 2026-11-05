"""Biblioteca central: manifesto atômico no PostgreSQL e áudios imutáveis por hash."""

import hashlib
import os
import re
import tempfile
from pathlib import Path
from typing import BinaryIO

from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool

from backend.library_models import MAX_AUDIO_BYTES, LibraryManifest, empty_library
from backend.media import _duration

AUDIO_ID = re.compile(r"^[a-f0-9]{64}$")


class LibraryConflict(Exception):
    pass


class LibraryStore:
    def __init__(self, database_url: str, data_dir: Path):
        self.audio_dir = data_dir / "audio"
        self.staging_dir = data_dir / "staging"
        for directory in [data_dir, self.audio_dir, self.staging_dir]:
            directory.mkdir(mode=0o700, parents=True, exist_ok=True)
            directory.chmod(0o700)
        self.pool = ConnectionPool(
            database_url,
            min_size=1,
            max_size=4,
            open=False,
            timeout=5,
            kwargs={"row_factory": dict_row, "connect_timeout": 5},
        )
        try:
            self.pool.open(wait=True, timeout=5)
            with self.pool.connection() as connection:
                connection.execute("select pg_advisory_xact_lock(83530717)")
                connection.execute("""
                    create table if not exists soundbard_library (
                        singleton boolean primary key default true check (singleton),
                        revision bigint not null check (revision >= 0),
                        manifest jsonb not null check (jsonb_typeof(manifest) = 'object'),
                        updated_at timestamptz not null default now(),
                        check ((manifest ->> 'revision')::bigint = revision)
                    )
                """)
                connection.execute(
                    "insert into soundbard_library (revision, manifest) values (0, %s) "
                    "on conflict (singleton) do nothing",
                    [Jsonb(empty_library())],
                )
        except BaseException:
            self.pool.close()
            raise

    def close(self):
        self.pool.close()

    def read(self):
        with self.pool.connection() as connection:
            return connection.execute(
                "select manifest from soundbard_library where singleton"
            ).fetchone()["manifest"]

    def commit(self, manifest: LibraryManifest, uploads: dict[str, BinaryIO]):
        sounds = {sound.id: sound for sound in manifest.sounds}
        if any(identifier not in sounds for identifier in uploads):
            raise ValueError("Há arquivos sem referência na biblioteca.")
        with tempfile.TemporaryDirectory(dir=self.staging_dir) as temporary:
            staged = {}
            for identifier, source in uploads.items():
                if not AUDIO_ID.fullmatch(identifier):
                    raise ValueError("Identificador de áudio inválido.")
                target = Path(temporary) / identifier
                digest = hashlib.sha256()
                size = 0
                source.seek(0)
                with target.open("xb") as destination:
                    target.chmod(0o600)
                    while chunk := source.read(1024 * 1024):
                        size += len(chunk)
                        if size > MAX_AUDIO_BYTES:
                            raise ValueError("O áudio deve ter no máximo 256 MB.")
                        digest.update(chunk)
                        destination.write(chunk)
                    destination.flush()
                    os.fsync(destination.fileno())
                if size != sounds[identifier].size or digest.hexdigest() != identifier:
                    raise ValueError("O áudio não corresponde ao tamanho e hash informados.")
                mime = sounds[identifier].mime
                if "ogg" in mime:
                    formats = "ogg"
                elif "wav" in mime:
                    formats = "wav"
                else:
                    formats = "mp3"
                _duration(target, formats=formats)
                staged[identifier] = target
            with self.pool.connection() as connection:
                row = connection.execute(
                    "select revision from soundbard_library where singleton for update"
                ).fetchone()
                if row["revision"] != manifest.revision:
                    raise LibraryConflict("A biblioteca mudou em outro dispositivo. Recarregue-a.")
                for sound in manifest.sounds:
                    file = staged.get(sound.id, self.audio_dir / sound.id)
                    if not file.is_file() or file.stat().st_size != sound.size:
                        raise ValueError("Há áudio ausente ou incompleto na biblioteca.")
                for identifier, file in staged.items():
                    os.replace(file, self.audio_dir / identifier)
                saved = manifest.model_dump(by_alias=True, exclude_none=True)
                # playlistId pode ser null: faz parte do contrato versionado da biblioteca.
                for scene, original in zip(saved["scenes"], manifest.scenes, strict=True):
                    scene["playlistId"] = original.playlist_id
                saved["revision"] += 1
                connection.execute(
                    "update soundbard_library set revision = %s, manifest = %s, "
                    "updated_at = now() where singleton",
                    [saved["revision"], Jsonb(saved)],
                )
            # Retemos hashes não referenciados: removê-los aqui pode competir com outro cliente.
            # Uma coleta explícita deve coordenar uploads e commits antes de liberar disco.
            return saved

    def file(self, identifier: str):
        if not AUDIO_ID.fullmatch(identifier):
            raise LookupError("Áudio não encontrado.")
        manifest = self.read()
        sound = next((item for item in manifest["sounds"] if item["id"] == identifier), None)
        file = self.audio_dir / identifier
        if sound is None or not file.is_file() or file.stat().st_size != sound["size"]:
            raise LookupError("Áudio não encontrado.")
        return file, sound["mime"]
