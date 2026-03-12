# backend/app/core/config.py
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # ─── App ───
    app_name: str = "Часпик Транспорт Lite"
    debug: bool = False
    secret_key: str = "change-me-in-production"

    # ─── Database ───
    database_url: str = "postgresql+asyncpg://chaspik:chaspik@localhost:5432/chaspik"

    # ─── Redis ───
    redis_url: str = "redis://localhost:6379/0"
    cache_ttl_card: int = 300       # 5 мин
    cache_ttl_trips: int = 600      # 10 мин
    cache_ttl_repls: int = 600      # 10 мин

    # ─── Золотая Корона: Keycloak (общий для обоих API) ───
    korona_auth_url: str = "https://trcard.korona.net/auth/realms/public/protocol/openid-connect/token"
    korona_client_id: str = ""
    korona_client_secret: str = ""
    korona_username: str = ""
    korona_password: str = ""

    # ─── Золотая Корона: Informator API (без mTLS) ───
    korona_info_url: str = "https://trcard.korona.net/api/tcard-info/1.0"
    korona_timeout: int = 10
    korona_max_retries: int = 2

    # ─── Золотая Корона: Replenishment API (mTLS, порт 2505) ───
    korona_repl_url: str = "https://trcard.korona.net:2505/krasnodar/api/card-replenisher/1.0"
    korona_repl_ca_cert: str = "/app/certs/CA_TK_REPLENISHER.crt"
    korona_repl_client_cert: str = "/app/certs/client_tkpay.crt"
    korona_repl_client_key: str = "/app/certs/client_tkpay.pem"

    # ─── ЮKassa (Этап 3) ───
    yukassa_shop_id: str = ""
    yukassa_secret_key: str = ""
    yukassa_return_url: str = ""

    # ─── MAX Bot ───
    max_bot_token: str = ""

    # ─── CORS ───
    cors_origins: str = "*"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
