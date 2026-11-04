import hashlib
import math
import shutil
import threading
import time
import wave

import pytest
from fastapi.testclient import TestClient

from backend import media
from backend.app import create_app
from backend.tests.test_media import fake_youtube, make_wav, settled


@pytest.fixture
def service(tmp_path):
    current = media.MediaService(tmp_path / "jobs")
    yield current
    current.close()


def patterned_wav(path, levels=(0.0, 0.1, 0.5, 0.2), stereo=False):
    frames = bytearray()
    for level in levels:
        for sample in range(8000):
            value = round(32767 * level * math.sin(2 * math.pi * 250 * sample / 8000))
            frames.extend(value.to_bytes(2, "little", signed=True))
            if stereo:
                frames.extend((-value).to_bytes(2, "little", signed=True))
    with wave.open(str(path), "wb") as output:
        output.setnchannels(2 if stereo else 1)
        output.setsampwidth(2)
        output.setframerate(8000)
        output.writeframes(frames)
    return path


def test_preview_waveform_tracks_real_silence_and_different_amplitudes(service, tmp_path):
    source = patterned_wav(tmp_path / "volumes.wav")
    original = hashlib.sha256(source.read_bytes()).hexdigest()
    created = service.create_clip(source, "Prévia", purpose="preview")
    ready = settled(service, created["id"])
    assert ready["status"] == "ready", ready
    waveform = service.waveform(created["id"])
    assert waveform["duration"] == 4.0
    peaks = waveform["peaks"]
    assert 1000 <= len(peaks) <= 1024
    assert all(math.isfinite(peak) and 0 <= peak <= 1 for peak in peaks)
    assert max(peaks[30:200]) < 0.0001
    assert 0.09 < min(peaks[300:480]) < 0.11
    assert 0.45 < min(peaks[550:730]) < 0.55
    assert 0.19 < min(peaks[800:980]) < 0.21
    assert hashlib.sha256(source.read_bytes()).hexdigest() == original
    assert service.waveform(created["id"]) == waveform


def test_opposite_stereo_channels_do_not_disappear_from_the_waveform(service, tmp_path):
    source = patterned_wav(tmp_path / "stereo.wav", levels=(0.6,), stereo=True)
    created = service.create_clip(source, "Estéreo", purpose="preview")
    assert settled(service, created["id"])["status"] == "ready"
    peaks = service.waveform(created["id"])["peaks"]
    assert 0.55 < max(peaks) < 0.65


def test_final_clip_reads_original_source_instead_of_transcoded_preview(service, tmp_path):
    source = make_wav(tmp_path / "original.wav")
    preview = service.create_clip(source, "Prévia", purpose="preview")
    assert settled(service, preview["id"])["status"] == "ready"
    service.file(preview["id"]).write_bytes(b"This MP3 must not be used as the source")
    clipped = service.clip_preview(preview["id"], "Trecho", 1, 2)
    service.delete(preview["id"])
    ready = settled(service, clipped["id"])
    assert ready["status"] == "ready", ready
    assert 0.95 < ready["duration"] < 1.2
    assert service.file(clipped["id"]).stat().st_size > 500
    with pytest.raises(LookupError):
        service.waveform(preview["id"])
    assert source.exists()


def test_downloaded_preview_retains_native_source_for_the_final_clip(
    service, tmp_path, monkeypatch
):
    source = patterned_wav(tmp_path / "remote.wav")
    fake_youtube(monkeypatch, source)
    preview = service.create_download("https://youtu.be/dQw4w9WgXcQ", "Fonte", purpose="preview")
    assert settled(service, preview["id"])["status"] == "ready"
    assert max(service.waveform(preview["id"])["peaks"][30:200]) < 0.0001
    clipped = service.clip_preview(preview["id"], "Tom forte", 2.1, 2.9)
    assert settled(service, clipped["id"])["status"] == "ready"


def test_downloaded_native_m4a_can_be_cut_without_expanding_upload_formats(
    service, tmp_path, monkeypatch
):
    original = make_wav(tmp_path / "original.wav")
    native = tmp_path / "native.m4a"
    media.subprocess.run(
        [media.ffmpeg_path(), "-i", str(original), "-c:a", "aac", str(native)],
        check=True,
        capture_output=True,
    )

    class Downloader:
        def __init__(self, options):
            self.options = options

        def __enter__(self):
            return self

        def __exit__(self, *_arguments):
            return None

        def extract_info(self, _url, download):
            if download:
                shutil.copyfile(native, self.options["outtmpl"].replace("%(ext)s", "m4a"))
            return {"title": "Fonte AAC", "duration": 4}

    monkeypatch.setattr(media.yt_dlp, "YoutubeDL", Downloader)
    preview = service.create_download("https://youtu.be/dQw4w9WgXcQ", "AAC", purpose="preview")
    assert settled(service, preview["id"])["status"] == "ready"
    service.file(preview["id"]).write_bytes(b"Do not cut this transcoded file")
    clipped = service.clip_preview(preview["id"], "Trecho AAC", 1, 2)
    assert settled(service, clipped["id"])["status"] == "ready"
    with pytest.raises(ValueError):
        service.create_clip(native, "Upload ainda não suportado")


def test_cancels_the_real_waveform_process_and_cleans_the_source_copy(
    service, tmp_path, monkeypatch
):
    source = make_wav(tmp_path / "cancelar.wav")
    started = threading.Event()
    processes = []
    real_popen = media.subprocess.Popen

    def waveform_in_realtime(command, *arguments, **options):
        if "-af" in command:
            command = list(command)
            command.insert(command.index("-i"), "-re")
            process = real_popen(command, *arguments, **options)
            processes.append(process)
            started.set()
            return process
        return real_popen(command, *arguments, **options)

    monkeypatch.setattr(media.subprocess, "Popen", waveform_in_realtime)
    preview = service.create_clip(source, "Cancelar", purpose="preview")
    assert started.wait(3)
    service.delete(preview["id"])
    service.close()
    assert processes[0].poll() is not None
    assert not list((tmp_path / "jobs").iterdir())
    assert source.exists()


@pytest.mark.parametrize("start,end", [(1, None), (0, 1)])
def test_preview_requires_the_complete_original_source(service, tmp_path, start, end):
    with pytest.raises(ValueError):
        service.create_clip(
            make_wav(tmp_path / "original.wav"), "Prévia", start, end, purpose="preview"
        )


def test_preview_api_exposes_waveform_and_creates_a_cut_without_reupload(tmp_path):
    source = patterned_wav(tmp_path / "original.wav")
    with TestClient(create_app(tmp_path), base_url="http://127.0.0.1:3000") as client:
        created = client.post(
            "/api/audio-jobs/upload",
            files={"file": ("original.wav", source.read_bytes(), "audio/wav")},
            data={"name": "Fonte inteira", "purpose": "preview"},
        )
        assert created.status_code == 202, created.text
        preview_id = created.json()["id"]
        deadline = time.monotonic() + 8
        while time.monotonic() < deadline:
            current = client.get(f"/api/audio-jobs/{preview_id}").json()
            if current["status"] in {"ready", "error"}:
                break
            time.sleep(0.02)
        assert current["status"] == "ready", current
        waveform = client.get(f"/api/audio-jobs/{preview_id}/waveform")
        assert waveform.status_code == 200
        assert waveform.headers["cache-control"] == "no-store"
        assert waveform.json()["duration"] == 4.0
        assert max(waveform.json()["peaks"][30:200]) < 0.0001
        clipped = client.post(
            f"/api/audio-jobs/{preview_id}/clips",
            json={"name": "Trecho", "start": 1, "end": 2},
        )
        assert clipped.status_code == 202, clipped.text
        assert clipped.json()["id"] != preview_id
        assert client.delete(f"/api/audio-jobs/{preview_id}").status_code == 204
        assert client.get(f"/api/audio-jobs/{preview_id}/waveform").status_code == 404


def test_api_rejects_unknown_purpose_and_partial_preview(tmp_path):
    source = make_wav(tmp_path / "source.wav")
    with TestClient(create_app(tmp_path), base_url="http://127.0.0.1:3000") as client:
        for purpose, start in (("anything", "0"), ("preview", "1")):
            response = client.post(
                "/api/audio-jobs/upload",
                files={"file": ("source.wav", source.read_bytes(), "audio/wav")},
                data={"name": "Fonte", "purpose": purpose, "start": start},
            )
            assert response.status_code == 422
