"""
Эндпоинты оплаты: /api/pay/*
Цикл: available-operations → create invoice (Korona) → pay → confirm
"""
import logging
import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.services.korona_replenisher import KoronaReplenisher, ReplenisherError
from app.models.models import Card, Invoice, User
from app.services.max_auth import get_max_user

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/pay")

_repl: KoronaReplenisher = None


def get_replenisher() -> KoronaReplenisher:
    global _repl
    if _repl is None:
        _repl = KoronaReplenisher()
    return _repl


async def _get_user_card(card_id: str, user_id: int, db: AsyncSession) -> Card:
    result = await db.execute(
        select(Card).where(Card.id == card_id, Card.user_id == user_id, Card.is_active == True)
    )
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(404, "Карта не найдена")
    return card


# ─── Доступные операции ───

@router.get("/cards/{card_id}/operations")
async def get_operations(
    card_id: str,
    user = Depends(get_max_user),
    db: AsyncSession = Depends(get_db),
):
    """Получить доступные операции для карты из Replenisher API."""
    card = await _get_user_card(card_id, user.id, db)
    repl = get_replenisher()
    try:
        data = await repl.get_available_operations(card.card_pan)
        return data
    except ReplenisherError as e:
        raise HTTPException(e.http_status, f"Корона: {e.message}")


# ─── Создание счёта на пополнение баланса ───

class ReplenishRequest(BaseModel):
    amount: int  # копейки
    type: str = "VALUE"  # VALUE или UPTO


@router.post("/cards/{card_id}/replenish")
async def create_replenishment(
    card_id: str,
    body: ReplenishRequest,
    user = Depends(get_max_user),
    db: AsyncSession = Depends(get_db),
):
    """Создать счёт на пополнение баланса в Короне."""
    card = await _get_user_card(card_id, user.id, db)
    repl = get_replenisher()

    try:
        korona_invoice = await repl.create_invoice_replenishment(
            card.card_pan, body.amount, body.type
        )
    except ReplenisherError as e:
        raise HTTPException(e.http_status, f"Корона: {e.message}")

    # Сохраняем invoice в БД
    inv = Invoice(
        user_id=user.id,
        card_id=card.id,
        card_pan=card.card_pan,
        amount=korona_invoice["invoiceAmount"],
        status="CREATED",
        korona_status="CREATED",
        korona_response=korona_invoice,
    )
    db.add(inv)
    await db.commit()
    await db.refresh(inv)

    return {
        "invoice_id": str(inv.id),
        "korona_invoice_id": korona_invoice["invoiceId"],
        "amount": korona_invoice["invoiceAmount"],
        "agent_tx_id": korona_invoice["agentTransactionId"],
        "status": "CREATED",
        "order": korona_invoice.get("order"),
    }


# ─── Создание счёта на покупку услуги ───

class PurchaseRequest(BaseModel):
    service_id: int
    used_counter_amount: int = 0  # доплата из баланса (копейки)


@router.post("/cards/{card_id}/purchase")
async def create_purchase(
    card_id: str,
    body: PurchaseRequest,
    user = Depends(get_max_user),
    db: AsyncSession = Depends(get_db),
):
    """Создать счёт на покупку услуги в Короне."""
    card = await _get_user_card(card_id, user.id, db)
    repl = get_replenisher()

    try:
        korona_invoice = await repl.create_invoice_purchase(
            card.card_pan, body.service_id, body.used_counter_amount
        )
    except ReplenisherError as e:
        raise HTTPException(e.http_status, f"Корона: {e.message}")

    inv = Invoice(
        user_id=user.id,
        card_id=card.id,
        card_pan=card.card_pan,
        amount=korona_invoice["invoiceAmount"],
        service_id=str(body.service_id),
        status="CREATED",
        korona_status="CREATED",
        korona_response=korona_invoice,
    )
    db.add(inv)
    await db.commit()
    await db.refresh(inv)

    return {
        "invoice_id": str(inv.id),
        "korona_invoice_id": korona_invoice["invoiceId"],
        "amount": korona_invoice["invoiceAmount"],
        "agent_tx_id": korona_invoice["agentTransactionId"],
        "status": "CREATED",
        "order": korona_invoice.get("order"),
    }


# ─── Подтверждение оплаты (тестовый режим — без ЮKassa) ───

class ConfirmRequest(BaseModel):
    action: str = "PAID"  # PAID или CANCELED


@router.post("/invoices/{invoice_id}/confirm")
async def confirm_payment(
    invoice_id: str,
    body: ConfirmRequest,
    user = Depends(get_max_user),
    db: AsyncSession = Depends(get_db),
):
    """Подтвердить оплату → отправить PAID в Корону."""
    from uuid import UUID
    result = await db.execute(
        select(Invoice).where(Invoice.id == UUID(invoice_id), Invoice.user_id == user.id)
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(404, "Invoice не найден")

    if inv.status != "CREATED":
        raise HTTPException(400, f"Invoice уже в статусе {inv.status}")

    korona_data = inv.korona_response or {}
    korona_invoice_id = korona_data.get("invoiceId")
    agent_tx_id = korona_data.get("agentTransactionId")

    if not korona_invoice_id:
        raise HTTPException(400, "Нет korona_invoice_id")

    repl = get_replenisher()

    try:
        if body.action == "PAID":
            result_korona = await repl.confirm_invoice(korona_invoice_id, agent_tx_id)
            inv.status = "PAID"
            inv.korona_status = "PAID"
        else:
            result_korona = await repl.cancel_invoice(korona_invoice_id, agent_tx_id)
            inv.status = "CANCELED"
            inv.korona_status = "CANCELED"

        inv.korona_response = result_korona
    except ReplenisherError as e:
        inv.status = "FAILED"
        inv.korona_status = "ERROR"
        inv.error_message = e.message
        await db.commit()
        raise HTTPException(e.http_status, f"Корона: {e.message}")

    await db.commit()
    return {
        "invoice_id": str(inv.id),
        "status": inv.status,
        "korona_status": inv.korona_status,
    }
