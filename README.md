# Часпик Транспорт Lite

Мини-приложение для мессенджера MAX. Управление транспортными картами ЕТК, пополнение баланса и покупка услуг через API «Корона Информатор» + «Корона Replenisher» + ЮKassa.

**Домен:** `https://app.tkpay.ru`
**Админка:** `https://app.tkpay.ru/admin/` (SQLAdmin)
**Репозиторий:** `https://github.com/mel4ik/max-apps`

---

## Архитектура
```
[MAX мессенджер]
      ↓ WebApp Bridge (initData → HMAC-SHA256)
[Фронтенд React/Vite — nginx :3000]
      ↓ /api/*          ↓ /admin/*
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
| Фронтенд | React 18 + Vite, CSS-переменные (data-theme), адаптивная тема, Manrope |
| Оплата | ЮKassa embedded widget (confirmation_token) |
| Бэкенд | FastAPI + SQLAlchemy async + Pydantic |
| Админка | SQLAdmin 0.20 (Tabler UI), сессионная авторизация |
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
│       ├── main.py              ← FastAPI + SQLAdmin + middleware
│       ├── core/
│       │   ├── config.py        ← Settings из .env
│       │   ├── database.py      ← AsyncSession PostgreSQL
│       │   └── redis.py
│       ├── api/
│       │   ├── routes.py        ← /api/cards, /api/config/tickets
│       │   └── payment_routes.py ← /api/pay/* (оплата, webhook, polling)
│       ├── admin/
│       │   ├── setup.py         ← SQLAdmin: модели, авторизация, локализация
│       │   └── templates/
│       │       └── login.html   ← Русская страница входа
│       ├── models/
│       │   └── models.py        ← User, Card, CardSnapshot, Invoice, Trip, Replenishment
│       └── services/
│           ├── korona_informator.py  ← Informator API + Keycloak
│           ├── korona_replenisher.py ← Replenisher API (mTLS)
│           ├── yukassa.py            ← ЮKassa API (embedded)
│           ├── max_notify.py         ← MAX Bot уведомления (заготовка)
│           └── max_auth.py           ← Валидация X-Max-Init-Data
└── frontend/
    ├── Dockerfile               ← npm install (НЕ npm ci!)
    ├── nginx.conf               ← /api/ + /admin/ proxy, HTTPS headers
    ├── index.html               ← MAX SDK + ЮKassa Widget SDK + ранняя тема
    └── src/
        ├── main.jsx             ← Точка входа → App
        ├── App.jsx              ← Экраны: cards/add/det/top/buy/pay
        ├── api/
        │   ├── client.js        ← API + parseCardStatus + translateOp + pay API
        │   ├── helpers.js       ← fk(), sd(), ft()
        │   └── ticketConfig.js  ← Конфиг типов из /api/config/tickets
        ├── components/
        │   └── Shared.jsx       ← Box, BackBtn (CSS-классы)
        ├── hooks/
        │   └── useMaxBridge.js  ← Тема: MAX SDK → matchMedia → retry → themeChanged
        ├── pages/
        │   ├── CardList.jsx     ← Список карт (CSS-классы, адаптивная тема)
        │   ├── AddCard.jsx      ← Добавление (^9643, QR, CSS-классы)
        │   ├── CardDetail.jsx   ← Детали + операции с пагинацией + табы
        │   ├── TopUp.jsx        ← Пополнение (лимиты с Короны, пресеты + ввод)
        │   ├── BuyService.jsx   ← Покупка услуг (из Replenisher API)
        │   └── YooKassa.jsx     ← Виджет оплаты + polling + результат
        └── styles/
            └── global.css       ← CSS-переменные, data-theme, классы всех компонентов
```

---

## Адаптивная тема (iOS + Android)

Тема определяется через `data-theme` атрибут на `<html>` — **НЕ** через `@media (prefers-color-scheme)`, т.к. iOS WebView в MAX не поддерживает этот медиа-запрос.

### Цепочка определения темы:
1. `WebApp.colorScheme` — MAX SDK прямое значение
2. `WebApp.themeParams.bg_color` — эвристика яркости hex-цвета
3. URL параметр `?theme=light/dark`
4. `matchMedia('prefers-color-scheme')` — системная тема устройства
5. Fallback: `dark`

### Двухуровневая инициализация:
- **index.html** — ранний скрипт до React, предотвращает белую вспышку
- **useMaxBridge.js** — React hook, retry через 100/300/600/1200ms, подписка на `themeChanged` и `matchMedia change`

### Все цвета через CSS-классы:
Ни один компонент не использует хардкод-цвета в inline styles (кроме градиентных карточек). Все цвета — через `var(--*)` в CSS-классах.

---

## Операции (CardDetail)

### Табы
- **🚌 Поездки** — маршрут (`№{route_num} — {route_description}`), тип транспорта + перевозчик, дата/время, эмодзи по типу (автобус/трамвай/метро)
- **↑ Пополнения** — тип операции, дата/время, название агента, сумма

### Пагинация
Клиентская: загружаются все данные (до 100), показываются по 8 штук. Кнопка «Ещё поездки (12)» / «Ещё пополнения (5)».

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
   → Бэкенд → Корона: PUT invoices/{id}/status → PAID (SELECT FOR UPDATE)
   → Invoice → PAID
7. Фронтенд polling → виджет скрывается → "Баланс пополнен!"
```

### Покупка услуги (pack, abonement)
```
1. GET /api/pay/cards/{id}/operations → список services
2. Пользователь выбирает услугу
3. POST /api/pay/cards/{id}/purchase { service_id }
4-7. Аналогично пополнению
```

### Защита от race condition
Подтверждение в Короне через `_confirm_in_korona()` с `SELECT ... FOR UPDATE`. Webhook и polling не конфликтуют — второй запрос видит что `korona_status` уже `PAID` и пропускает.

---

## API эндпоинты

### Пользовательские (X-Max-Init-Data)

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/cards` | Список карт |
| POST | `/api/cards` | Добавить карту |
| DELETE | `/api/cards/{id}` | Удалить (soft delete) |
| GET | `/api/cards/{id}/info?force=` | Данные с Короны |
| GET | `/api/cards/{id}/trips?page=&size=` | Поездки (пагинация) |
| GET | `/api/cards/{id}/replenishments?page=&size=` | Пополнения (пагинация) |
| GET | `/api/config/tickets` | Конфиг типов из .env |

### Оплата (X-Max-Init-Data)

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/pay/cards/{id}/operations` | Доступные операции (Replenisher) |
| POST | `/api/pay/cards/{id}/replenish` | Создать счёт на пополнение |
| POST | `/api/pay/cards/{id}/purchase` | Создать счёт на покупку услуги |
| GET | `/api/pay/invoices/{id}/status` | Статус платежа (polling) |
| POST | `/api/pay/webhook/yukassa` | Webhook ЮKassa |

### Админка

`https://app.tkpay.ru/admin/` — SQLAdmin (Tabler UI)
Авторизация: `ADMIN_LOGIN` + `ADMIN_PASSWORD` из `.env`

| Раздел | Описание |
|--------|----------|
| Пользователи | ID, имя, username, регистрация, последний визит |
| Карты | Номер, регион, тип, активность, пополняемость |
| Платежи | Статус, ЮKassa, Корона, сумма, ошибки (редактирование) |

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

### Админка и безопасность
```env
ADMIN_LOGIN=admin
ADMIN_PASSWORD=***
SECRET_KEY=<случайная строка 32+ символов>  # python3 -c "import secrets; print(secrets.token_urlsafe(32))"
CORS_ORIGINS=https://app.tkpay.ru           # НЕ ставить * на проде
DEBUG=false                                  # true пропускает проверку подписи MAX
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
| trips | Кэш поездок (fallback) |
| replenishments | Кэш пополнений (fallback) |
| invoices | Заказы: yukassa + korona статусы + ошибки |

---

## Безопасность

### Webhook ЮKassa
Webhook не доверяет данным из POST body. При получении уведомления бэкенд перепроверяет статус платежа через `GET /v3/payments/{id}` к API ЮKassa с credentials магазина. Фейковый webhook с `succeeded` не пройдёт — API вернёт реальный статус.

### CORS
По умолчанию `CORS_ORIGINS=https://app.tkpay.ru`. Менять на `*` запрещено на проде.

### Авторизация MAX Bridge
Все пользовательские эндпоинты (`/api/*`) требуют заголовок `X-Max-Init-Data` с HMAC-SHA256 подписью от MAX SDK. При `DEBUG=true` проверка подписи пропускается — **на проде обязательно `false`**.

### Подтверждение в Короне
Используется `SELECT ... FOR UPDATE` при подтверждении платежа — предотвращает race condition между webhook и polling. Второй запрос видит что `korona_status` уже `PAID` и пропускает.

### Блокировка карт
Карты в стоп-листе Короны (`is_in_stoplist=true`) автоматически блокируются для пополнения. Пользователь видит красную плашку «⛔ Карта заблокирована».

### Валидация при старте
Бэкенд при старте проверяет и пишет ⚠️ в логи если:
- `SECRET_KEY` не изменён с дефолтного
- `DEBUG=true` при настроенной ЮKassa
- `CORS_ORIGINS=*`
- `ADMIN_PASSWORD` пустой

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
docker compose logs --tail=50 frontend

# Очистить Redis
docker compose exec redis redis-cli FLUSHALL

# Проверить настройки бэкенда
docker compose exec backend python3 -c "from app.core.config import get_settings; s=get_settings(); print('login:', repr(s.admin_login))"
```

---

## ✅ Сделано

- [x] Бэкенд FastAPI + PostgreSQL + Redis
- [x] Авторизация MAX Bridge (HMAC-SHA256)
- [x] Добавление / удаление карт
- [x] Типы карт из .env (purse/pack/abonement/social)
- [x] CAN_PAY — контроль пополнения
- [x] Блокировка карт в стоп-листе (is_in_stoplist → canPay=false)
- [x] Абонемент из extra_services или "Нет активных услуг"
- [x] Перевод операций на русский
- [x] Пополнение через Корона Replenisher API (mTLS)
- [x] Покупка услуг через Replenisher API
- [x] Оплата ЮKassa embedded widget (карта, СБП, SberPay, T-Pay)
- [x] Webhook ЮKassa с верификацией через API (защита от фейковых)
- [x] SELECT FOR UPDATE — защита от race condition (webhook vs polling)
- [x] Polling статуса + мгновенное скрытие виджета ЮKassa при PAID
- [x] Кэш отключён (TTL=0) — всегда свежие данные
- [x] Адаптивная тема iOS + Android (data-theme, без prefers-color-scheme)
- [x] Автоопределение темы: MAX SDK → themeParams → matchMedia → fallback
- [x] Горячее переключение темы (themeChanged + matchMedia listener)
- [x] Все inline styles → CSS-классы (iOS WebView совместимость)
- [x] ЮKassa виджет: адаптивный фон (light/dark через color-scheme)
- [x] Операции: табы Поездки/Пополнения + клиентская пагинация по 8
- [x] Поездки: маршрут, транспорт, перевозчик, эмодзи
- [x] Пополнения: название агента
- [x] SQLAdmin — Пользователи, Карты, Платежи (русская локализация)
- [x] CORS ограничение (не *)
- [x] Валидация конфигурации при старте (предупреждения в логах)
- [x] Receipt 54-ФЗ (на стороне ЮKassa)
- [x] MAX Bot token интеграция (заготовка для push)
- [x] Docker Compose + SSL + app.tkpay.ru

## 🔜 В планах

- [ ] Push-уведомления через MAX Bot
- [ ] Автоотмена зависших PENDING инвойсов (cron/scheduler)
- [ ] Rate limiting на создание платежей
- [ ] Автоплатёж
- [ ] Статистика платежей в админке (графики)
- [ ] Sentry / мониторинг ошибок