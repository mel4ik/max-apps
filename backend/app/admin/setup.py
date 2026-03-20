# backend/app/admin/setup.py
"""
SQLAdmin — Админ-панель Часпик Транспорт.
Полная локализация на русский язык.
"""
import os
import secrets
from sqladmin import Admin, ModelView
from sqladmin.authentication import AuthenticationBackend
from starlette.requests import Request
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.config import get_settings
from app.models.models import User, Card, Invoice


# ═══════════════════════════════════════
# Авторизация
# ═══════════════════════════════════════

class AdminAuth(AuthenticationBackend):
    async def login(self, request: Request) -> bool:
        form = await request.form()
        s = get_settings()
        username = form.get("username", "")
        password = form.get("password", "")

        if not s.admin_password:
            return False

        ok_user = secrets.compare_digest(str(username), str(s.admin_login))
        ok_pass = secrets.compare_digest(str(password), str(s.admin_password))

        if ok_user and ok_pass:
            request.session.update({"admin": username})
            return True
        return False

    async def logout(self, request: Request) -> bool:
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> bool:
        return request.session.get("admin") is not None


# ═══════════════════════════════════════
# Пользователи
# ═══════════════════════════════════════

class UserAdmin(ModelView, model=User):
    name = "Пользователь"
    name_plural = "Пользователи"
    icon = "fa-solid fa-users"

    column_list = [User.id, User.first_name, User.last_name, User.username, User.created_at, User.last_seen]
    column_searchable_list = [User.id, User.username, User.first_name]
    column_sortable_list = [User.id, User.created_at, User.last_seen]
    column_default_sort = ("last_seen", True)

    column_labels = {
        User.id: "ID",
        User.first_name: "Имя",
        User.last_name: "Фамилия",
        User.username: "Username",
        User.created_at: "Регистрация",
        User.last_seen: "Последний визит",
    }

    page_size = 25
    can_create = False
    can_delete = False
    can_edit = False


# ═══════════════════════════════════════
# Карты
# ═══════════════════════════════════════

class CardAdmin(ModelView, model=Card):
    name = "Карта"
    name_plural = "Карты"
    icon = "fa-solid fa-credit-card"

    column_list = [
        Card.user_id, Card.card_pan, Card.region,
        Card.card_type, Card.ticket_description, Card.is_active,
        Card.is_replenishable, Card.is_social_card, Card.created_at,
    ]
    column_searchable_list = [Card.card_pan, Card.region, Card.ticket_description, Card.card_type]
    column_sortable_list = [Card.created_at, Card.user_id, Card.is_active]
    column_default_sort = ("created_at", True)

    column_labels = {
        Card.id: "ID",
        Card.user_id: "Пользователь",
        Card.card_pan: "Номер карты",
        Card.region: "Регион",
        Card.card_type: "Код типа",
        Card.ticket_description: "Тип карты",
        Card.is_active: "Активна",
        Card.is_replenishable: "Пополняемая",
        Card.is_social_card: "Социальная",
        Card.is_online_card: "Онлайн",
        Card.created_at: "Добавлена",
    }

    page_size = 25
    can_create = False
    can_delete = False
    can_edit = False


# ═══════════════════════════════════════
# Платежи
# ═══════════════════════════════════════

class InvoiceAdmin(ModelView, model=Invoice):
    name = "Платёж"
    name_plural = "Платежи"
    icon = "fa-solid fa-file-invoice-dollar"

    column_list = [
        Invoice.user_id, Invoice.card_pan, Invoice.amount,
        Invoice.status, Invoice.yukassa_status, Invoice.korona_status,
        Invoice.service_desc, Invoice.error_message,
        Invoice.created_at, Invoice.updated_at,
    ]
    column_searchable_list = [Invoice.card_pan, Invoice.yukassa_id, Invoice.status]
    column_sortable_list = [Invoice.created_at, Invoice.status, Invoice.user_id, Invoice.amount]
    column_default_sort = ("created_at", True)

    column_labels = {
        Invoice.id: "ID",
        Invoice.user_id: "Пользователь",
        Invoice.card_pan: "Номер карты",
        Invoice.card_id: "ID карты",
        Invoice.amount: "Сумма (коп.)",
        Invoice.service_id: "ID услуги",
        Invoice.service_desc: "Описание услуги",
        Invoice.status: "Статус",
        Invoice.yukassa_id: "ID ЮKassa",
        Invoice.yukassa_status: "Статус ЮKassa",
        Invoice.korona_status: "Статус Корона",
        Invoice.korona_response: "Ответ Короны",
        Invoice.error_message: "Ошибка",
        Invoice.created_at: "Создан",
        Invoice.updated_at: "Обновлён",
    }

    # Редактирование статуса вручную
    can_create = False
    can_delete = False
    can_edit = True
    form_include_pk = False
    form_columns = [Invoice.status, Invoice.korona_status, Invoice.error_message]
    form_args = {
        "status": {"label": "Статус"},
        "korona_status": {"label": "Статус Корона"},
        "error_message": {"label": "Сообщение об ошибке"},
    }

    page_size = 25


# ═══════════════════════════════════════
# Подключение
# ═══════════════════════════════════════

def setup_admin(app, engine: AsyncEngine):
    """Подключает SQLAdmin к FastAPI app."""
    s = get_settings()
    auth_backend = AdminAuth(secret_key=s.secret_key)

    templates_dir = os.path.join(os.path.dirname(__file__), "templates")

    admin = Admin(
        app,
        engine,
        authentication_backend=auth_backend,
        title="Часпик Админ",
        base_url="/admin",
        templates_dir=templates_dir,
    )

    admin.add_view(UserAdmin)
    admin.add_view(CardAdmin)
    admin.add_view(InvoiceAdmin)

    return admin
