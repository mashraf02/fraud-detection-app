"""Application settings, loaded from the environment.

Every value the application needs is declared here — no module reads paths,
thresholds or origins from hardcoded literals. See `.env.example` for the
variable names.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[1]

# Comma-separated values are used rather than JSON lists so that .env files stay
# readable (FRAUD_RADAR_CORS_ORIGINS=http://a,http://b).
LIST_SEPARATOR = ","


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_prefix="FRAUD_RADAR_",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Fraud Radar"
    environment: str = "development"
    log_level: str = "INFO"

    # SQLite by default so a checkout runs with no infrastructure; production
    # points this at Postgres, e.g.
    # postgresql+psycopg://user:pass@host:5432/fraud_radar
    database_url: str = (
        f"sqlite:///{(PROJECT_ROOT / 'data' / 'fraud_radar.db').as_posix()}"
    )
    db_echo: bool = False
    # Convenience for local runs. Production should run migrations instead.
    auto_create_tables: bool = True

    model_dir: Path = PROJECT_ROOT / "model"

    cors_origins: str = "http://localhost:5173"

    # Empty means "no authentication required", which is only tolerated outside
    # production. Startup refuses to boot in production without at least one key.
    api_keys: str = ""

    # None means "use the threshold recommended by the trained model".
    decision_threshold: float | None = None

    max_batch_size: int = 5000

    @property
    def cors_origin_list(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.cors_origins.split(LIST_SEPARATOR)
            if origin.strip()
        ]

    @property
    def api_key_set(self) -> set[str]:
        return {
            key.strip()
            for key in self.api_keys.split(LIST_SEPARATOR)
            if key.strip()
        }

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")


@lru_cache
def get_settings() -> Settings:
    """Cached settings accessor, also usable as a FastAPI dependency."""
    return Settings()
