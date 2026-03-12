"""
Админ-панель: /api/admin/*
Авторизация через login + password + secret_key (Basic Auth + header).
"""
import logging
import secrets
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header, Request
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from app.core.database import get_db
from app.core.config import get_settings
from app.models.models import User, Card, CardSnapshot

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin")
security = HTTPBasic()


def verify_admin(
    credentials: HTTPBasicCredentials = Depends(security),
    x_secret_key: str = Header(None, alias="X-Secret-Key"),
):
    s = get_settings()
    if not s.admin_password:
        raise HTTPException(503, "Admin not configured")

    ok_user = secrets.compare_digest(credentials.username, s.admin_login)
    ok_pass = secrets.compare_digest(credentials.password, s.admin_password)
    ok_key = secrets.compare_digest(x_secret_key or "", s.admin_secret_key) if s.admin_secret_key else True

    if not (ok_user and ok_pass and ok_key):
        raise HTTPException(401, "Invalid credentials",
                            headers={"WWW-Authenticate": "Basic"})
    return credentials.username


@router.get("/stats")
async def admin_stats(
    admin: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    users_count = (await db.execute(func.count(User.id))).scalar()
    cards_count = (await db.execute(
        select(func.count(Card.id)).where(Card.is_active == True)
    )).scalar()
    return {
        "users": users_count,
        "cards": cards_count,
        "admin": admin,
    }


@router.get("/users")
async def admin_users(
    admin: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
    offset: int = 0,
):
    result = await db.execute(
        select(User).order_by(desc(User.last_seen)).offset(offset).limit(limit)
    )
    users = result.scalars().all()
    return {"users": [{
        "id": u.id,
        "first_name": u.first_name,
        "last_name": u.last_name,
        "username": u.username,
        "created_at": str(u.created_at),
        "last_seen": str(u.last_seen),
    } for u in users]}


@router.get("/users/{user_id}/cards")
async def admin_user_cards(
    user_id: int,
    admin: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Card).where(Card.user_id == user_id).order_by(Card.created_at)
    )
    cards = result.scalars().all()
    return {"cards": [{
        "id": str(c.id),
        "card_pan": c.card_pan,
        "region": c.region,
        "ticket_description": c.ticket_description,
        "is_replenishable": c.is_replenishable,
        "is_active": c.is_active,
        "created_at": str(c.created_at),
    } for c in cards]}


@router.get("/cards")
async def admin_all_cards(
    admin: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
    limit: int = 100,
    offset: int = 0,
):
    result = await db.execute(
        select(Card).order_by(desc(Card.created_at)).offset(offset).limit(limit)
    )
    cards = result.scalars().all()
    return {"cards": [{
        "id": str(c.id),
        "user_id": c.user_id,
        "card_pan": c.card_pan,
        "region": c.region,
        "ticket_description": c.ticket_description,
        "is_replenishable": c.is_replenishable,
        "is_active": c.is_active,
        "created_at": str(c.created_at),
    } for c in cards]}


@router.get("/logs")
async def admin_logs(
    admin: str = Depends(verify_admin),
    lines: int = 100,
):
    """Последние строки лога бэкенда."""
    import subprocess
    try:
        result = subprocess.run(
            ["tail", "-n", str(min(lines, 500)), "/proc/1/fd/1"],
            capture_output=True, text=True, timeout=5
        )
        return {"lines": result.stdout.split("\n")}
    except Exception:
        return {"lines": ["Log unavailable"]}


from app.models.models import Invoice


@router.get("/invoices")
async def admin_invoices(
    admin: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
):
    q = select(Invoice).order_by(desc(Invoice.created_at))
    if status:
        q = q.where(Invoice.status == status)
    result = await db.execute(q.offset(offset).limit(limit))
    invoices = result.scalars().all()
    return {"invoices": [{
        "id": str(i.id),
        "user_id": i.user_id,
        "card_pan": i.card_pan,
        "amount": i.amount,
        "service_id": i.service_id,
        "service_desc": i.service_desc,
        "status": i.status,
        "yukassa_id": i.yukassa_id,
        "yukassa_status": i.yukassa_status,
        "korona_status": i.korona_status,
        "error_message": i.error_message,
        "created_at": str(i.created_at),
        "updated_at": str(i.updated_at),
    } for i in invoices]}


@router.post("/invoices/{invoice_id}/status")
async def admin_update_invoice(
    invoice_id: str,
    body: dict,
    admin: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    from uuid import UUID
    result = await db.execute(
        select(Invoice).where(Invoice.id == UUID(invoice_id))
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(404, "Invoice not found")
    if "status" in body:
        inv.status = body["status"]
    if "korona_status" in body:
        inv.korona_status = body["korona_status"]
    if "error_message" in body:
        inv.error_message = body["error_message"]
    await db.commit()
    return {"ok": True}
