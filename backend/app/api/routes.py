# backend/app/api/routes.py
"""
API эндпоинты Этапа 1: карты, баланс, история.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.redis import get_redis
from app.models.models import User, Card
from app.services.max_auth import get_max_user
from app.services.korona_informator import KoronaInformator, KoronaError
from app.core.config import get_settings

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api")


# ─── Schemas ───

class AddCardRequest(BaseModel):
    card_pan: str = Field(..., min_length=19, max_length=19, pattern=r"^9643\d{15}$")

class CardResponse(BaseModel):
    id: str
    card_pan: str
    region: Optional[str] = None
    ticket_description: Optional[str] = None
    is_replenishable: bool = False
    is_social_card: bool = False
    is_online_card: bool = False
    kind: str = "purse"
    status: dict = {}


# ─── Cards ───

@router.get("/cards")
async def list_cards(
    user: User = Depends(get_max_user),
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    """Список карт пользователя с актуальным статусом."""
    result = await db.execute(
        select(Card)
        .where(Card.user_id == user.id, Card.is_active == True)
        .order_by(Card.created_at)
    )
    cards = result.scalars().all()

    korona = KoronaInformator(db, redis)
    items = []

    for card in cards:
        # Получаем статус (из кэша или Короны, с fallback)
        try:
            status = await korona.get_card_info(card.card_pan)
        except KoronaError:
            status = {"_source": "unavailable", "_stale": True}
        except ValueError:
            status = {"_source": "error", "_stale": True}

        items.append({
            "id": str(card.id),
            "card_pan": card.card_pan,
            "region": card.region,
            "ticket_description": card.ticket_description,
            "is_replenishable": card.is_replenishable,
            "is_social_card": card.is_social_card,
            "is_online_card": card.is_online_card,
            "is_roaming_allowed": card.is_roaming_allowed,
            "status": status,
        })

    return {"cards": items}


@router.post("/cards", status_code=201)
async def add_card(
    req: AddCardRequest,
    user: User = Depends(get_max_user),
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    """Добавить карту. Проверяет через Informator API."""

    # Дубликат?
    existing = await db.execute(
        select(Card).where(
            Card.user_id == user.id,
            Card.card_pan == req.card_pan,
            Card.is_active == True,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Эта карта уже добавлена")

    # Проверяем в Короне
    korona = KoronaInformator(db, redis)
    try:
        data = await korona.get_card_info(req.card_pan, force=True)
    except KoronaError as e:
        raise HTTPException(e.http_status, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))

    # Парсим ответ
    ci = data.get("card_info") or {}
    tr = data.get("ticket_rule") or {}

    card = Card(
        user_id=user.id,
        card_pan=req.card_pan,
        card_sn=ci.get("card_sn"),
        card_type=ci.get("card_type"),
        card_img_uri=ci.get("card_img_uri"),
        region=ci.get("region"),
        is_social_card=ci.get("is_social_card", False),
        is_online_card=ci.get("is_online_card", False),
        is_replenishable=ci.get("is_replenishable", False),
        is_money_replenishable=ci.get("is_money_replenishable", False),
        is_roaming_allowed=ci.get("is_roaming_allowed", False),
        ticket_description=tr.get("description"),
    )
    db.add(card)
    await db.commit()
    await db.refresh(card)

    # Сохраняем снимок для fallback
    await korona.save_card_snapshot(card, data)

    log.info("Card added: %s for user %s", req.card_pan[:8] + "...", user.id)

    return {
        "id": str(card.id),
        "card_pan": card.card_pan,
        "region": card.region,
        "ticket_description": card.ticket_description,
        "status": data,
    }


@router.get("/cards/{card_id}/info")
async def get_card_info(
    card_id: str,
    force: bool = Query(False),
    user: User = Depends(get_max_user),
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    """Полная информация о карте (баланс, услуги, статус)."""
    card = await _get_user_card(db, user.id, card_id)
    korona = KoronaInformator(db, redis)

    try:
        data = await korona.get_card_info(card.card_pan, force=force)

        # Обновляем снимок при свежих данных
        if data.get("_source") == "korona":
            await korona.save_card_snapshot(card, data)

        return data
    except KoronaError as e:
        raise HTTPException(e.http_status, str(e))


@router.get("/cards/{card_id}/trips")
async def get_trips(
    card_id: str,
    page: int = Query(0, ge=0),
    size: int = Query(20, ge=1, le=50),
    user: User = Depends(get_max_user),
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    """История поездок по карте."""
    card = await _get_user_card(db, user.id, card_id)
    korona = KoronaInformator(db, redis)

    try:
        return await korona.get_trips(card.card_pan, page=page, size=size)
    except KoronaError as e:
        raise HTTPException(e.http_status, str(e))


@router.get("/cards/{card_id}/replenishments")
async def get_replenishments(
    card_id: str,
    page: int = Query(0, ge=0),
    size: int = Query(20, ge=1, le=50),
    user: User = Depends(get_max_user),
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    """История пополнений по карте."""
    card = await _get_user_card(db, user.id, card_id)
    korona = KoronaInformator(db, redis)

    try:
        return await korona.get_replenishments(card.card_pan, page=page, size=size)
    except KoronaError as e:
        raise HTTPException(e.http_status, str(e))


@router.delete("/cards/{card_id}")
async def delete_card(
    card_id: str,
    user: User = Depends(get_max_user),
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
):
    """Удалить карту (soft delete)."""
    card = await _get_user_card(db, user.id, card_id)
    card.is_active = False
    await db.commit()

    # Чистим кэш
    korona = KoronaInformator(db, redis)
    await korona.invalidate_cache(card.card_pan)

    return {"deleted": True}


@router.get("/health")
async def health():
    return {"status": "ok", "stage": 1}


# ─── Helpers ───

async def _get_user_card(db: AsyncSession, user_id: int, card_id: str) -> Card:
    result = await db.execute(
        select(Card).where(
            Card.id == card_id,
            Card.user_id == user_id,
            Card.is_active == True,
        )
    )
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(404, "Карта не найдена")
    return card


# ─── Ticket config (из .env) ───

@router.get("/config/tickets")
async def get_ticket_config():
    """Конфиг типов карт из переменных окружения."""
    s = get_settings()
    return {
        "purse": [x.strip() for x in (s.ticket_purse or "").split(",") if x.strip()],
        "pack": [x.strip() for x in (s.ticket_pack or "").split(",") if x.strip()],
        "abonement": [x.strip() for x in (s.ticket_abonement or "").split(",") if x.strip()],
        "social": [x.strip() for x in (s.ticket_social or "").split(",") if x.strip()],
        "can_pay": [x.strip() for x in (s.can_pay or "").split(",") if x.strip()],
    }


