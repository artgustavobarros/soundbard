"""Local audio jobs; library files remain owned by the browser."""

import json
import math
import re
import shutil
import subprocess
import threading
import time
import uuid
from concurrent.futures import Future, ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlsplit

import yt_dlp


class _MediaError(ValueError):
    """A validated, user-facing error without internal extractor details."""


def normalize_youtube_url(url: str) -> str:
    """Accept a video link, discard playlist/tracking parameters, and fix its host."""
    try:
        parsed = urlsplit(url.strip())
        host = parsed.hostname
        if (
            parsed.scheme != "https"
            or parsed.port is not None
            or parsed.username is not None
            or parsed.password is not None
        ):
            raise _MediaError
        if host in {"youtu.be", "www.youtu.be"}:
            video_id = parsed.path.removeprefix("/")
        elif host in {"youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com"}:
            if parsed.path == "/watch":
                values = parse_qs(parsed.query).get("v", [])
                if len(values) != 1:
                    raise _MediaError
                video_id = values[0]
            else:
                match = re.fullmatch(r"/(?:shorts|live|embed)/([A-Za-z0-9_-]{11})/?", parsed.path)
                if not match:
                    raise _MediaError
                video_id = match.group(1)
        else:
            raise _MediaError
        if not re.fullmatch(r"[A-Za-z0-9_-]{11}", video_id):
            raise _MediaError
    except (AttributeError, TypeError, ValueError) as error:
        raise _MediaError(
            "Use um link HTTPS de um vídeo do YouTube, não de uma playlist."
        ) from error
    return f"https://www.youtube.com/watch?v={video_id}"


MAX_UPLOAD_BYTES = 256 * 1024 * 1024
MAX_DOWNLOAD_BYTES = 512 * 1024 * 1024
MAX_DURATION = 8 * 60 * 60
JOB_TTL_SECONDS = 60 * 60
AUDIO_FORMATS = "mp3,wav,ogg,mov,mp4,m4a,3gp,3g2,mj2,matroska,webm,aac,flac"
DURATION_PATTERN = re.compile(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)")


def ffmpeg_path() -> str:
    executable = shutil.which("ffmpeg")
    if executable:
        return executable
    import imageio_ffmpeg

    return imageio_ffmpeg.get_ffmpeg_exe()


def _range(start: float, end: float | None, duration: float | None = None) -> None:
    if not math.isfinite(start) or start < 0:
        raise _MediaError("O início deve ser um número positivo ou zero.")
    if end is not None and (not math.isfinite(end) or end <= start):
        raise _MediaError("O fim deve ser maior que o início.")
    if duration is not None and (start >= duration or (end is not None and end > duration + 0.05)):
        raise _MediaError("O intervalo ultrapassa a duração do áudio.")


def _filename(name: str) -> str:
    clean = " ".join(name.replace("/", " ").replace("\\", " ").split()).strip(". ")[:180]
    return f"{clean or 'Trecho'}.mp3"


def _duration(path: Path) -> float:
    command = [
        ffmpeg_path(),
        "-nostdin",
        "-hide_banner",
        "-protocol_whitelist",
        "file,pipe",
        "-format_whitelist",
        AUDIO_FORMATS,
        "-i",
        str(path),
        "-t",
        "0",
        "-f",
        "null",
        "-",
    ]
    try:
        result = subprocess.run(command, capture_output=True, text=True, timeout=20, check=False)
    except (OSError, subprocess.TimeoutExpired) as error:
        raise _MediaError(
            "Não foi possível ler o áudio. Use um arquivo MP3, WAV ou OGG válido."
        ) from error
    found = DURATION_PATTERN.search(result.stderr)
    if result.returncode != 0 or found is None:
        raise _MediaError("Não foi possível ler o áudio. Use um arquivo MP3, WAV ou OGG válido.")
    duration = int(found[1]) * 3600 + int(found[2]) * 60 + float(found[3])
    if not 0 < duration <= MAX_DURATION:
        raise _MediaError("Use um áudio com duração entre zero e oito horas.")
    return duration


def _metadata(info: Any, url: str) -> dict[str, Any]:
    if not isinstance(info, dict) or info.get("_type") in {"playlist", "multi_video"}:
        raise _MediaError("Escolha um vídeo do YouTube, não uma playlist.")
    duration = info.get("duration")
    if (
        info.get("is_live")
        or not isinstance(duration, (float, int))
        or not math.isfinite(duration)
        or not 0 < duration <= MAX_DURATION
    ):
        raise _MediaError("Use um vídeo gravado com duração de até oito horas.")
    return {
        "url": url,
        "title": str(info.get("title") or "Áudio do YouTube")[:200],
        "duration": duration,
    }


class _Cancelled(Exception):
    pass


@dataclass
class _Job:
    id: str
    directory: Path
    filename: str
    view: dict[str, Any]
    purpose: str = "clip"
    source: Path | None = None
    touched_at: float = field(default_factory=lambda: time.monotonic())
    cancel: threading.Event = field(default_factory=threading.Event)
    future: Future | None = None
    process: subprocess.Popen | None = None


class MediaService:
    """Own transient, cancellable audio jobs, independent of the persisted library."""

    def __init__(self, directory: Path, workers: int = 1):
        self.directory = Path(directory)
        self.directory.mkdir(parents=True, exist_ok=True)
        self._executor = ThreadPoolExecutor(
            max_workers=workers, thread_name_prefix="soundbard-media"
        )
        self._jobs: dict[str, _Job] = {}
        self._lock = threading.RLock()
        self._closed = False

    @staticmethod
    def _youtube_options() -> dict[str, Any]:
        options = {
            "quiet": True,
            "no_warnings": True,
            "noprogress": True,
            "noplaylist": True,
            "socket_timeout": 15,
            "retries": 1,
            "extractor_retries": 1,
            "fragment_retries": 1,
            "format": "bestaudio/best",
            "max_filesize": MAX_DOWNLOAD_BYTES,
        }
        node = shutil.which("node")
        if node:
            options["js_runtimes"] = {"node": {"path": node}}
        return options

    def metadata(self, url: str) -> dict[str, Any]:
        normalized = normalize_youtube_url(url)
        try:
            with yt_dlp.YoutubeDL(self._youtube_options()) as downloader:
                info = downloader.extract_info(normalized, download=False)
            return _metadata(info, normalized)
        except _MediaError:
            raise
        except Exception as error:
            raise _MediaError(
                "Não foi possível consultar o vídeo. "
                "Verifique o link e a disponibilidade no YouTube."
            ) from error

    def _new_job(self, name: str, purpose: str = "clip") -> _Job:
        with self._lock:
            if self._closed:
                raise _MediaError("O processamento de áudio está encerrando. Tente novamente.")
            now = time.monotonic()
            for existing in list(self._jobs.values()):
                if (
                    existing.view["status"] in {"ready", "error", "cancelled"}
                    and now - existing.touched_at >= JOB_TTL_SECONDS
                ):
                    self.delete(existing.id)
            if len(self._jobs) >= 8:
                raise _MediaError(
                    "Há muitas tarefas abertas. Cancele ou finalize uma antes de continuar."
                )
            job_id = str(uuid.uuid4())
            directory = self.directory / job_id
            directory.mkdir(mode=0o700)
            job = _Job(
                job_id,
                directory,
                _filename(name),
                {
                    "id": job_id,
                    "status": "queued",
                    "progress": 0,
                    "message": "Aguardando processamento…",
                    "error": None,
                    "filename": None,
                    "duration": None,
                },
                purpose=purpose,
            )
            self._jobs[job_id] = job
            return job

    def _update(self, job: _Job, **changes) -> None:
        with self._lock:
            job.view.update(changes)
            job.touched_at = time.monotonic()

    @staticmethod
    def _active(job: _Job) -> None:
        if job.cancel.is_set():
            raise _Cancelled

    def create_download(
        self,
        url: str,
        name: str,
        start: float = 0,
        end: float | None = None,
        purpose: str = "clip",
    ) -> dict[str, Any]:
        normalized = normalize_youtube_url(url)
        _range(start, end)
        self._purpose(purpose, start, end)
        job = self._new_job(name, purpose)
        job.future = self._executor.submit(
            self._execute, job, self._download, normalized, start, end
        )
        return self.get(job.id)

    def create_clip(
        self,
        source: Path,
        name: str,
        start: float = 0,
        end: float | None = None,
        purpose: str = "clip",
    ) -> dict[str, Any]:
        _range(start, end)
        self._purpose(purpose, start, end)
        source = Path(source)
        if not source.is_file() or source.suffix.lower() not in {".mp3", ".wav", ".ogg"}:
            raise _MediaError("Use um arquivo MP3, WAV ou OGG válido.")
        if not 0 < source.stat().st_size <= MAX_UPLOAD_BYTES:
            raise _MediaError("O arquivo deve ter entre um byte e 256 MB.")
        return self._queue_clip(source, name, start, end, purpose)

    @staticmethod
    def _purpose(purpose: str, start: float, end: float | None) -> None:
        if purpose not in {"clip", "preview"}:
            raise _MediaError("Escolha uma preparação de prévia ou corte.")
        if purpose == "preview" and (start != 0 or end is not None):
            raise _MediaError("Carregue a fonte inteira para escolher o trecho na prévia.")

    def _queue_clip(
        self, source: Path, name: str, start: float, end: float | None, purpose: str = "clip"
    ) -> dict[str, Any]:
        job = self._new_job(name, purpose)
        destination = job.directory / f"source{source.suffix.lower()}"
        try:
            shutil.copyfile(source, destination)
        except OSError as error:
            self.delete(job.id)
            raise _MediaError("Não foi possível preparar o arquivo para o corte.") from error
        job.future = self._executor.submit(
            self._execute, job, self._convert, destination, start, end
        )
        return self.get(job.id)

    def clip_preview(
        self, job_id: str, name: str, start: float, end: float | None = None
    ) -> dict[str, Any]:
        _range(start, end)
        # Copy while holding the lock so cancelling the preview cannot remove its source first.
        with self._lock:
            job = self._jobs.get(job_id)
            if (
                job is None
                or job.purpose != "preview"
                or job.view["status"] != "ready"
                or job.source is None
            ):
                raise LookupError("A fonte da prévia não está disponível.")
            job.touched_at = time.monotonic()
            return self._queue_clip(job.source, name, start, end)

    def _execute(self, job: _Job, operation, *arguments) -> None:
        try:
            self._active(job)
            operation(job, *arguments)
            self._active(job)
            output = job.directory / "result.mp3"
            duration = _duration(output)
            if job.purpose == "preview":
                if job.source is None:
                    raise _MediaError("Não foi possível carregar a fonte da prévia.")
                duration = _duration(job.source)
                self._update(
                    job,
                    status="processing",
                    progress=99,
                    message="Calculando a forma de onda do áudio…",
                )
                waveform = self._waveform(job, job.source, duration)
                self._active(job)
                (job.directory / "waveform.json").write_text(json.dumps(waveform))
            self._update(
                job,
                status="ready",
                progress=100,
                message="Áudio pronto para ouvir e salvar.",
                filename=job.filename,
                duration=duration,
            )
            if job.purpose != "preview":
                for source in job.directory.glob("source.*"):
                    source.unlink(missing_ok=True)
        except _Cancelled:
            self._update(job, status="cancelled", message="Processamento cancelado.")
        except _MediaError as error:
            if not job.cancel.is_set():
                self._update(job, status="error", error=str(error), message=str(error))
        except Exception:
            if not job.cancel.is_set():
                message = (
                    "Não foi possível preparar o áudio. "
                    "Verifique a disponibilidade do vídeo ou o arquivo e tente novamente."
                )
                self._update(job, status="error", error=message, message=message)
        finally:
            if job.cancel.is_set() or job.view["status"] in {"error", "cancelled"}:
                shutil.rmtree(job.directory, ignore_errors=True)

    def _download(self, job: _Job, url: str, start: float, end: float | None) -> None:
        def progress(data):
            self._active(job)
            size = data.get("downloaded_bytes") or 0
            total = data.get("total_bytes") or data.get("total_bytes_estimate") or 0
            if size > MAX_DOWNLOAD_BYTES or total > MAX_DOWNLOAD_BYTES:
                raise _MediaError("O áudio excede o limite de download de 512 MB.")
            value = min(74, max(0, round(size / total * 74))) if total else 0
            self._update(job, status="downloading", progress=value, message="Baixando áudio…")

        options = self._youtube_options()
        options.update(outtmpl=str(job.directory / "source.%(ext)s"), progress_hooks=[progress])
        self._update(job, status="downloading", message="Consultando vídeo…")
        with yt_dlp.YoutubeDL(options) as downloader:
            info = _metadata(downloader.extract_info(url, download=False), url)
            _range(start, end, info["duration"])
            self._active(job)
            downloader.extract_info(url, download=True)
        self._active(job)
        source = next(
            (
                path
                for path in job.directory.glob("source.*")
                if path.suffix not in {".part", ".ytdl"}
            ),
            None,
        )
        if (
            source is None
            or not source.is_file()
            or not 0 < source.stat().st_size <= MAX_DOWNLOAD_BYTES
        ):
            raise _MediaError(
                "O vídeo não forneceu um áudio disponível dentro do limite de 512 MB."
            )
        self._convert(job, source, start, end)

    def _convert(self, job: _Job, source: Path, start: float, end: float | None) -> None:
        self._active(job)
        job.source = source
        duration = _duration(source)
        _range(start, end, duration)
        length = (end if end is not None else duration) - start
        output = job.directory / "result.mp3"
        command = [
            ffmpeg_path(),
            "-nostdin",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-protocol_whitelist",
            "file,pipe",
            "-format_whitelist",
            AUDIO_FORMATS,
            "-ss",
            str(start),
            "-i",
            str(source),
            "-t",
            str(length),
            "-map",
            "0:a:0",
            "-vn",
            "-sn",
            "-dn",
            "-c:a",
            "libmp3lame",
            "-q:a",
            "2",
            "-progress",
            "pipe:1",
            "-nostats",
            str(output),
        ]
        self._update(job, status="processing", progress=75, message="Cortando e convertendo áudio…")
        self._run_ffmpeg(
            job,
            command,
            "Não foi possível converter o áudio. Verifique o arquivo e o intervalo selecionado.",
            length,
        )

    def _run_ffmpeg(
        self, job: _Job, command: list[str], failure_message: str, duration: float | None = None
    ) -> str:
        process = subprocess.Popen(
            command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
        )
        with self._lock:
            job.process = process
        deadline = time.monotonic() + 600
        try:
            while True:
                self._active(job)
                if time.monotonic() > deadline:
                    raise _MediaError("O processamento demorou demais. Tente um trecho menor.")
                try:
                    stdout, _ = process.communicate(timeout=0.2)
                    if duration is not None:
                        self._conversion_progress(job, stdout, duration)
                    break
                except subprocess.TimeoutExpired as pending:
                    if duration is not None:
                        self._conversion_progress(job, pending.output or b"", duration)
            if process.returncode != 0:
                raise _MediaError(failure_message)
            return stdout
        finally:
            if process.poll() is None:
                process.kill()
            process.communicate()
            with self._lock:
                job.process = None

    def _waveform(self, job: _Job, source: Path, duration: float) -> dict[str, Any]:
        # FFmpeg computes peaks across all channels; opposite stereo channels must not cancel out.
        samples = max(1, math.ceil(duration * 48000 / 1024))
        filters = (
            f"aresample=48000,asetnsamples=n={samples}:p=1,"
            "astats=metadata=1:reset=1:measure_perchannel=none:measure_overall=Peak_level,"
            "ametadata=print:key=lavfi.astats.Overall.Peak_level:file=-"
        )
        command = [
            ffmpeg_path(),
            "-nostdin",
            "-hide_banner",
            "-loglevel",
            "error",
            "-protocol_whitelist",
            "file,pipe",
            "-format_whitelist",
            AUDIO_FORMATS,
            "-i",
            str(source),
            "-map",
            "0:a:0",
            "-vn",
            "-sn",
            "-dn",
            "-af",
            filters,
            "-f",
            "null",
            "-",
        ]
        output = self._run_ffmpeg(job, command, "Não foi possível calcular a forma de onda.")
        levels = re.findall(r"lavfi\.astats\.Overall\.Peak_level=([^\s]+)", output)
        peaks = []
        for value in levels:
            level = float(value)
            if math.isnan(level):
                raise _MediaError("O áudio contém amostras inválidas para a prévia.")
            peaks.append(max(0.0, min(1.0, 10 ** (level / 20))))
        if not peaks:
            raise _MediaError("O áudio não forneceu amostras para a forma de onda.")
        if len(peaks) > 1024:
            # Container duration can be rounded; keep every measured peak when merging excess bins.
            merged = [0.0] * 1024
            for index, peak in enumerate(peaks):
                bucket = min(1023, index * 1024 // len(peaks))
                merged[bucket] = max(merged[bucket], peak)
            peaks = merged
        return {"duration": duration, "peaks": peaks}

    def waveform(self, job_id: str) -> dict[str, Any]:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None or job.purpose != "preview" or job.view["status"] != "ready":
                raise LookupError("A forma de onda da prévia ainda não está disponível.")
            job.touched_at = time.monotonic()
            return json.loads((job.directory / "waveform.json").read_text())

    def _conversion_progress(self, job: _Job, output: str | bytes, duration: float) -> None:
        text = output.decode(errors="replace") if isinstance(output, bytes) else output
        times = re.findall(r"out_time_us=(\d+)", text)
        if times:
            progress = min(99, 75 + round(int(times[-1]) / 1_000_000 / duration * 24))
            self._update(job, progress=progress)

    def get(self, job_id: str) -> dict[str, Any]:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                raise LookupError("Tarefa de áudio não encontrada.")
            job.touched_at = time.monotonic()
            return dict(job.view)

    def file(self, job_id: str) -> Path:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None or job.view["status"] != "ready":
                raise LookupError("O arquivo de áudio ainda não está disponível.")
            job.touched_at = time.monotonic()
            return job.directory / "result.mp3"

    def delete(self, job_id: str) -> None:
        with self._lock:
            job = self._jobs.pop(job_id, None)
            if job is None:
                raise LookupError("Tarefa de áudio não encontrada.")
            job.cancel.set()
            process = job.process
            future = job.future
            if process and process.poll() is None:
                try:
                    process.terminate()
                except ProcessLookupError:
                    pass
        if future is None or future.cancel() or future.done():
            shutil.rmtree(job.directory, ignore_errors=True)

    def close(self) -> None:
        with self._lock:
            if self._closed:
                return
            self._closed = True
            job_ids = list(self._jobs)
        for job_id in job_ids:
            try:
                self.delete(job_id)
            except LookupError:
                pass
        self._executor.shutdown(wait=True, cancel_futures=True)
