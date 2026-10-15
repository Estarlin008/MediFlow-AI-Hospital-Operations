from functools import lru_cache
from typing import Any

from pydantic import SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_env: str = "development"
    database_url: str
    jwt_secret_key: SecretStr | None = None
    session_secret: SecretStr | None = None
    access_token_minutes: int = 15
    refresh_token_days: int = 7
    frontend_origins: str = ""
    n8n_base_url: str | None = None
    n8n_triage_path: str = "/webhook/mediflow/triage"
    n8n_consultation_path: str = "/webhook/mediflow/consultation"
    n8n_auth_header_name: str | None = None
    n8n_auth_header_value: SecretStr | None = None
    n8n_timeout_seconds: float = 12.0

    @field_validator("n8n_auth_header_name")
    @classmethod
    def normalize_n8n_auth_header_name(cls, value: str | None) -> str | None:
        normalized = value.strip() if value else None
        return normalized or None

    @field_validator("database_url")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        if value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql+psycopg://", 1)
        if value.startswith("postgresql://") and "+" not in value.split("://", 1)[0]:
            return value.replace("postgresql://", "postgresql+psycopg://", 1)
        return value

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip().rstrip("/") for origin in self.frontend_origins.split(",") if origin.strip()]

    @property
    def jwt_secret(self) -> str:
        configured: Any = self.jwt_secret_key or self.session_secret
        if configured is None:
            raise RuntimeError("JWT_SECRET_KEY (or SESSION_SECRET) must be configured.")
        value = configured.get_secret_value()
        if len(value) < 32:
            raise RuntimeError("The configured token signing secret must contain at least 32 characters.")
        return value


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    # Resolve here so an unsafe/absent signing secret fails at startup, not at first login.
    settings.jwt_secret
    return settings
