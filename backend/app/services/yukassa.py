"""
Клиент ЮKassa API.
Создание платежа → получение confirmation_url → пользователь оплачивает → webhook.
"""
import logging
import uuid
import httpx
from app.core.config import get_settings

log = logging.getLogger(__name__)

YUKASSA_API = "https://api.yookassa.ru/v3"


class YukassaError(Exception):
    def __init__(self, message: str, status: int = 500):
        self.message = message
        self.status = status
        super().__init__(message)


class YukassaClient:

    def __init__(self):
        s = get_settings()
        self.shop_id = s.yukassa_shop_id
        self.secret_key = s.yukassa_secret_key
        self.return_url = s.yukassa_return_url
        self.receipt_email = s.yukassa_receipt_email
        self.receipt_tax = s.yukassa_receipt_tax

    def _auth(self):
        return (self.shop_id, self.secret_key)

    async def create_payment(self, amount_kopecks: int, description: str, metadata: dict = None, customer_email: str = None) -> dict:
        """
        Создаёт платёж в ЮKassa с чеком 54-ФЗ.
        customer_email — email покупателя для чека (если не указан — дефолт из .env)
        """
        amount_rub = f"{amount_kopecks / 100:.2f}"
        idempotency_key = str(uuid.uuid4())
        email = customer_email.strip() if customer_email and customer_email.strip() else self.receipt_email

        body = {
            "amount": {
                "value": amount_rub,
                "currency": "RUB",
            },
            "confirmation": {
                "type": "embedded",
            },
            "capture": True,
            "description": description[:128],
            "receipt": {
                "customer": {
                    "email": email,
                },
                "items": [
                    {
                        "description": description[:128],
                        "quantity": "1.00",
                        "amount": {
                            "value": amount_rub,
                            "currency": "RUB",
                        },
                        "vat_code": int(self.receipt_tax),
                        "payment_subject": "service",
                        "payment_mode": "full_payment",
                    }
                ],
            },
        }
        if metadata:
            body["metadata"] = metadata

        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                f"{YUKASSA_API}/payments",
                json=body,
                auth=self._auth(),
                headers={"Idempotence-Key": idempotency_key},
            )

        if r.status_code not in (200, 201):
            log.error(f"YuKassa error: {r.status_code} {r.text}")
            raise YukassaError(f"ЮKassa: {r.text}", r.status_code)

        data = r.json()
        confirmation_token = None
        confirmation_url = None
        if data.get("confirmation"):
            confirmation_token = data["confirmation"].get("confirmation_token")
            confirmation_url = data["confirmation"].get("confirmation_url")

        log.info(f"YuKassa payment created: id={data['id']}, status={data['status']}")

        return {
            "payment_id": data["id"],
            "status": data["status"],
            "confirmation_token": confirmation_token,
            "confirmation_url": confirmation_url,
            "amount": data["amount"],
        }

    async def get_payment(self, payment_id: str) -> dict:
        """Получить статус платежа."""
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                f"{YUKASSA_API}/payments/{payment_id}",
                auth=self._auth(),
            )
        if r.status_code != 200:
            raise YukassaError(f"ЮKassa: {r.text}", r.status_code)
        return r.json()
