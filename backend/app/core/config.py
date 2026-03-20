from pydantic_settings import BaseSettings
from functools import lru_cache
import logging

_log = logging.getLogger(__name__)


class Settings(BaseSettings):
    # ─── App ───
    app_name: str = "Часпик Транспорт Lite"
    debug: bool = False
    secret_key: str = "change-me-in-production"
    # ─── Database ───
    database_url: str = "postgresql+asyncpg://chaspik:chaspik@localhost:5432/chaspik"
    # ─── Redis ───
    redis_url: str = "redis://localhost:6379/0"
    cache_ttl_card: int = 300
    cache_ttl_trips: int = 600
    cache_ttl_repls: int = 600
    # ─── Золотая Корона: Keycloak ───
    korona_auth_url: str = "https://trcard.korona.net/auth/realms/public/protocol/openid-connect/token"
    korona_client_id: str = ""
    korona_client_secret: str = ""
    korona_username: str = ""
    korona_password: str = ""
    # ─── Золотая Корона: Informator API ───
    korona_info_url: str = "https://trcard.korona.net/api/tcard-info/1.0"
    korona_timeout: int = 10
    korona_max_retries: int = 2
    # ─── Золотая Корона: Replenishment API (mTLS) ───
    korona_repl_url: str = "https://trcard.korona.net:2505/krasnodar/api/card-replenisher/1.0"
    korona_repl_ca_cert: str = "/app/certs/CA_TK_REPLENISHER.crt"
    korona_repl_client_cert: str = "/app/certs/client_tkpay.crt"
    korona_repl_client_key: str = "/app/certs/client_tkpay.pem"
    # ─── ЮKassa ───
    yukassa_shop_id: str = ""
    yukassa_secret_key: str = ""
    yukassa_return_url: str = ""
    yukassa_receipt_email: str = "receipt@tkpay.ru"
    yukassa_receipt_tax: str = "1"  # 1=без НДС, 2=0%, 3=10%, 4=20%
    # ─── MAX Bot ───
    max_bot_token: str = ""
    # ─── CORS ───
    cors_origins: str = "https://app.tkpay.ru"
    # ─── Ticket ID маппинг ───
    ticket_purse: str = "0110"
    ticket_pack: str = "0111,0112,0191,0192,0194,1196,0195,1098,1096,1094,1113,1114,0297,1056"
    ticket_abonement: str = ""
    ticket_social: str = ""
    can_pay: str = ""
    admin_login: str = "admin"
    admin_password: str = ""
    admin_secret_key: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    s = Settings()

    # Проверки безопасности при старте
    if s.secret_key == "change-me-in-production":
        _log.warning("⚠ SECRET_KEY не изменён! Задайте случайную строку в .env")
    if s.debug and s.yukassa_shop_id:
        _log.warning("⚠ DEBUG=True при настроенной ЮKassa! Подпись MAX Bridge не проверяется")
    if s.cors_origins == "*":
        _log.warning("⚠ CORS_ORIGINS=* — любой сайт может обращаться к API")
    if not s.admin_password:
        _log.warning("⚠ ADMIN_PASSWORD пустой — админка недоступна")

    return s
