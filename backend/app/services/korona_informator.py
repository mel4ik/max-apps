# backend/app/services/korona_informator.py
"""
Resilient-прокси к Transport Card Informator v1.36.
- GET /v2/cards/{pan}        — информация о карте
- GET /v2/cards/{pan}/trips  — поездки (пагинация)
- GET /v2/cards/{pan}/replenishments — пополнения (пагинация)

Кэш: Redis → PostgreSQL fallback.
"""

import re
import json
import logging
from datetime import datetime
from typing import Optional, Any

import httpx
import redis.asyncio as aioredis
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.core.config import get_settings
from app.models.models import Card, CardSnapshot, Trip, Replenishment
from app.services.keycloak import get_keycloak

log = logging.getLogger(__name__)
settings = get_settings()

CARD_PAN_RE = re.compile(r"^9643\d{15}$")


class KoronaError(Exception):
    """Ошибка API Короны."""
    def __init__(self, message: str, code: int = 0, http_status: int = 500):
        super().__init__(message)
        self.code = code
        self.http_status = http_status


class KoronaInformator:
    def __init__(self, db: AsyncSession, redis: aioredis.Redis):
        self.db = db
        self.redis = redis
        self.keycloak = get_keycloak()
        self.http = httpx.AsyncClient(timeout=settings.korona_timeout)

    # ═══════════════════════════════════════
    # PUBLIC: Информация о карте
    # ═══════════════════════════════════════

    async def get_card_info(self, pan: str, force: bool = False) -> dict:
        """
        GET /v2/cards/{pan}
        С кэшированием: Redis (5 мин) → Корона → PostgreSQL fallback.
        """
        pan = self.validate_pan(pan)
        cache_key = "card:" + pan

        # 1. Redis кэш
        if not force:
            cached = await self._cache_get(cache_key)
            if cached:
                cached["_source"] = "cache"
                cached["_stale"] = False
                return cached

        # 2. API Короны
        try:
            data = await self._api_get("/v2/cards/" + pan)
            # Сохраняем в Redis
            await self._cache_set(cache_key, data, settings.cache_ttl_card)
            data["_source"] = "korona"
            data["_stale"] = False
            return data

        except KoronaError as e:
            log.warning("Корона недоступна для %s: %s", pan[:8] + "...", e)

            # 3. Fallback: Redis (просроченный)
            cached = await self._cache_get(cache_key, allow_expired=True)
            if cached:
                cached["_source"] = "cache_stale"
                cached["_stale"] = True
                return cached

            # 4. Fallback: PostgreSQL snapshot
            snap = await self._get_db_snapshot(pan)
            if snap:
                snap["_source"] = "db_fallback"
                snap["_stale"] = True
                return snap

            raise KoronaError("Сервис временно недоступен. Попробуйте позже.")

    async def save_card_snapshot(self, card: Card, data: dict):
        """Сохраняет снимок карты в PostgreSQL для fallback."""
        ci = data.get("card_info") or {}
        ta = data.get("transport_application") or {}
        counter = ta.get("counter") or {}
        ct = counter.get("counter_trips") or {}
        cm = counter.get("counter_money") or {}

        snap = CardSnapshot(
            card_id=card.id,
            is_in_stoplist=ci.get("is_in_stoplist", False),
            stop_list_status=ci.get("stop_list_status"),
            ticket_type=ta.get("ticket_type"),
            counter_type=counter.get("counter_type"),
            counter_trips_value=ct.get("counter_value") if ct else None,
            counter_money_value=cm.get("card_money_value") if cm else None,
            counter_money_currency=cm.get("counter_money_currency") if cm else None,
            relevance_date=counter.get("relevance_date"),
            ta_start_date=ta.get("start_date"),
            ta_expiration_date=ta.get("expiration_date"),
            extra_services=data.get("extra_services"),
            discount_rules=data.get("discount_rules"),
            current_discount_rule=data.get("current_discount_rule"),
            ticket_rule=data.get("ticket_rule"),
            raw_response=data,
            is_stale=False,
        )
        self.db.add(snap)
        await self.db.commit()

    # ═══════════════════════════════════════
    # PUBLIC: Поездки
    # ═══════════════════════════════════════

    async def get_trips(self, pan: str, page: int = 0, size: int = 20) -> dict:
        """GET /v2/cards/{pan}/trips с пагинацией."""
        pan = self.validate_pan(pan)
        cache_key = "trips:" + pan + ":" + str(page)

        cached = await self._cache_get(cache_key)
        if cached:
            cached["_source"] = "cache"
            return cached

        try:
            data = await self._api_get(
                "/v2/cards/" + pan + "/trips",
                params={"pageNumber": page, "pageSize": size},
            )
            await self._cache_set(cache_key, data, settings.cache_ttl_trips)
            data["_source"] = "korona"
            return data
        except KoronaError:
            # Fallback: DB
            return {"content": await self._get_db_trips(pan, size), "_source": "db_fallback", "_stale": True}

    # ═══════════════════════════════════════
    # PUBLIC: Пополнения
    # ═══════════════════════════════════════

    async def get_replenishments(self, pan: str, page: int = 0, size: int = 20) -> dict:
        """GET /v2/cards/{pan}/replenishments с пагинацией."""
        pan = self.validate_pan(pan)
        cache_key = "repls:" + pan + ":" + str(page)

        cached = await self._cache_get(cache_key)
        if cached:
            cached["_source"] = "cache"
            return cached

        try:
            data = await self._api_get(
                "/v2/cards/" + pan + "/replenishments",
                params={"pageNumber": page, "pageSize": size},
            )
            await self._cache_set(cache_key, data, settings.cache_ttl_repls)
            data["_source"] = "korona"
            return data
        except KoronaError:
            return {"content": [], "_source": "db_fallback", "_stale": True}

    # ═══════════════════════════════════════
    # PUBLIC: Доступные покупки
    # ═══════════════════════════════════════

    async def get_available_purchases(self, pan: str) -> list:
        """GET /v2/cards/{pan}/available-purchases"""
        pan = self.validate_pan(pan)
        return await self._api_get("/v2/cards/" + pan + "/available-purchases")

    # ═══════════════════════════════════════
    # VALIDATION
    # ═══════════════════════════════════════

    @staticmethod
    def validate_pan(pan: str) -> str:
        pan = (pan or "").strip()
        if not CARD_PAN_RE.match(pan):
            raise ValueError("PAN карты должен содержать 19 цифр и начинаться с 9643")
        return pan

    # ═══════════════════════════════════════
    # PRIVATE: API calls with auth
    # ═══════════════════════════════════════

    async def _api_get(self, path: str, params: dict = None) -> dict:
        """GET запрос к Informator API с авторизацией."""
        token = await self.keycloak.get_token()
        url = settings.korona_info_url.rstrip("/") + path

        for attempt in range(settings.korona_max_retries):
            try:
                resp = await self.http.get(
                    url,
                    params=params,
                    headers={
                        "Authorization": "Bearer " + token,
                        "Accept": "application/json",
                    },
                )

                if resp.status_code == 401:
                    # Токен протух — обновляем и пробуем снова
                    token = await self.keycloak.get_token()
                    continue

                if resp.status_code == 404:
                    data = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
                    code = data.get("code", 106)
                    raise KoronaError(
                        data.get("message", "Карта не найдена"),
                        code=code, http_status=404,
                    )

                if resp.status_code >= 400:
                    data = {}
                    try:
                        data = resp.json()
                    except Exception:
                        pass
                    raise KoronaError(
                        data.get("message", "Ошибка API Короны: HTTP " + str(resp.status_code)),
                        code=data.get("code", 0),
                        http_status=resp.status_code,
                    )

                return resp.json()

            except httpx.TimeoutException:
                if attempt == settings.korona_max_retries - 1:
                    raise KoronaError("Сервис не ответил вовремя", http_status=504)
                log.warning("Korona timeout, retry %d", attempt + 1)

            except httpx.HTTPError as e:
                raise KoronaError("Ошибка сети: " + str(e), http_status=502)

        raise KoronaError("Не удалось получить данные", http_status=502)

    # ═══════════════════════════════════════
    # PRIVATE: Cache
    # ═══════════════════════════════════════

    async def _cache_get(self, key: str, allow_expired: bool = False) -> Optional[dict]:
        try:
            raw = await self.redis.get(key)
            if raw:
                return json.loads(raw)
            # Для allow_expired — пробуем ключ с суффиксом :stale
            if allow_expired:
                raw = await self.redis.get(key + ":stale")
                if raw:
                    return json.loads(raw)
        except Exception as e:
            log.warning("Redis get error: %s", e)
        return None

    async def _cache_set(self, key: str, data: Any, ttl: int):
        if ttl <= 0:
            return
        try:
            raw = json.dumps(data, default=str, ensure_ascii=False)
            await self.redis.set(key, raw, ex=ttl)
            await self.redis.set(key + ":stale", raw, ex=3600)
        except Exception as e:
            log.warning("Redis set error: %s", e)

    async def invalidate_cache(self, pan: str):
        """Инвалидировать кэш карты (после пополнения)."""
        try:
            keys = await self.redis.keys("card:" + pan + "*")
            keys += await self.redis.keys("trips:" + pan + "*")
            keys += await self.redis.keys("repls:" + pan + "*")
            if keys:
                await self.redis.delete(*keys)
        except Exception as e:
            log.warning("Redis invalidate error: %s", e)

    # ═══════════════════════════════════════
    # PRIVATE: DB fallback
    # ═══════════════════════════════════════

    async def _get_db_snapshot(self, pan: str) -> Optional[dict]:
        result = await self.db.execute(
            select(CardSnapshot)
            .join(Card)
            .where(Card.card_pan == pan, Card.is_active == True)
            .order_by(desc(CardSnapshot.fetched_at))
            .limit(1)
        )
        snap = result.scalar_one_or_none()
        if not snap:
            return None
        return snap.raw_response

    async def _get_db_trips(self, pan: str, limit: int) -> list:
        result = await self.db.execute(
            select(Trip)
            .join(Card)
            .where(Card.card_pan == pan, Card.is_active == True)
            .order_by(desc(Trip.trip_date))
            .limit(limit)
        )
        return [t.raw_data for t in result.scalars() if t.raw_data]
