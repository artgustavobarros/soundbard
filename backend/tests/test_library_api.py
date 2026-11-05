from fastapi.testclient import TestClient

from backend.app import create_app


def test_library_requires_server_database_configuration(tmp_path):
    with TestClient(create_app(tmp_path), base_url="http://127.0.0.1:3000") as client:
        response = client.get("/api/library")
    assert response.status_code == 503
    assert response.json() == {
        "detail": "Configure DATABASE_URL para abrir a biblioteca do servidor."
    }
