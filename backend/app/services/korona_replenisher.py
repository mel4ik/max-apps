"""
Клиент Korona Card-Replenisher API (mTLS, порт 2505).
Документация: Сервис пополнения и продажи услуг v1.5.0

Сценарии:
1. Пополнение баланса (purse): POST invoices/one-click с replenishment
2. Покупка услуги (pack/abonement): POST invoices/one-click с purchaseItems
3. Подтверждение оплаты: PUT invoices/{id}/status → PAID
"""
import logging
import ssl
import uuid
from typing import Optional
import httpx
from app.core.config import get_settings

log = logging.getLogger(__name__)


class ReplenisherError(Exception):
    def __init__(self, code: int, message: str, http_status: int = 500):
        self.code = code
        self.message = message
        self.http_status = http_status
        super().__init__(f"Replenisher error {code}: {message}")


class KoronaReplenisher:
    """Клиент для Korona Card-Replenisher API с mTLS."""

    def __init__(self):
        s = get_settings()
        self.base_url = s.korona_repl_url.rstrip("/")
        self.auth_url = s.korona_auth_url
        self.client_id = s.korona_client_id
        self.client_secret = s.korona_client_secret
        self.username = s.korona_username
        self.password = s.korona_password
        self.timeout = s.korona_timeout

        # mTLS SSL context
        self.ssl_ctx = ssl.create_default_context(cafile=s.korona_repl_ca_cert)
        self.ssl_ctx.load_cert_chain(
            certfile=s.korona_repl_client_cert,
            keyfile=s.korona_repl_client_key,
        )

        self._token: Optional[str] = None

    async def _get_token(self) -> str:
        """Получаем OAuth2 токен через Keycloak (тот же что и для Informator)."""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            r = await client.post(self.auth_url, data={
                "grant_type": "password",
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "username": self.username,
                "password": self.password,
            })
            r.raise_for_status()
            self._token = r.json()["access_token"]
            return self._token

    async def _request(self, method: str, path: str, json_body=None, retry=True):
        """Выполняет запрос к Replenisher API с mTLS."""
        if not self._token:
            await self._get_token()

        url = f"{self.base_url}{path}"
        headers = {
            "Authorization": f"Bearer {self._token}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(verify=self.ssl_ctx, timeout=self.timeout) as client:
            if method == "GET":
                r = await client.get(url, headers=headers)
            elif method == "POST":
                r = await client.post(url, headers=headers, json=json_body)
            elif method == "PUT":
                r = await client.put(url, headers=headers, json=json_body)
            else:
                raise ValueError(f"Unknown method: {method}")

        # Retry on 401 (token expired)
        if r.status_code == 401 and retry:
            await self._get_token()
            return await self._request(method, path, json_body, retry=False)

        data = r.json() if r.content else {}

        if r.status_code >= 400:
            code = data.get("code", r.status_code)
            msg = data.get("message", f"HTTP {r.status_code}")
            log.error(f"Replenisher error: {code} {msg} | {url}")
            raise ReplenisherError(code, msg, r.status_code)

        return data

    # ─── Доступные операции ───

    async def get_available_operations(self, pan: str, operation_type: str = None) -> dict:
        """
        GET /cards/transport/{pan}/available-operations
        operation_type: REPLENISHMENT | PURCHASE | None (оба)
        """
        path = f"/cards/transport/{pan}/available-operations"
        if operation_type:
            path += f"?operation_type={operation_type}"
        return await self._request("GET", path)

    # ─── Создание счёта ───

    async def create_invoice_replenishment(self, pan: str, amount: int, repl_type: str = "VALUE") -> dict:
        """
        Пополнение баланса карты.
        amount — сумма в копейках.
        repl_type — VALUE (на сумму) или UPTO (до суммы).
        """
        agent_tx_id = f"chaspik_{uuid.uuid4().hex[:16]}"
        body = {
            "agentTransactionId": agent_tx_id,
            "order": {
                "orderCards": [{
                    "replenishment": {
                        "amount": amount,
                        "type": repl_type,
                    },
                    "transportCard": {"pan": pan},
                }]
            }
        }
        log.info(f"Creating replenishment invoice: pan={pan}, amount={amount}, type={repl_type}, tx={agent_tx_id}")
        return await self._request("POST", "/invoices/one-click", body)

    async def create_invoice_purchase(self, pan: str, service_id: int, used_counter: int = 0) -> dict:
        """
        Покупка услуги на карту.
        service_id — ID услуги из available-operations.
        used_counter — сумма из баланса карты для доплаты (копейки).
        """
        agent_tx_id = f"chaspik_{uuid.uuid4().hex[:16]}"
        body = {
            "agentTransactionId": agent_tx_id,
            "order": {
                "orderCards": [{
                    "purchaseItems": [{
                        "serviceId": service_id,
                        "usedCounterAmount": used_counter,
                    }],
                    "transportCard": {"pan": pan},
                }]
            }
        }
        log.info(f"Creating purchase invoice: pan={pan}, serviceId={service_id}, tx={agent_tx_id}")
        return await self._request("POST", "/invoices/one-click", body)

    # ─── Управление статусом счёта ───

    async def confirm_invoice(self, invoice_id: int, agent_tx_id: str) -> dict:
        """PUT /invoices/{id}/status → PAID."""
        body = {
            "agentTransactionId": agent_tx_id,
            "invoiceStatus": "PAID",
        }
        log.info(f"Confirming invoice: id={invoice_id}, tx={agent_tx_id}")
        return await self._request("PUT", f"/invoices/{invoice_id}/status", body)

    async def cancel_invoice(self, invoice_id: int, agent_tx_id: str) -> dict:
        """PUT /invoices/{id}/status → CANCELED."""
        body = {
            "agentTransactionId": agent_tx_id,
            "invoiceStatus": "CANCELED",
        }
        log.info(f"Canceling invoice: id={invoice_id}, tx={agent_tx_id}")
        return await self._request("PUT", f"/invoices/{invoice_id}/status", body)

    async def get_invoice(self, invoice_id: int) -> dict:
        """GET /invoices/{id} — получить информацию по счёту."""
        return await self._request("GET", f"/invoices/{invoice_id}")
