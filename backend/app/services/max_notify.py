"""
Отправка push-уведомлений пользователю через MAX Bot API.
"""
import logging
import httpx
from app.core.config import get_settings

log = logging.getLogger(__name__)

MAX_API_BASE = "https://platform-api.max.ru"


async def send_message(chat_id: str, text: str):
    """Отправить сообщение пользователю через MAX Bot."""
    s = get_settings()
    if not s.max_bot_token:
        log.warning("MAX_BOT_TOKEN not set, skip notification")
        return False

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                f"{MAX_API_BASE}/messages",
                json={
                    "chat_id": chat_id,
                    "text": text,
                },
                headers={
                    "Authorization": f"Bearer {s.max_bot_token}",
                    "Content-Type": "application/json",
                },
                params={"access_token": s.max_bot_token},
            )
            if r.status_code == 200:
                log.info("MAX notification sent to chat=%s", chat_id)
                return True
            else:
                log.warning("MAX notify failed: %s %s", r.status_code, r.text[:200])
                return False
    except Exception as e:
        log.error("MAX notify error: %s", e)
        return False


def format_payment_success(amount_kopecks: int, card_pan: str, region: str, is_service: bool = False) -> str:
    """Форматирует уведомление об успешной оплате."""
    amount_rub = amount_kopecks / 100
    pan_fmt = card_pan.replace(r'(.{4})', '$1 ').strip() if card_pan else '—'
    # Форматируем PAN вручную
    pan_fmt = ' '.join([card_pan[i:i+4] for i in range(0, len(card_pan), 4)]) if card_pan else '—'

    if is_service:
        return (
            f"\u2705 \u0423\u0441\u043b\u0443\u0433\u0430 \u043f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u0430!\n\n"
            f"\ud83d\udcb0 {amount_rub:.0f} \u20bd\n"
            f"\ud83d\udcb3 {pan_fmt}\n"
            f"\ud83d\udccd {region or ''}\n\n"
            f"\u0411\u0430\u043b\u0430\u043d\u0441 \u043e\u0431\u043d\u043e\u0432\u043b\u0451\u043d."
        )
    else:
        return (
            f"\u2705 \u041f\u043e\u043f\u043e\u043b\u043d\u0435\u043d\u0438\u0435 \u043f\u0440\u043e\u0448\u043b\u043e!\n\n"
            f"\ud83d\udcb0 +{amount_rub:.0f} \u20bd \u043d\u0430 \u043a\u0430\u0440\u0442\u0443\n"
            f"\ud83d\udcb3 {pan_fmt}\n"
            f"\ud83d\udccd {region or ''}\n\n"
            f"\u0411\u0430\u043b\u0430\u043d\u0441 \u043e\u0431\u043d\u043e\u0432\u043b\u0451\u043d."
        )


def format_payment_failed(amount_kopecks: int, card_pan: str, error: str = None) -> str:
    """Форматирует уведомление об ошибке оплаты."""
    amount_rub = amount_kopecks / 100
    pan_fmt = ' '.join([card_pan[i:i+4] for i in range(0, len(card_pan), 4)]) if card_pan else '—'

    text = (
        f"\u274c \u041e\u043f\u043b\u0430\u0442\u0430 \u043d\u0435 \u043f\u0440\u043e\u0448\u043b\u0430\n\n"
        f"\ud83d\udcb0 {amount_rub:.0f} \u20bd\n"
        f"\ud83d\udcb3 {pan_fmt}\n"
    )
    if error:
        text += f"\n\u26a0\ufe0f {error}"
    return text
