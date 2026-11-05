import pytest
from fastapi.testclient import TestClient

from backend.app import create_app


@pytest.fixture
def client(tmp_path):
    frontend = tmp_path / "frontend"
    frontend.mkdir()
    (frontend / "index.html").write_text("<!DOCTYPE html><title>Soundbard</title>")
    with TestClient(create_app(frontend), base_url="http://127.0.0.1:3000") as value:
        yield value


def test_health_reports_processing_tools(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "ffmpeg": True, "youtube": True}


def test_rejects_external_origins_before_starting_download(client):
    response = client.post(
        "/api/audio-jobs",
        json={"url": "https://www.youtube.com/watch?v=abcdefghijk", "name": "Teste"},
        headers={"origin": "https://site-externo.example"},
    )
    assert response.status_code == 403


@pytest.mark.parametrize(
    "origin",
    [
        "http://192.168.1.66:9999",
        "http://100.101.102.103:9999",
        "http://127.0.0.1:9999",
        "http://localhost:9999",
        "file://localhost",
    ],
)
def test_rejects_unconfigured_origins_even_on_local_networks(client, origin):
    response = client.post("/api/audio-jobs/upload", headers={"origin": origin})
    assert response.status_code == 403


def test_accepts_only_the_explicit_extra_origin(tmp_path):
    origin = "http://192.168.1.10:3000"
    with TestClient(create_app(tmp_path, origin=origin), base_url=origin) as local:
        assert local.get("/api/health", headers={"origin": origin}).status_code == 200
        assert (
            local.get("/api/health", headers={"origin": "http://192.168.1.10:9999"}).status_code
            == 403
        )


def test_rejects_dns_rebinding_hosts(client):
    response = client.get("/api/health", headers={"host": "site-externo.example"})
    assert response.status_code == 400


@pytest.mark.parametrize("path", ["/api/inexistente", "/assets/inexistente.js"])
def test_unknown_files_and_api_routes_do_not_return_the_spa(client, path):
    response = client.get(path)
    assert response.status_code == 404
    assert "<!DOCTYPE" not in response.text


def test_rejects_non_youtube_urls_without_network_access(client):
    response = client.post("/api/youtube/metadata", json={"url": "http://127.0.0.1/secrets"})
    assert response.status_code == 422


def test_rejects_invalid_clip_bounds(client):
    response = client.post(
        "/api/audio-jobs",
        json={
            "url": "https://www.youtube.com/watch?v=abcdefghijk",
            "name": "Trecho",
            "start": 5,
            "end": 2,
        },
    )
    assert response.status_code == 422


def test_rejects_unexpected_fields(client):
    response = client.post(
        "/api/audio-jobs",
        json={
            "url": "https://www.youtube.com/watch?v=abcdefghijk",
            "name": "Teste",
            "output_directory": "/tmp/fora-do-projeto",
        },
    )
    assert response.status_code == 422


def test_missing_jobs_return_json_404(client):
    response = client.get("/api/audio-jobs/nao-existe")
    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/json")


def test_api_responses_are_not_cached(client):
    response = client.get("/api/health")
    assert response.headers["cache-control"] == "no-store"


def test_serves_compiled_frontend_and_routes(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert client.get("/previa").status_code == 200


def test_rejects_invalid_audio_upload_without_touching_the_library(client):
    response = client.post(
        "/api/audio-jobs/upload",
        files={"file": ("playlist.m3u", b"http://127.0.0.1/", "audio/mpeg")},
        data={"name": "Inválido", "start": "0", "end": "1"},
    )
    assert response.status_code == 422
