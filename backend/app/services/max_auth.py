# backend/app/services/max_auth.py
"""
Авторизация через MAX Bridge initData.
HMAC-SHA256 проверка подписи.
"""

import hashlib
import hmac
import json
import logging
from urllib.parse import parse_qs, unquote

from fastapi import Header, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import get_settings
from app.core.database import get_db
from app.models.models import User

log = logging.getLogger(__name__)


async def get_max_user(
    x_max_init_data: str = Header(None, alias="X-Max-Init-Data"),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Валидирует initData из MAX Bridge, возвращает/создаёт пользователя."""
    settings = get_settings()

    if not x_max_init_data:
        raise HTTPException(401, "Missing X-Max-Init-Data header")

    params = parse_qs(x_max_init_data)

    def get_param(key):
        vals = params.get(key, [])
        return vals[0] if vals else None

    received_hash = get_param("hash")
    if not received_hash:
        raise HTTPException(401, "Missing hash in init data")

    # Формируем data_check_string
    check_pairs = []
    for key in sorted(params.keys()):
        if key == "hash":
            continue
        check_pairs.append(key + "=" + params[key][0])
    data_check_string = "\n".join(check_pairs)

    # HMAC-SHA256(HMAC-SHA256("WebAppData", bot_token), data_check_string)
    secret_key = hmac.new(
        b"WebAppData",
        settings.max_bot_token.encode(),
        hashlib.sha256,
    ).digest()

    calculated_hash = hmac.new(
        secret_key,
        data_check_string.encode(),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(calculated_hash, received_hash):
        if not settings.debug:
            raise HTTPException(401, "Invalid init data signature")
        log.warning("DEV: skipping MAX signature check")

    # Парсим user
    user_str = get_param("user")
    if not user_str:
        raise HTTPException(401, "Missing user in init data")

    try:
        user_data = json.loads(unquote(user_str))
    except (json.JSONDecodeError, TypeError):
        raise HTTPException(401, "Invalid user data")

    user_id = user_data.get("id")
    if not user_id:
        raise HTTPException(401, "Missing user id")

    # Upsert пользователя
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        user = User(
            id=user_id,
            first_name=user_data.get("first_name"),
            last_name=user_data.get("last_name"),
            username=user_data.get("username"),
            language_code=user_data.get("language_code"),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        log.info("New user created: %s (%s)", user_id, user.first_name)
    else:
        # Обновляем last_seen
        from datetime import datetime
        user.last_seen = datetime.utcnow()
        await db.commit()

    return user
