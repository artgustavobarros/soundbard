import hashlib
import importlib
import math
import shutil
import threading
import time
import wave
from pathlib import Path
from types import SimpleNamespace

import pytest

from backend import media

VIDEO_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"


def make_wav(path: Path, seconds: float = 4.0) -> Path:
    with wave.open(str(path), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(8000)
        frames = bytearray()
        for index in range(round(seconds * 8000)):
            value = round(8000 * math.sin(2 * math.pi * 220 * index / 8000))
            frames.extend(value.to_bytes(2, "little", signed=True))
        output.writeframes(frames)
    return path


def settled(service, job_id: str, timeout: float = 8):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        job = service.get(job_id)
        if job["status"] in {"ready", "error", "cancelled"}:
            return job
        time.sleep(0.02)
    pytest.fail("A tarefa não terminou dentro do tempo de teste.")


@pytest.fixture
def service(tmp_path):
    current = media.MediaService(tmp_path / "jobs")
    yield current
    current.close()


@pytest.mark.parametrize(
    "url",
    [
        "https://youtu.be/dQw4w9WgXcQ?t=12",
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLanything",
        "https://music.youtube.com/watch?v=dQw4w9WgXcQ",
        "https://m.youtube.com/shorts/dQw4w9WgXcQ",
        "https://youtube.com/live/dQw4w9WgXcQ",
    ],
)
def test_normalizes_video_links_without_forwarding_other_parameters(url):
    assert media.normalize_youtube_url(url) == VIDEO_URL


@pytest.mark.parametrize(
    "url",
    [
        "http://youtu.be/dQw4w9WgXcQ",
        "https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ",
        "https://127.0.0.1/watch?v=dQw4w9WgXcQ",
        "https://youtube.com:443/watch?v=dQw4w9WgXcQ",
        "https://user@youtube.com/watch?v=dQw4w9WgXcQ",
        "https://youtube.com/playlist?list=PLanything",
        "https://youtube.com/watch?v=bad",
        "https://youtube.com/watch?v=dQw4w9WgXcQ&v=aaaaaaaaaaa",
        "file:///etc/passwd",
    ],
)
def test_rejects_non_video_or_ambiguous_urls(url):
    with pytest.raises(ValueError):
        media.normalize_youtube_url(url)


def test_cuts_real_audio_and_preserves_original(service, tmp_path):
    source = make_wav(tmp_path / "original.wav")
    original_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    created = service.create_clip(source, "Caminhada curta", 1.0, 2.5)
    ready = settled(service, created["id"])
    assert ready["status"] == "ready", ready
    assert ready["progress"] == 100
    assert ready["filename"] == "Caminhada curta.mp3"
    assert 1.4 < ready["duration"] < 1.7
    output = service.file(created["id"])
    assert output.suffix == ".mp3"
    assert output.stat().st_size > 1000
    assert hashlib.sha256(source.read_bytes()).hexdigest() == original_hash
    service.delete(created["id"])
    assert not output.exists()
    assert source.exists()
    with pytest.raises(LookupError):
        service.get(created["id"])


@pytest.mark.parametrize(
    "start,end", [(-1, 2), (2, 1), (0, 0), (float("nan"), 2), (0, float("inf"))]
)
def test_rejects_invalid_cut_range(service, tmp_path, start, end):
    source = make_wav(tmp_path / "original.wav")
    with pytest.raises(ValueError):
        service.create_clip(source, "Trecho", start, end)


def test_reports_cut_beyond_actual_file_duration(service, tmp_path):
    source = make_wav(tmp_path / "original.wav", 1)
    job = service.create_clip(source, "Trecho", 0, 10)
    failed = settled(service, job["id"])
    assert failed["status"] == "error"
    assert failed["error"]
    with pytest.raises(LookupError):
        service.file(job["id"])
    assert source.exists()


def test_rejects_playlist_file_renamed_as_audio(service, tmp_path):
    source = tmp_path / "playlist.mp3"
    source.write_text("#EXTM3U\nhttp://127.0.0.1/private.mp3\n")
    job = service.create_clip(source, "Playlist", 0, 1)
    failed = settled(service, job["id"])
    assert failed["status"] == "error"
    assert str(tmp_path) not in failed["error"]


def fake_youtube(monkeypatch, source, *, blocked=None, failure=None, duration=4):
    class Downloader:
        def __init__(self, options):
            self.options = options

        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

        def extract_info(self, url, download=True):
            assert url == VIDEO_URL
            if failure:
                raise failure("Segredo local: /private/source; cookies=secret")
            result = {
                "id": "dQw4w9WgXcQ",
                "title": "Trilha remota",
                "duration": duration,
                "ext": "wav",
                "is_live": False,
                "webpage_url": VIDEO_URL,
                "extractor_key": "Youtube",
            }
            if download:
                if blocked:
                    blocked.set()
                    while not blocked.release.is_set():
                        for hook in self.options["progress_hooks"]:
                            hook(
                                {
                                    "status": "downloading",
                                    "downloaded_bytes": 10,
                                    "total_bytes": 100,
                                }
                            )
                        time.sleep(0.01)
                destination = Path(self.options["outtmpl"].replace("%(ext)s", "wav"))
                shutil.copyfile(source, destination)
                for hook in self.options["progress_hooks"]:
                    hook({"status": "finished", "downloaded_bytes": 100, "total_bytes": 100})
            return result

    monkeypatch.setattr(importlib.import_module("yt_dlp"), "YoutubeDL", Downloader)


def test_downloads_and_cuts_with_youtube_as_only_external_test_double(
    service, tmp_path, monkeypatch
):
    source = make_wav(tmp_path / "remote.wav")
    fake_youtube(monkeypatch, source)
    metadata = service.metadata("https://youtu.be/dQw4w9WgXcQ?t=3")
    assert metadata == {"url": VIDEO_URL, "title": "Trilha remota", "duration": 4}
    job = service.create_download(VIDEO_URL, "Da internet", 1, 3)
    ready = settled(service, job["id"])
    assert ready["status"] == "ready", ready
    assert 1.9 < ready["duration"] < 2.2
    assert service.file(job["id"]).exists()


@pytest.mark.parametrize("failure", [RuntimeError, ValueError])
def test_hides_internal_errors_from_download_results(service, tmp_path, monkeypatch, failure):
    fake_youtube(monkeypatch, make_wav(tmp_path / "remote.wav"), failure=failure)
    job = service.create_download(VIDEO_URL, "Indisponível", 0, 1)
    failed = settled(service, job["id"])
    assert failed["status"] == "error"
    assert "secret" not in failed["error"]
    assert "/private" not in failed["error"]


def test_rejects_excessive_source_duration(service, tmp_path, monkeypatch):
    fake_youtube(monkeypatch, make_wav(tmp_path / "remote.wav"), duration=30000)
    with pytest.raises(ValueError):
        service.metadata(VIDEO_URL)


def test_cancels_active_download_and_removes_temporary_files(service, tmp_path, monkeypatch):
    started = threading.Event()
    started.release = threading.Event()
    fake_youtube(monkeypatch, make_wav(tmp_path / "remote.wav"), blocked=started)
    job = service.create_download(VIDEO_URL, "Cancelar", 0, 1)
    assert started.wait(2)
    service.delete(job["id"])
    with pytest.raises(LookupError):
        service.get(job["id"])
    service.close()
    assert not list((tmp_path / "jobs").glob("*/source.*"))


def test_bounds_pending_jobs_and_can_cancel_one_before_it_starts(service, tmp_path, monkeypatch):
    started = threading.Event()
    started.release = threading.Event()
    source = make_wav(tmp_path / "remote.wav")
    fake_youtube(monkeypatch, source, blocked=started)
    first = service.create_download(VIDEO_URL, "Ocupado", 0, 1)
    assert started.wait(2)
    pending = [service.create_clip(source, f"Trecho {index}", 0, 1) for index in range(7)]
    with pytest.raises(ValueError):
        service.create_clip(source, "Excesso", 0, 1)
    service.delete(pending[-1]["id"])
    with pytest.raises(LookupError):
        service.file(pending[-1]["id"])
    started.release.set()
    assert settled(service, first["id"])["status"] == "ready"
    assert settled(service, pending[0]["id"])["status"] == "ready"


def test_cancelling_a_cut_terminates_the_real_ffmpeg_process(service, tmp_path, monkeypatch):
    source = make_wav(tmp_path / "original.wav")
    started = threading.Event()
    processes = []
    real_popen = media.subprocess.Popen

    def realtime_conversion(command, *arguments, **options):
        if "-progress" in command:
            command = list(command)
            command.insert(command.index("-i"), "-re")
            process = real_popen(command, *arguments, **options)
            processes.append(process)
            started.set()
            return process
        return real_popen(command, *arguments, **options)

    monkeypatch.setattr(media.subprocess, "Popen", realtime_conversion)
    created = service.create_clip(source, "Cancelar corte", 0, 4)
    assert started.wait(2)
    service.delete(created["id"])
    service.close()
    assert processes[0].poll() is not None
    assert not list((tmp_path / "jobs").iterdir())
    assert source.exists()


def test_rejects_oversized_upload_without_copying_it(service, tmp_path):
    source = tmp_path / "grande.wav"
    with source.open("wb") as output:
        output.truncate(256 * 1024 * 1024 + 1)
    with pytest.raises(ValueError):
        service.create_clip(source, "Muito grande", 0, 1)
    assert not list((tmp_path / "jobs").iterdir())


def test_seeks_before_decoding_and_keeps_the_requested_audio(service, tmp_path, monkeypatch):
    tone = make_wav(tmp_path / "tone.wav", 2)
    source = tmp_path / "silence_then_tone.wav"
    with wave.open(str(tone), "rb") as audio:
        parameters = audio.getparams()
        frames = audio.readframes(audio.getnframes())
    with wave.open(str(source), "wb") as audio:
        audio.setparams(parameters)
        audio.writeframes(bytes(2 * 8000 * 2) + frames)

    commands = []
    real_popen = media.subprocess.Popen

    def run_ffmpeg(command, *arguments, **options):
        if "-progress" in command:
            commands.append(command)
        return real_popen(command, *arguments, **options)

    monkeypatch.setattr(media.subprocess, "Popen", run_ffmpeg)
    created = service.create_clip(source, "Depois do silêncio", 2.25, 3.25)
    ready = settled(service, created["id"])
    assert ready["status"] == "ready", ready
    assert commands[0].index("-ss") < commands[0].index("-i")
    assert 0.95 < ready["duration"] < 1.2
    decoded = media.subprocess.run(
        [media.ffmpeg_path(), "-i", str(service.file(created["id"])), "-f", "s16le", "-"],
        check=True,
        capture_output=True,
    ).stdout
    samples = [
        int.from_bytes(decoded[index : index + 2], "little", signed=True)
        for index in range(0, len(decoded) - 1, 2)
    ]
    assert max(samples) > 5000


def test_expired_finished_jobs_release_queue_capacity_and_temporary_files(
    service, tmp_path, monkeypatch
):
    clock = [0.0]
    monkeypatch.setattr(media, "time", SimpleNamespace(monotonic=lambda: clock[0]))
    source = make_wav(tmp_path / "original.wav", 1)
    jobs = [service.create_clip(source, f"Trecho {index}", 0, 0.5) for index in range(8)]
    for job in jobs:
        assert settled(service, job["id"])["status"] == "ready"
    files = [service.file(job["id"]) for job in jobs]

    clock[0] = 3601.0
    fresh = service.create_clip(source, "Novo trecho", 0, 0.5)
    assert settled(service, fresh["id"])["status"] == "ready"
    assert all(not output.exists() for output in files)
    for job in jobs:
        with pytest.raises(LookupError):
            service.get(job["id"])
    assert source.exists()


def test_recently_accessed_result_survives_expiry_cleanup(service, tmp_path, monkeypatch):
    clock = [0.0]
    monkeypatch.setattr(media, "time", SimpleNamespace(monotonic=lambda: clock[0]))
    source = make_wav(tmp_path / "original.wav", 1)
    accessed = service.create_clip(source, "Em uso", 0, 0.5)
    abandoned = service.create_clip(source, "Abandonado", 0, 0.5)
    for job in (accessed, abandoned):
        assert settled(service, job["id"])["status"] == "ready"
    clock[0] = 3500.0
    assert service.file(accessed["id"]).exists()
    clock[0] = 3601.0
    fresh = service.create_clip(source, "Novo", 0, 0.5)
    assert settled(service, fresh["id"])["status"] == "ready"
    assert service.file(accessed["id"]).exists()
    with pytest.raises(LookupError):
        service.get(abandoned["id"])
