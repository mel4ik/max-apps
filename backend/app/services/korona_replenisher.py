# backend/app/services/korona_replenisher.py
"""
Сервис пополнения и продажи услуг v1.5.
mTLS авторизация (клиентский сертификат).
Порт 2505.

Поток:
1. GET  /cards/transport/{pan}/available-operations  — доступные операции
2. POST /invoices/one-click                          — создать счёт
3. GET  /invoices/{id}                               — проверить счёт
4. PUT  /invoices/{id}/status                        — PAID / CANCELED
"""

import ssl
import json
import logging
from typing import Optional

import httpx
from app.core.config import get_settings
from app.services.keycloak import get_keycloak

log = logging.getLogger(__name__)
settings = get_settings()


class ReplenishError(Exception):
    def __init__(self, message: str, code: int = 0, http_status: int = 500):
        super().__init__(message)
        self.code = code
        self.http_status = http_status


class KoronaReplenisher:
    def __init__(self):
        self.keycloak = get_keycloak()
        self._http = None

    def _get_http(self) -> httpx.AsyncClient:
        """Создаёт httpx клиент с mTLS."""
        if self._http is None:
            s = settings
            ssl_ctx = ssl.create_default_context(cafile=s.korona_repl_ca_cert)
            ssl_ctx.load_cert_chain(
                certfile=s.korona_repl_client_cert,
                keyfile=s.korona_repl_client_key,
            )
            self._http = httpx.AsyncClient(
                verify=ssl_ctx,
                timeout=15,
            )
        return self._http

    # ═══════════════════════════════════════
    # Доступные операции
    # ═══════════════════════════════════════

    async def get_available_operations(self, pan: str, operation_type: str = None) -> dict:
        """
        GET /cards/transport/{pan}/available-operations
        operation_type: REPLENISHMENT | PURCHASE | None (все)
        """
        params = {}
        if operation_type:
            params["operation_type"] = operation_type

        return await self._api_request(
            "GET",
            "/cards/transport/" + pan + "/available-operations",
            params=params,
        )

    # ═══════════════════════════════════════
    # Создание счёта
    # ═══════════════════════════════════════

    async def create_invoice_replenishment(
        self, pan: str, amount_kopecks: int, replenishment_type: str, agent_tx_id: str
    ) -> dict:
        """
        POST /invoices/one-click — пополнение денежного счётчика.
        replenishment_type: VALUE | UPTO
        amount_kopecks: сумма в копейках
        """
        body = {
            "agentTransactionId": agent_tx_id,
            "order": {
                "orderCards": [{
                    "replenishment": {
                        "amount": amount_kopecks,
                        "type": replenishment_type.upper(),
                    },
                    "transportCard": {"pan": pan},
                }]
            }
        }
        return await self._api_request("POST", "/invoices/one-click", json_body=body)

    async def create_invoice_purchase(
        self, pan: str, service_id: int, agent_tx_id: str, used_counter_amount: int = 0
    ) -> dict:
        """
        POST /invoices/one-click — покупка услуги.
        """
        body = {
            "agentTransactionId": agent_tx_id,
            "order": {
                "orderCards": [{
                    "purchaseItems": [{
                        "serviceId": service_id,
                        "usedCounterAmount": used_counter_amount,
                    }],
                    "transportCard": {"pan": pan},
                }]
            }
        }
        return await self._api_request("POST", "/invoices/one-click", json_body=body)

    # ═══════════════════════════════════════
    # Управление счётом
    # ═══════════════════════════════════════

    async def get_invoice(self, invoice_id: int) -> dict:
        """GET /invoices/{id}"""
        return await self._api_request("GET", "/invoices/" + str(invoice_id))

    async def confirm_invoice(self, invoice_id: int, agent_tx_id: str) -> dict:
        """PUT /invoices/{id}/status → PAID"""
        body = {
            "agentTransactionId": agent_tx_id,
            "invoiceStatus": "PAID",
        }
        return await self._api_request("PUT", "/invoices/" + str(invoice_id) + "/status", json_body=body)

    async def cancel_invoice(self, invoice_id: int, agent_tx_id: str) -> dict:
        """PUT /invoices/{id}/status → CANCELED"""
        body = {
            "agentTransactionId": agent_tx_id,
            "invoiceStatus": "CANCELED",
        }
        return await self._api_request("PUT", "/invoices/" + str(invoice_id) + "/status", json_body=body)

    # ═══════════════════════════════════════
    # Приватные методы
    # ═══════════════════════════════════════

    async def _api_request(self, method: str, path: str, params: dict = None, json_body: dict = None) -> dict:
        """Запрос к Replenishment API с mTLS и Bearer авторизацией."""
        token = await self.keycloak.get_token()
        url = settings.korona_repl_url.rstrip("/") + path
        http = self._get_http()

        headers = {
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

        try:
            if method == "GET":
                resp = await http.get(url, params=params, headers=headers)
            elif method == "POST":
                resp = await http.post(url, headers=headers, json=json_body)
            elif method == "PUT":
                resp = await http.put(url, headers=headers, json=json_body)
            else:
                raise ReplenishError("Unsupported method: " + method)

            # Парсим ответ
            data = {}
            if resp.text:
                try:
                    data = resp.json()
                    # Нормализуем ключи в lowercase (как в вашем коде lower_key)
                    data = self._lower_keys(data)
                except Exception:
                    pass

            if resp.status_code in (200, 201):
                log.info("Replenisher %s %s → %d", method, path, resp.status_code)
                return data

            if resp.status_code == 204:
                return {"status": "ok"}

            # Ошибка
            msg = data.get("message", "Ошибка API пополнения: HTTP " + str(resp.status_code))
            code = data.get("code", 0)
            log.error("Replenisher error: %s %s → %d %s", method, path, resp.status_code, msg)
            raise ReplenishError(msg, code=code, http_status=resp.status_code)

        except httpx.TimeoutException:
            raise ReplenishError("Сервис пополнения не ответил вовремя", http_status=504)
        except httpx.HTTPError as e:
            raise ReplenishError("Ошибка сети: " + str(e), http_status=502)

    @staticmethod
    def _lower_keys(obj):
        """Рекурсивно приводит ключи к lowercase (совместимость с вашим lower_key)."""
        if isinstance(obj, dict):
            return {k.lower(): KoronaReplenisher._lower_keys(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [KoronaReplenisher._lower_keys(i) for i in obj]
        return obj

    async def close(self):
        if self._http:
            await self._http.aclose()
            self._http = None
