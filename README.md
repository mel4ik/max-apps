# Часпик Транспорт Lite

Мини-приложение для мессенджера MAX. Управление транспортными картами ЕТК, пополнение баланса и покупка услуг через API «Корона Информатор» + «Корона Replenisher» + ЮKassa.

**Домен:** `https://app.tkpay.ru`
**Админка:** `https://app.tkpay.ru/admin`
**Репозиторий:** `https://github.com/mel4ik/max-apps`

---

## Архитектура
```
[MAX мессенджер]
      ↓ WebApp Bridge (initData → HMAC-SHA256)
[Фронтенд React/Vite — nginx :3000]
      ↓ /api/*
[Бэкенд FastAPI :8000]
      ↓                          ↓                        ↓
[Корона Informator]    [Корона Replenisher]       [ЮKassa API]
 tcard-info/1.0         card-replenisher/1.0       api.yookassa.ru
 (баланс, поездки)      (пополнение, mTLS :2505)   (embedded widget)
      ↓
[PostgreSQL :5432]  [Redis :6379]
```

## Стек

| Компонент | Технология |
|-----------|-----------|
| Фронтенд | React 18 + Vite, CSS-переменные, адаптивная тема, Manrope |
| Оплата | ЮKassa embedded widget (confirmation_token) |
| Бэкенд | FastAPI + SQLAlchemy async + Pydantic |
| БД | PostgreSQL 16 |
| Кэш | Redis 7 (отключён, TTL=0) |
| Корона | Informator API + Replenisher API (mTLS) |
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
│       ├── main.py
│       ├── core/
│       │   ├── config.py        ← Settings из .env
│       │   ├── database.py      ← AsyncSession PostgreSQL
│       │   └── redis.py
│       ├── api/
│       │   ├── routes.py        ← /api/cards, /api/config/tickets
│       │   ├── payment_routes.py ← /api/pay/* (оплата)
│       │   └── admin_routes.py  ← /api/admin/* (админка)
│       ├── models/
│       │   └── models.py        ← User, Card, CardSnapshot, Invoice
│       └── services/
│           ├── korona_informator.py  ← Informator API + Keycloak
│           ├── korona_replenisher.py ← Replenisher API (mTLS)
│           ├── yukassa.py            ← ЮKassa API (embedded)
│           ├── max_notify.py         ← MAX Bot уведомления (заготовка)
│           └── max_auth.py           ← Валидация X-Max-Init-Data
└── frontend/
    ├── Dockerfile               ← npm install (НЕ npm ci!)
    ├── nginx.conf               ← /api/ proxy, no-cache headers
    ├── index.html               ← MAX SDK + ЮKassa Widget SDK
    └── src/
        ├── main.jsx             ← / → App, /admin → AdminPage
        ├── App.jsx              ← Экраны: cards/add/det/top/buy/pay
        ├── api/
        │   ├── client.js        ← API + parseCardStatus + translateOp + pay API
        │   ├── helpers.js       ← fk(), sd(), ft()
        │   └── ticketConfig.js  ← Конфиг типов из /api/config/tickets
        ├── components/
        │   ├── Shared.jsx       ← Box, BackBtn (CSS-переменные)
        │   └── DeleteCardBtn.jsx
        ├── hooks/
        │   └── useMaxBridge.js
        └── pages/
            ├── CardList.jsx     ← Список карт (адаптивная тема, анимации)
            ├── AddCard.jsx      ← Добавление (^9643, QR)
            ├── CardDetail.jsx   ← Детали + операции + удаление
            ├── TopUp.jsx        ← Пополнение (лимиты с Короны, пресеты + ввод)
            ├── BuyService.jsx   ← Покупка услуг (из Replenisher API)
            ├── YooKassa.jsx     ← Виджет оплаты + polling + результат
            └── AdminPage.jsx    ← Админка (фильтры, поиск, все поля invoice)
```

---

## Цикл оплаты

### Пополнение баланса (purse, social)
```
1. Фронтенд: GET /api/pay/cards/{id}/operations
   → Replenisher: available-operations → лимиты min/max
2. Пользователь выбирает сумму (пресеты или ввод)
3. Фронтенд: POST /api/pay/cards/{id}/replenish { amount }
   → Бэкенд → Корона: POST invoices/one-click → invoiceId
   → Бэкенд → ЮKassa: POST /v3/payments { embedded } → confirmation_token
   → Invoice в БД (PENDING)
4. Фронтенд рендерит ЮKassa Widget с token
5. Пользователь оплачивает (карта/СБП/SberPay/T-Pay)
6. ЮKassa webhook → POST /api/pay/webhook/yukassa
   → Бэкенд → Корона: PUT invoices/{id}/status → PAID
   → Invoice → PAID
7. Фронтенд polling → "Баланс пополнен!" / "Услуга подключена!"
```

### Покупка услуги (pack, abonement)
```
1. GET /api/pay/cards/{id}/operations → список services
2. Пользователь выбирает услугу
3. POST /api/pay/cards/{id}/purchase { service_id }
4-7. Аналогично пополнению
```

---

## API эндпоинты

### Пользовательские (X-Max-Init-Data)

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/cards` | Список карт |
| POST | `/api/cards` | Добавить карту |
| DELETE | `/api/cards/{id}` | Удалить (soft delete) |
| GET | `/api/cards/{id}/info?force=` | Данные с Короны |
| GET | `/api/cards/{id}/trips` | Поездки |
| GET | `/api/cards/{id}/replenishments` | Пополнения |
| GET | `/api/config/tickets` | Конфиг типов из .env |

### Оплата (X-Max-Init-Data)

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/pay/cards/{id}/operations` | Доступные операции (Replenisher) |
| POST | `/api/pay/cards/{id}/replenish` | Создать счёт на пополнение |
| POST | `/api/pay/cards/{id}/purchase` | Создать счёт на покупку услуги |
| GET | `/api/pay/invoices/{id}/status` | Статус платежа (polling) |
| POST | `/api/pay/webhook/yukassa` | Webhook ЮKassa |

### Админка (Basic Auth + X-Secret-Key)

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/admin/stats` | Статистика |
| GET | `/api/admin/users` | Пользователи |
| GET | `/api/admin/cards` | Все карты |
| GET | `/api/admin/invoices?status=` | Платежи (фильтр по статусу) |
| POST | `/api/admin/invoices/{id}/status` | Изменить статус |

---

## Конфигурация (.env)

### Типы карт
```env
TICKET_PURSE=0110
TICKET_PACK=0111,0112,0191,0192,0194,1196,0195,1098,1096,1094,1113,1114,0297,1056
TICKET_ABONEMENT=0300
TICKET_SOCIAL=1156
CAN_PAY=0110,1156           # Кому разрешено пополнение
```

### Правила по типу

| Тип | Баланс | Поездки | Даты | Оплата | payType |
|-----|--------|---------|------|--------|---------|
| purse | ✅ | — | — | Свободная сумма | replenish |
| pack | — | ✅ | — | Пакетами (serviceId) | service |
| abonement | — | — | С/По или "Нет активных услуг" | Покупка услуг | service |
| social | ✅ | ✅ | — | Свободная сумма | replenish |

### ЮKassa
```env
YUKASSA_SHOP_ID=***
YUKASSA_SECRET_KEY=***
YUKASSA_RETURN_URL=https://app.tkpay.ru
YUKASSA_RECEIPT_ENABLED=false  # true на проде для чеков 54-ФЗ
```
**Webhook URL:** `https://app.tkpay.ru/api/pay/webhook/yukassa`
**События:** `payment.succeeded`, `payment.canceled`

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

### Кэш (отключён)
```env
CACHE_TTL_CARD=0
CACHE_TTL_TRIPS=0
CACHE_TTL_REPLS=0
```

### Админка
```env
ADMIN_LOGIN=admin
ADMIN_PASSWORD=***
ADMIN_SECRET_KEY=***
```

### MAX Bot
```env
MAX_BOT_TOKEN=***  # Для будущих push-уведомлений
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

## БД

| Таблица | Описание |
|---------|----------|
| users | Пользователи MAX |
| cards | Привязанные карты |
| card_snapshots | Кэш Короны (fallback) |
| trips | Кэш поездок |
| replenishments | Кэш пополнений |
| invoices | Заказы: yukassa + korona статусы + ошибки |

---

## Команды
```bash
# Пересборка фронтенда
docker compose build --no-cache frontend && docker compose up -d frontend

# Пересборка бэкенда
docker compose build --no-cache backend && docker compose up -d backend

# Полный рестарт
docker compose down && docker compose up -d

# Обновить конфиг — без пересборки
docker compose restart backend

# Логи
docker compose logs --tail=50 backend

# Очистить Redis
docker compose exec redis redis-cli FLUSHALL
```

---

## ✅ Сделано

- [x] Бэкенд FastAPI + PostgreSQL + Redis
- [x] Авторизация MAX Bridge (HMAC-SHA256)
- [x] Добавление / удаление карт
- [x] Типы карт из .env (purse/pack/abonement/social)
- [x] CAN_PAY — контроль пополнения
- [x] Абонемент из extra_services или "Нет активных услуг"
- [x] Перевод операций на русский
- [x] Пополнение через Корона Replenisher API (mTLS)
- [x] Покупка услуг через Replenisher API
- [x] Оплата ЮKassa embedded widget (карта, СБП, SberPay, T-Pay)
- [x] Webhook ЮKassa → автоподтверждение в Короне
- [x] Polling статуса + экран результата
- [x] Кэш отключён (TTL=0) — всегда свежие данные
- [x] Адаптивная тема (светлая/тёмная)
- [x] CSS-переменные + анимации
- [x] Админка /admin (логин + пароль + secret_key)
- [x] Платежи в админке: полные данные, фильтры, поиск
- [x] Receipt 54-ФЗ (флаг YUKASSA_RECEIPT_ENABLED)
- [x] MAX Bot token интеграция (заготовка для push)
- [x] Docker Compose + SSL + app.tkpay.ru

## 🔜 В планах

- [ ] Push-уведомления через MAX Bot (когда решится chat_id)
- [ ] Полировка дизайна всех экранов
- [ ] Автоплатёж
- [ ] Логирование запросов Короны в админке
- [ ] Статистика платежей в админке (графики)
