import pytest
from fastapi import HTTPException

from app.core.config import get_settings
from app.services.n8n_client import N8nClient


def configure_settings(monkeypatch: pytest.MonkeyPatch, **values: str) -> None:
    defaults = {
        "DATABASE_URL": "postgresql+psycopg://user:password@localhost/mediflow",
        "JWT_SECRET_KEY": "local-development-secret-with-at-least-32-characters",
    }
    defaults.update(values)
    for name, value in defaults.items():
        monkeypatch.setenv(name, value)
    get_settings.cache_clear()


def test_n8n_client_uses_configured_header_name_and_value(monkeypatch: pytest.MonkeyPatch) -> None:
    configure_settings(
        monkeypatch,
        N8N_BASE_URL="https://n8n.example.test",
        N8N_AUTH_HEADER_NAME="X-Workflow-Token",
        N8N_AUTH_HEADER_VALUE="secret-value",
    )

    assert N8nClient()._headers() == {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-Workflow-Token": "secret-value",
    }


def test_n8n_client_rejects_missing_auth_configuration(monkeypatch: pytest.MonkeyPatch) -> None:
    configure_settings(monkeypatch, N8N_BASE_URL="https://n8n.example.test")

    with pytest.raises(HTTPException) as error:
        N8nClient()._headers()

    assert error.value.status_code == 503
