# Часпик Транспорт Lite

Мини-приложение для мессенджера MAX. Управление транспортными картами ЕТК, пополнение баланса и покупка услуг через API «Корона Информатор» + ЮKassa.

**Домен:** `https://app.tkpay.ru`  
**Админка:** `https://app.tkpay.ru/admin`  
**Репозиторий:** `https://github.com/mel4ik/max-apps`

---

## Архитектура
```
[MAX мессенджер]
      ↓ WebApp Bridge (initData)
[Фронтенд React/Vite — nginx :3000]
      ↓ /api/*
[Бэкенд FastAPI :8000]
      ↓                          ↓                        ↓
[Корона Informator]    [Корона Replenisher]       [ЮKassa API]
 tcard-info/1.0         card-replenisher/1.0       api.yookassa.ru
 (баланс, поездки)      (пополнение, покупка)      (приём платежей)
      ↓ mTLS :2505
[PostgreSQL :5432]  [Redis :6379]
```

## Стек

| Компонент | Технология |
|-----------|-----------|
| Фронтенд | React 18 + Vite, inline styles, Manrope, ЮKassa Widget |
| Бэкенд | FastAPI + SQLAlchemy async + Pydantic |
| БД | PostgreSQL 16 |
| Кэш | Redis 7 |
| Внешний API | Корона Informator (данные карт) + Replenisher (пополнение, mTLS) |
| Оплата | ЮKassa embedded widget (confirmation_token) |
| Авторизация | MAX Bridge initData → HMAC-SHA256 |
| Деплой | Docker Compose, nginx SSL (certbot) |

---

## Структура проекта
```
/opt/chaspik-app/
├── docker-compose.yml
├── .env                         ← ВСЕ настройки
├── README.md
├── certs/                       ← mTLS сертификаты Короны
│   ├── CA_TK_REPLENISHER.crt
│   ├── client_tkpay.crt
│   └── client_tkpay.pem
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py              ← FastAPI app, подключение роутеров
│       ├── core/
│       │   ├── config.py        ← Settings из .env (Pydantic BaseSettings)
│       │   ├── database.py      ← AsyncSession PostgreSQL
│       │   └── redis.py         ← Redis клиент
│       ├── api/
│       │   ├── routes.py        ← Основные эндпоинты (/api/cards, /api/config/tickets)
│       │   ├── payment_routes.py ← Оплата (/api/pay/*)
│       │   └── admin_routes.py  ← Админка (/api/admin/*)
│       ├── models/
│       │   └── models.py        ← User, Card, CardSnapshot, Invoice
│       └── services/
│           ├── korona_informator.py  ← Клиент Informator API + Keycloak
│           ├── korona_replenisher.py ← Клиент Replenisher API (mTLS)
│           ├── yukassa.py            ← Клиент ЮKassa API
│           └── max_auth.py           ← Валидация X-Max-Init-Data
└── frontend/
    ├── Dockerfile               ← ВАЖНО: npm install (НЕ npm ci!)
    ├── nginx.conf               ← /api/ → proxy_pass backend:8000
    ├── package.json
    ├── vite.config.js
    ├── index.html               ← MAX Web App SDK + ЮKassa Widget SDK
    └── src/
        ├── main.jsx             ← Роутинг: / → App, /admin → AdminPage
        ├── App.jsx              ← Навигация (cards/add/det/top/buy/pay)
        ├── api/
        │   ├── client.js        ← API вызовы + parseCardStatus() + translateOp()
        │   ├── helpers.js       ← fk() (копейки→₽), sd(), ft()
        │   └── ticketConfig.js  ← Конфиг типов из /api/config/tickets + resolveKind()
        ├── components/
        │   ├── Shared.jsx       ← Box, BackBtn
        │   └── DeleteCardBtn.jsx ← Удаление с подтверждением
        ├── hooks/
        │   └── useMaxBridge.js  ← WebApp.ready(), BackButton, HapticFeedback
        └── pages/
            ├── CardList.jsx     ← Список карт, cfg-driven
            ├── AddCard.jsx      ← Добавление (19 цифр ^9643, QR-сканер)
            ├── CardDetail.jsx   ← Детали карты + операции + удаление
            ├── TopUp.jsx        ← Пополнение (реальные лимиты с Короны)
            ├── BuyService.jsx   ← Покупка услуг (из Replenisher API)
            ├── YooKassa.jsx     ← ЮKassa виджет + polling + экран результата
            └── AdminPage.jsx    ← Админка (логин/пароль/secret_key)
```

---

## Цикл оплаты

### Пополнение баланса (purse, social)
```
1. GET /api/pay/cards/{id}/operations
   → Корона Replenisher: available-operations (лимиты min/max)
2. POST /api/pay/cards/{id}/replenish { amount, type: "VALUE" }
   → Корона: POST invoices/one-click → invoiceId
   → ЮKassa: POST /v3/payments { embedded } → confirmation_token
   → Invoice сохраняется в БД (status: PENDING)
3. Фронтенд рендерит ЮKassa Widget с confirmation_token
4. Пользователь оплачивает
5. ЮKassa webhook → POST /api/pay/webhook/yukassa
   → Корона: PUT invoices/{id}/status → PAID
   → Invoice обновляется (status: PAID)
6. Фронтенд polling GET /api/pay/invoices/{id}/status → PAID → "Баланс пополнен!"
```

### Покупка услуги (pack, abonement)
```
1. GET /api/pay/cards/{id}/operations
   → Корона: available-operations?operation_type=PURCHASE → список services
2. POST /api/pay/cards/{id}/purchase { service_id }
   → Корона: POST invoices/one-click → invoiceId
   → ЮKassa: POST /v3/payments { embedded } → confirmation_token
3-6. Аналогично пополнению
```

---

## API эндпоинты

### Пользовательские (X-Max-Init-Data)

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/cards` | Список карт пользователя |
| POST | `/api/cards` | Добавить карту `{ card_pan: "9643..." }` |
| DELETE | `/api/cards/{id}` | Удалить карту (soft delete) |
| GET | `/api/cards/{id}/info` | Данные карты из Короны (через кэш) |
| GET | `/api/cards/{id}/trips` | Поездки |
| GET | `/api/cards/{id}/replenishments` | Пополнения |
| GET | `/api/config/tickets` | Конфиг типов карт из .env |

### Оплата (X-Max-Init-Data)

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/pay/cards/{id}/operations` | Доступные операции (Replenisher API) |
| POST | `/api/pay/cards/{id}/replenish` | Создать счёт на пополнение |
| POST | `/api/pay/cards/{id}/purchase` | Создать счёт на покупку услуги |
| GET | `/api/pay/invoices/{id}/status` | Статус платежа (polling) |
| POST | `/api/pay/webhook/yukassa` | Webhook ЮKassa (без авторизации) |

### Админка (Basic Auth + X-Secret-Key)

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/admin/stats` | Статистика |
| GET | `/api/admin/users` | Пользователи |
| GET | `/api/admin/cards` | Все карты |
| GET | `/api/admin/invoices` | Платежи (ЮKassa + Корона статусы) |
| POST | `/api/admin/invoices/{id}/status` | Изменить статус |

---

## Конфигурация (.env)

### Типы карт
```env
TICKET_PURSE=0110           # Кошелёк (баланс ₽, свободная сумма)
TICKET_PACK=0111,0112,...   # Пакеты (поездки, покупка пакетами)
TICKET_ABONEMENT=0300       # Абонемент (срок действия, покупка услуг)
TICKET_SOCIAL=1156          # Социальная (баланс + поездки, пополнение баланса)
CAN_PAY=0110,1156           # Кому разрешено пополнение
```

### Правила отображения

| Тип | Баланс | Поездки | Даты | Пополнение | payType |
|-----|--------|---------|------|------------|---------|
| purse | ✅ | — | окончания | ✅ пресеты + своя сумма | replenish |
| pack | — | ✅ | — | Пакетами (serviceId) | service |
| abonement | — | — | С/По из extra_services или "Нет активных услуг" | Покупка услуг | service |
| social | ✅ | ✅ | сгорания | ✅ пресеты + своя сумма | replenish |

### Логика resolveKind
1. ticket_id в .env конфиге → kind
2. is_social_card → social
3. ticket_type == 1 → abonement
4. ticket_type == 2 → counter
5. ticket_type == 3,4 + extra_services → pack
6. ticket_type == 3,4 → purse

### ЮKassa
```env
YUKASSA_SHOP_ID=***
YUKASSA_SECRET_KEY=***
YUKASSA_RETURN_URL=https://app.tkpay.ru
```
Webhook URL: `https://app.tkpay.ru/api/pay/webhook/yukassa`
События: `payment.succeeded`, `payment.canceled`

### Корона API
```env
KORONA_CLIENT_ID=***
KORONA_CLIENT_SECRET=***
KORONA_USERNAME=***
KORONA_PASSWORD=***
KORONA_INFO_URL=https://trcard.korona.net/api/tcard-info/1.0
KORONA_REPL_URL=https://trcard.korona.net:2505/krasnodar/api/card-replenisher/1.0
KORONA_REPL_CA_CERT=/app/certs/CA_TK_REPLENISHER.crt
KORONA_REPL_CLIENT_CERT=/app/certs/client_tkpay.crt
KORONA_REPL_CLIENT_KEY=/app/certs/client_tkpay.pem
```

### Админка
```env
ADMIN_LOGIN=admin
ADMIN_PASSWORD=***
ADMIN_SECRET_KEY=***
```

---

## Перевод операций

| Код API | Отображение |
|---------|-------------|
| REPLENISHMENT | Пополнение баланса |
| MONEY_TRANSFER | Перевод на карту |
| PURCHASE_TRANSFER | Покупка услуги |
| PURCHASE_WITHDRAWAL | Списание за услугу |
| PURCHASE_WRITE_OFF | Списание за услугу |
| MONEY_WRITE_OFF | Списание средств |
| REFUND | Возврат |

---

## БД (PostgreSQL)

| Таблица | Описание |
|---------|----------|
| users | Пользователи MAX (id, first_name, username, last_seen) |
| cards | Привязанные карты (card_pan, user_id, region, is_active) |
| card_snapshots | Кэш ответов Короны (JSON fallback) |
| trips | Кэш поездок |
| replenishments | Кэш пополнений |
| invoices | Заказы: yukassa_id/status + korona_invoice_id/status + error |

### Кэширование
```
Запрос info → Redis (5 мин) → Корона API → PostgreSQL snapshot → fallback stale
```

---

## Docker Compose
```yaml
services:
  frontend:  порт 3000 (nginx → /api/ proxy на backend)
  backend:   порт 8000 (FastAPI + uvicorn)
  postgres:  порт 5432 (данные в volume)
  redis:     порт 6379
```

### Команды
```bash
# Пересборка фронтенда
docker compose build --no-cache frontend && docker compose up -d frontend

# Пересборка бэкенда
docker compose build --no-cache backend && docker compose up -d backend

# Полный рестарт
docker compose down && docker compose up -d

# Обновить конфиг (типы карт, CAN_PAY) — без пересборки
docker compose restart backend

# Логи
docker compose logs --tail=50 backend
docker compose logs --tail=50 frontend
```

---

## ✅ Сделано

- [x] Бэкенд FastAPI + PostgreSQL + Redis
- [x] Авторизация через MAX Bridge (HMAC-SHA256)
- [x] Добавление/удаление карт
- [x] Отображение карт по типам (purse/pack/abonement/social) из .env
- [x] CAN_PAY — контроль доступа к пополнению
- [x] Абонемент из extra_services.abonement[] или "Нет активных услуг"
- [x] Перевод операций на русский
- [x] Пополнение баланса через Корона Replenisher API (mTLS)
- [x] Покупка услуг (пакеты поездок) через Replenisher API
- [x] Оплата через ЮKassa embedded widget (карта, СБП, SberPay, T-Pay)
- [x] Webhook ЮKassa → автоподтверждение в Короне
- [x] Polling статуса платежа с фронтенда
- [x] Админка /admin с авторизацией
- [x] Таблица invoices (ЮKassa + Корона статусы)
- [x] Docker Compose + SSL + деплой на app.tkpay.ru

## 🔜 В планах

- [ ] Полировка дизайна (анимации, цвета, адаптивность)
- [ ] Push-уведомления через MAX Bot
- [ ] Автоплатёж (повторное пополнение)
- [ ] Фильтры и поиск в админке
- [ ] Логирование запросов/ответов Короны в админке
- [ ] Чеки 54-ФЗ через ЮKassa
