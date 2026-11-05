import copy
import hashlib
import io
import os
import subprocess
import uuid
import wave
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient

from backend.app import create_app


@pytest.fixture(scope="session")
def library_database():
    configured = os.environ.get("SOUNDBARD_TEST_DATABASE_URL")
    if configured:
        yield configured
        return
    subprocess.run(["docker", "compose", "up", "-d", "--wait", "postgres-test"], check=True)
    try:
        address = subprocess.check_output(
            ["docker", "compose", "port", "postgres-test", "5432"], text=True
        ).strip()
        port = address.rsplit(":", 1)[1]
        yield f"postgresql://soundbard_test:soundbard_test@127.0.0.1:{port}/soundbard_test"
    finally:
        subprocess.run(["docker", "compose", "rm", "-s", "-f", "postgres-test"], check=True)


@pytest.fixture
def configured_library(library_database, tmp_path):
    import psycopg
    from psycopg import sql
    from psycopg.conninfo import make_conninfo

    schema = f"test_{uuid.uuid4().hex}"
    with psycopg.connect(library_database, autocommit=True) as connection:
        connection.execute(sql.SQL("create schema {}").format(sql.Identifier(schema)))
    database_url = make_conninfo(library_database, options=f"-c search_path={schema}")
    try:
        yield database_url, tmp_path
    finally:
        with psycopg.connect(library_database, autocommit=True) as connection:
            connection.execute(sql.SQL("drop schema {} cascade").format(sql.Identifier(schema)))


def audio():
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as target:
        target.setnchannels(1)
        target.setsampwidth(2)
        target.setframerate(8000)
        target.writeframes(b"\0\0" * 8000)
    content = buffer.getvalue()
    sound = {
        "id": hashlib.sha256(content).hexdigest(),
        "name": "Chuva",
        "kind": "ambience",
        "duration": 1,
        "size": len(content),
        "mime": "audio/wav",
        "volume": 0.75,
        "loop": True,
        "tags": ["Clima"],
    }
    return sound, content


def app(configured_library):
    database_url, directory = configured_library
    return create_app(database_url=database_url, data_dir=directory)


def save(client, library, files=()):
    import json

    return client.put(
        "/api/library",
        data={"library": json.dumps(library)},
        files=[("files", (sound["id"], content, sound["mime"])) for sound, content in files],
    )


def test_two_clients_read_the_same_library_and_audio_after_restart(configured_library):
    sound, content = audio()
    with TestClient(app(configured_library), base_url="http://127.0.0.1:3000") as first:
        library = first.get("/api/library").json()
        assert library["revision"] == 0
        assert library["sounds"] == []
        library["sounds"] = [sound]
        response = save(first, library, [(sound, content)])
        assert response.status_code == 200
        assert response.json()["revision"] == 1
    with TestClient(app(configured_library), base_url="http://127.0.0.1:3000") as second:
        assert second.get("/api/library").json() == response.json()
        file = second.get(f"/api/library/files/{sound['id']}")
        assert file.status_code == 200
        assert file.content == content
        assert file.headers["content-type"] == "audio/wav"
        assert file.headers["x-content-type-options"] == "nosniff"


def test_stale_revision_cannot_overwrite_another_client(configured_library):
    with TestClient(app(configured_library), base_url="http://127.0.0.1:3000") as client:
        original = client.get("/api/library").json()
        first = copy.deepcopy(original)
        first["master"] = 0.5
        saved = save(client, first)
        assert saved.status_code == 200
        stale = copy.deepcopy(original)
        stale["master"] = 0.2
        assert save(client, stale).status_code == 409
        assert client.get("/api/library").json() == saved.json()


def test_concurrent_clients_allow_only_one_commit_for_a_revision(configured_library):
    with TestClient(app(configured_library), base_url="http://127.0.0.1:3000") as client:
        original = client.get("/api/library").json()
        with ThreadPoolExecutor(max_workers=2) as executor:
            responses = list(executor.map(lambda _: save(client, original), range(2)))
        assert sorted(response.status_code for response in responses) == [200, 409]
        assert client.get("/api/library").json()["revision"] == 1


@pytest.mark.parametrize("failure", ["hash", "size", "missing"])
def test_invalid_files_do_not_change_saved_library(configured_library, failure):
    sound, content = audio()
    with TestClient(app(configured_library), base_url="http://127.0.0.1:3000") as client:
        original = client.get("/api/library").json()
        changed = copy.deepcopy(original)
        changed["sounds"] = [sound]
        uploads = [(sound, content)]
        if failure == "hash":
            uploads = [(sound, content + b"broken")]
        elif failure == "size":
            sound["size"] += 1
        else:
            uploads = []
        response = save(client, changed, uploads)
        assert response.status_code == 422
        assert client.get("/api/library").json() == original
        assert client.get(f"/api/library/files/{sound['id']}").status_code == 404


@pytest.mark.parametrize("failure", ["duplicate", "missing_reference", "wrong_kind", "volume"])
def test_invalid_manifest_preserves_the_previous_library(configured_library, failure):
    sound, content = audio()
    with TestClient(app(configured_library), base_url="http://127.0.0.1:3000") as client:
        original = client.get("/api/library").json()
        changed = copy.deepcopy(original)
        changed["sounds"] = [sound]
        if failure == "duplicate":
            changed["sounds"].append(copy.deepcopy(sound))
        elif failure == "missing_reference":
            changed["scenes"] = [
                {
                    "id": "scene",
                    "name": "Cena",
                    "playlistId": "missing",
                    "layers": [],
                    "effectIds": [],
                    "musicVolume": 0.5,
                }
            ]
        elif failure == "wrong_kind":
            changed["playlists"] = [
                {
                    "id": "playlist",
                    "name": "Lista",
                    "soundIds": [sound["id"]],
                    "shuffle": False,
                    "repeat": "off",
                }
            ]
        else:
            sound["volume"] = 2
        assert save(client, changed, [(sound, content)]).status_code == 422
        assert client.get("/api/library").json() == original


def test_referenced_audio_cannot_be_replaced_with_different_bytes(configured_library):
    sound, content = audio()
    with TestClient(app(configured_library), base_url="http://127.0.0.1:3000") as client:
        library = client.get("/api/library").json()
        library["sounds"] = [sound]
        saved = save(client, library, [(sound, content)]).json()
        assert save(client, saved, [(sound, b"tampered")]).status_code == 422
        assert client.get(f"/api/library/files/{sound['id']}").content == content
        assert client.get("/api/library").json() == saved


def test_file_endpoint_rejects_unknown_hash_and_traversal(configured_library):
    with TestClient(app(configured_library), base_url="http://127.0.0.1:3000") as client:
        assert client.get(f"/api/library/files/{'a' * 64}").status_code == 404
        assert client.get("/api/library/files/%2e%2e%2fprivate").status_code == 404
        assert client.get("/api/library/files/not-a-hash").status_code == 404


def test_pad_groups_are_shared_and_missing_members_are_removed(configured_library):
    sound, content = audio()
    with TestClient(app(configured_library), base_url="http://127.0.0.1:3000") as client:
        library = client.get("/api/library").json()
        library["sounds"] = [sound]
        library["padGroups"] = [
            {
                "id": "group",
                "name": "Ambientes",
                "padIds": [sound["id"], "missing"],
            }
        ]
        response = save(client, library, [(sound, content)])
        assert response.status_code == 200
        assert response.json()["padGroups"] == [
            {
                "id": "group",
                "name": "Ambientes",
                "padIds": [sound["id"]],
            }
        ]
        removed = response.json()
        removed["sounds"] = []
        saved = save(client, removed)
        assert saved.status_code == 200
        assert saved.json()["padGroups"] == [
            {
                "id": "group",
                "name": "Ambientes",
                "padIds": [],
            }
        ]


def test_valid_hash_does_not_allow_non_audio_content(configured_library):
    sound, _ = audio()
    content = b"not an audio file"
    sound["id"] = hashlib.sha256(content).hexdigest()
    sound["size"] = len(content)
    with TestClient(app(configured_library), base_url="http://127.0.0.1:3000") as client:
        original = client.get("/api/library").json()
        changed = copy.deepcopy(original)
        changed["sounds"] = [sound]
        assert save(client, changed, [(sound, content)]).status_code == 422
        assert client.get("/api/library").json() == original


def test_audio_container_must_match_manifest_type(configured_library):
    sound, content = audio()
    sound["mime"] = "audio/mpeg"
    with TestClient(app(configured_library), base_url="http://127.0.0.1:3000") as client:
        original = client.get("/api/library").json()
        changed = copy.deepcopy(original)
        changed["sounds"] = [sound]
        assert save(client, changed, [(sound, content)]).status_code == 422
        assert client.get("/api/library").json() == original


def test_library_version_must_be_integer_one(configured_library):
    with TestClient(app(configured_library), base_url="http://127.0.0.1:3000") as client:
        original = client.get("/api/library").json()
        changed = copy.deepcopy(original)
        changed["version"] = True
        assert save(client, changed).status_code == 422
        assert client.get("/api/library").json() == original


def test_pad_order_survives_restart_without_changing_playlist_order(configured_library):
    sound, content = audio()
    sound["kind"] = "music"
    with TestClient(app(configured_library), base_url="http://127.0.0.1:3000") as client:
        library = client.get("/api/library").json()
        library["sounds"] = [sound]
        library["playlists"] = [
            {
                "id": "music",
                "name": "Músicas",
                "soundIds": [sound["id"]],
                "shuffle": False,
                "repeat": "off",
            }
        ]
        library["padOrder"] = [sound["id"], "playlist:music"]
        saved = save(client, library, [(sound, content)])
        assert saved.status_code == 200
        library = saved.json()
        library["padOrder"] = ["playlist:music", sound["id"]]
        ordered = save(client, library)
        assert ordered.status_code == 200
        assert ordered.json()["revision"] == 2
        assert save(client, library).status_code == 409
    with TestClient(app(configured_library), base_url="http://127.0.0.1:3000") as other:
        persisted = other.get("/api/library").json()
        assert persisted["padOrder"] == ["playlist:music", sound["id"]]
        assert persisted["playlists"][0]["soundIds"] == [sound["id"]]


@pytest.mark.parametrize(
    "order", [["missing"], ["playlist:missing"], ["playlist:music", "playlist:music"], [42]]
)
def test_invalid_pad_order_does_not_change_the_library(configured_library, order):
    with TestClient(app(configured_library), base_url="http://127.0.0.1:3000") as client:
        original = client.get("/api/library").json()
        changed = copy.deepcopy(original)
        changed["playlists"] = [
            {"id": "music", "name": "Músicas", "soundIds": [], "shuffle": False, "repeat": "off"}
        ]
        changed["padOrder"] = order
        assert save(client, changed).status_code == 422
        assert client.get("/api/library").json() == original
