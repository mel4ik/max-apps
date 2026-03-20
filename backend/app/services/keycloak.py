# backend/app/services/keycloak.py
"""
Keycloak авторизация для API Золотой Короны.
Resource Owner Password Credentials flow.
Автоматический refresh токена.
"""

import time
import logging
import httpx
from app.core.config import get_settings

log = logging.getLogger(__name__)


class KeycloakAuth:
    def __init__(self):
        self.settings = get_settings()
        self._access_token = None
        self._refresh_token = None
        self._expires_at = 0
        self._refresh_expires_at = 0
        self._http = httpx.AsyncClient(timeout=15)

    async def get_token(self, force: bool = False) -> str:
        """Возвращает актуальный Bearer token. Обновляет при необходимости."""
        now = time.time()

        # Принудительное обновление
        if force:
            self._access_token = None
            self._refresh_token = None

        # Токен ещё валиден (с запасом 30 сек)
        if self._access_token and now < self._expires_at - 30:
            return self._access_token

        # Пробуем refresh
        if self._refresh_token and now < self._refresh_expires_at - 30:
            try:
                await self._refresh()
                return self._access_token
            except Exception as e:
                log.warning("Refresh token failed: %s, re-authenticating", e)

        # Полная авторизация
        await self._authenticate()
        return self._access_token

    async def _authenticate(self):
        """Resource Owner Password Credentials."""
        s = self.settings
        log.info("Keycloak: authenticating as %s", s.korona_username)

        resp = await self._http.post(
            s.korona_auth_url,
            data={
                "grant_type": "password",
                "username": s.korona_username,
                "password": s.korona_password,
            },
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
            },
            auth=(s.korona_client_id, s.korona_client_secret),
        )
        resp.raise_for_status()
        data = resp.json()
        self._set_tokens(data)
        log.info("Keycloak: authenticated, expires_in=%s", data.get("expires_in"))

    async def _refresh(self):
        """Обновление токена через refresh_token."""
        s = self.settings
        log.debug("Keycloak: refreshing token")

        resp = await self._http.post(
            s.korona_auth_url,
            data={
                "grant_type": "refresh_token",
                "refresh_token": self._refresh_token,
            },
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
            },
            auth=(s.korona_client_id, s.korona_client_secret),
        )
        resp.raise_for_status()
        data = resp.json()
        self._set_tokens(data)
        log.debug("Keycloak: token refreshed")

    def _set_tokens(self, data: dict):
        now = time.time()
        self._access_token = data["access_token"]
        self._refresh_token = data.get("refresh_token")
        self._expires_at = now + data.get("expires_in", 300)
        self._refresh_expires_at = now + data.get("refresh_expires_in", 1800)

    async def close(self):
        await self._http.aclose()


# Singleton
_instance = None


def get_keycloak() -> KeycloakAuth:
    global _instance
    if _instance is None:
        _instance = KeycloakAuth()
    return _instance
