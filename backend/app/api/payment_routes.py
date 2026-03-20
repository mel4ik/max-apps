"""
Эндпоинты оплаты: /api/pay/*
Цикл: 
1. GET operations → лимиты с Короны
2. POST replenish/purchase → счёт в Короне + платёж в ЮKassa
3. ЮKassa webhook → подтверждение в Короне
"""
import logging
import uuid as uuid_mod
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.services.korona_replenisher import KoronaReplenisher, ReplenisherError
from app.services.yukassa import YukassaClient, YukassaError
from app.services.max_auth import get_max_user
from app.models.models import Card, Invoice, User

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/pay")

_repl: KoronaReplenisher = None
_yk: YukassaClient = None


def get_replenisher() -> KoronaReplenisher:
    global _repl
    if _repl is None:
        _repl = KoronaReplenisher()
    return _repl


def get_yukassa() -> YukassaClient:
    global _yk
    if _yk is None:
        _yk = YukassaClient()
    return _yk


async def _get_user_card(card_id: str, user_id: int, db: AsyncSession) -> Card:
    result = await db.execute(
        select(Card).where(Card.id == uuid_mod.UUID(card_id), Card.user_id == user_id, Card.is_active == True)
    )
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(404, "Карта не найдена")
    return card


# ═══════════════════════════════════════
# Подтверждение в Короне (с блокировкой)
# ═══════════════════════════════════════

async def _confirm_in_korona(invoice_id, db: AsyncSession) -> Invoice:
    """
    Подтверждает счёт в Короне с SELECT FOR UPDATE.
    Гарантирует что только один запрос (webhook или polling)
    отправит confirm в Корону.
    """
    # Блокируем строку — второй запрос будет ждать
    result = await db.execute(
        select(Invoice)
        .where(Invoice.id == invoice_id)
        .with_for_update()
    )
    inv = result.scalar_one_or_none()
    if not inv:
        return None

    # Уже подтверждён или в терминальном состоянии — ничего не делаем
    if inv.korona_status in ("PAID", "CANCELED", "ERROR"):
        log.info(f"Invoice {inv.id}: Корона уже {inv.korona_status}, пропускаем")
        return inv

    korona_data = inv.korona_response or {}
    korona_invoice_id = korona_data.get("invoiceId")
    agent_tx_id = korona_data.get("agentTransactionId")

    if not korona_invoice_id:
        inv.status = "FAILED"
        inv.error_message = "Нет invoiceId от Короны"
        await db.commit()
        return inv

    repl = get_replenisher()
    try:
        result_korona = await repl.confirm_invoice(korona_invoice_id, agent_tx_id)
        inv.status = "PAID"
        inv.korona_status = "PAID"
        inv.korona_response = result_korona
        inv.error_message = None  # Очищаем ошибку если была
        log.info(f"Invoice {inv.id}: подтверждён в Короне")
    except ReplenisherError as e:
        inv.status = "FAILED"
        inv.korona_status = "ERROR"
        inv.error_message = f"Корона: {e.message}"
        log.error(f"Invoice {inv.id}: ошибка подтверждения в Короне: {e.message}")

    await db.commit()
    return inv


async def _cancel_in_korona(invoice_id, db: AsyncSession) -> Invoice:
    """Отменяет счёт в Короне с блокировкой."""
    result = await db.execute(
        select(Invoice)
        .where(Invoice.id == invoice_id)
        .with_for_update()
    )
    inv = result.scalar_one_or_none()
    if not inv:
        return None

    if inv.korona_status in ("PAID", "CANCELED"):
        return inv

    korona_data = inv.korona_response or {}
    korona_invoice_id = korona_data.get("invoiceId")
    agent_tx_id = korona_data.get("agentTransactionId")

    repl = get_replenisher()
    try:
        result_korona = await repl.cancel_invoice(korona_invoice_id, agent_tx_id)
        inv.korona_status = "CANCELED"
        inv.korona_response = result_korona
    except Exception as e:
        inv.error_message = f"Корона отмена: {str(e)}"
    inv.status = "CANCELED"

    await db.commit()
    return inv


# ─── Доступные операции ───

@router.get("/cards/{card_id}/operations")
async def get_operations(
    card_id: str,
    user=Depends(get_max_user),
    db: AsyncSession = Depends(get_db),
):
    card = await _get_user_card(card_id, user.id, db)
    repl = get_replenisher()
    try:
        return await repl.get_available_operations(card.card_pan)
    except ReplenisherError as e:
        raise HTTPException(e.http_status, f"Корона: {e.message}")


# ─── Пополнение баланса ───

class ReplenishRequest(BaseModel):
    amount: int  # копейки
    type: str = "VALUE"
    email: Optional[str] = None  # email для чека (необязательно)


@router.post("/cards/{card_id}/replenish")
async def create_replenishment(
    card_id: str,
    body: ReplenishRequest,
    user=Depends(get_max_user),
    db: AsyncSession = Depends(get_db),
):
    card = await _get_user_card(card_id, user.id, db)
    repl = get_replenisher()
    yk = get_yukassa()

    # 1. Создаём счёт в Короне
    try:
        korona_invoice = await repl.create_invoice_replenishment(
            card.card_pan, body.amount, body.type
        )
    except ReplenisherError as e:
        raise HTTPException(e.http_status, f"Корона: {e.message}")

    invoice_amount = korona_invoice["invoiceAmount"]

    # 2. Создаём платёж в ЮKassa
    try:
        yk_payment = await yk.create_payment(
            amount_kopecks=invoice_amount,
            description=f"Пополнение ЕТК ····{card.card_pan[-4:]}",
            metadata={
                "korona_invoice_id": str(korona_invoice["invoiceId"]),
                "agent_tx_id": korona_invoice["agentTransactionId"],
                "card_pan": card.card_pan,
            },
            customer_email=body.email,
        )
    except YukassaError as e:
        # Отменяем счёт в Короне
        try:
            await repl.cancel_invoice(
                korona_invoice["invoiceId"],
                korona_invoice["agentTransactionId"],
            )
        except Exception:
            pass
        raise HTTPException(e.status, f"ЮKassa: {e.message}")

    # 3. Сохраняем в БД
    inv = Invoice(
        user_id=user.id,
        card_id=card.id,
        card_pan=card.card_pan,
        amount=invoice_amount,
        service_desc=f"Пополнение ЕТК ····{card.card_pan[-4:]}",
        status="PENDING",
        yukassa_id=yk_payment["payment_id"],
        yukassa_status=yk_payment["status"],
        korona_status="CREATED",
        korona_response=korona_invoice,
    )
    db.add(inv)
    await db.commit()
    await db.refresh(inv)

    return {
        "invoice_id": str(inv.id),
        "payment_url": yk_payment.get("confirmation_url"),
        "confirmation_token": yk_payment.get("confirmation_token"),
        "amount": invoice_amount,
        "status": "PENDING",
    }


# ─── Покупка услуги ───

class PurchaseRequest(BaseModel):
    service_id: int
    used_counter_amount: int = 0
    email: Optional[str] = None  # email для чека (необязательно)


@router.post("/cards/{card_id}/purchase")
async def create_purchase(
    card_id: str,
    body: PurchaseRequest,
    user=Depends(get_max_user),
    db: AsyncSession = Depends(get_db),
):
    card = await _get_user_card(card_id, user.id, db)
    repl = get_replenisher()
    yk = get_yukassa()

    # 1. Счёт в Короне
    try:
        korona_invoice = await repl.create_invoice_purchase(
            card.card_pan, body.service_id, body.used_counter_amount
        )
    except ReplenisherError as e:
        raise HTTPException(e.http_status, f"Корона: {e.message}")

    invoice_amount = korona_invoice["invoiceAmount"]

    # 2. Платёж в ЮKassa
    try:
        yk_payment = await yk.create_payment(
            amount_kopecks=invoice_amount,
            description=f"Покупка услуги ЕТК ····{card.card_pan[-4:]}",
            metadata={
                "korona_invoice_id": str(korona_invoice["invoiceId"]),
                "agent_tx_id": korona_invoice["agentTransactionId"],
                "card_pan": card.card_pan,
                "service_id": str(body.service_id),
            },
            customer_email=body.email,
        )
    except YukassaError as e:
        try:
            await repl.cancel_invoice(
                korona_invoice["invoiceId"],
                korona_invoice["agentTransactionId"],
            )
        except Exception:
            pass
        raise HTTPException(e.status, f"ЮKassa: {e.message}")

    # 3. БД
    inv = Invoice(
        user_id=user.id,
        card_id=card.id,
        card_pan=card.card_pan,
        amount=invoice_amount,
        service_id=str(body.service_id),
        service_desc=f"Покупка услуги ЕТК ····{card.card_pan[-4:]}",
        status="PENDING",
        yukassa_id=yk_payment["payment_id"],
        yukassa_status=yk_payment["status"],
        korona_status="CREATED",
        korona_response=korona_invoice,
    )
    db.add(inv)
    await db.commit()
    await db.refresh(inv)

    return {
        "invoice_id": str(inv.id),
        "payment_url": yk_payment.get("confirmation_url"),
        "confirmation_token": yk_payment.get("confirmation_token"),
        "amount": invoice_amount,
        "status": "PENDING",
    }


# ─── ЮKassa Webhook ───

@router.post("/webhook/yukassa")
async def yukassa_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    ЮKassa webhook → верификация через API → подтверждение/отмена в Короне.
    Безопасность: не доверяем данным из webhook напрямую,
    перепроверяем статус платежа через GET /v3/payments/{id}.
    """
    body = await request.json()
    event = body.get("event", "")
    payment = body.get("object", {})
    payment_id = payment.get("id")

    log.info(f"YuKassa webhook: event={event}, payment_id={payment_id}")

    if not payment_id:
        return {"ok": True}

    # Ищем invoice по yukassa_id
    result = await db.execute(
        select(Invoice).where(Invoice.yukassa_id == payment_id)
    )
    inv = result.scalar_one_or_none()
    if not inv:
        log.warning(f"YuKassa webhook: invoice not found for payment {payment_id}")
        return {"ok": True}

    # Уже в терминальном состоянии — пропускаем
    if inv.status in ("PAID", "CANCELED", "FAILED"):
        log.info(f"Invoice {inv.id}: уже {inv.status}, пропуск webhook")
        return {"ok": True}

    # ВЕРИФИКАЦИЯ: перепроверяем статус через API ЮKassa
    # Не доверяем данным из webhook — они могут быть подделаны
    yk = get_yukassa()
    try:
        yk_data = await yk.get_payment(payment_id)
        status = yk_data.get("status")
        log.info(f"YuKassa verified: payment={payment_id}, status={status}")
    except Exception as e:
        log.error(f"YuKassa verify failed for {payment_id}: {e}")
        return {"ok": True}

    # Обновляем статус ЮKassa
    inv.yukassa_status = status
    await db.commit()

    if status == "succeeded":
        await _confirm_in_korona(inv.id, db)
    elif status in ("canceled", "cancelled"):
        await _cancel_in_korona(inv.id, db)

    return {"ok": True}


# ─── Проверка статуса платежа (polling с фронтенда) ───

@router.get("/invoices/{invoice_id}/status")
async def check_invoice_status(
    invoice_id: str,
    user=Depends(get_max_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Invoice).where(Invoice.id == uuid_mod.UUID(invoice_id), Invoice.user_id == user.id)
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(404, "Invoice не найден")

    # Если ещё PENDING — проверяем в ЮKassa
    if inv.status == "PENDING" and inv.yukassa_id:
        yk = get_yukassa()
        try:
            yk_data = await yk.get_payment(inv.yukassa_id)
            yk_status = yk_data.get("status")
            inv.yukassa_status = yk_status
            await db.commit()

            if yk_status == "succeeded" and inv.korona_status == "CREATED":
                # Webhook не пришёл, подтверждаем через lock
                inv = await _confirm_in_korona(inv.id, db)

            elif yk_status in ("canceled", "cancelled"):
                inv = await _cancel_in_korona(inv.id, db)

        except Exception as e:
            log.warning(f"YuKassa check error: {e}")

    return {
        "invoice_id": str(inv.id),
        "status": inv.status,
        "yukassa_status": inv.yukassa_status,
        "korona_status": inv.korona_status,
        "amount": inv.amount,
    }
