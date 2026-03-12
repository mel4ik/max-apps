# Часпик Транспорт Lite

Мини-приложение для мессенджера MAX. Управление транспортными картами ЕТК через API «Корона Информатор» (Краснодар).

**Домен:** `https://app.tkpay.ru`
**Админка:** `https://app.tkpay.ru/admin`
**Репозиторий:** `https://github.com/mel4ik/max-apps`

---

## Архитектура
```
[MAX мессенджер] → [Фронтенд React/Vite] → [Бэкенд FastAPI] → [Корона API]
                    nginx :3000               :8000              trcard.korona.net
                                              PostgreSQL :5432
                                              Redis :6379
```

## Стек

| Компонент | Технология |
|-----------|-----------|
| Фронтенд | React 18 + Vite, inline styles, шрифт Manrope |
| Бэкенд | FastAPI + SQLAlchemy async + Pydantic |
| БД | PostgreSQL 16 |
| Кэш | Redis 7 |
| Внешний API | Корона Информатор (tcard-info/1.0) |
| Авторизация | MAX Bridge initData → HMAC-SHA256 |
| Деплой | Docker Compose, nginx SSL (certbot) |

---

## Структура проекта
```
/opt/chaspik-app/
├── docker-compose.yml
├── .env                    ← ВСЕ настройки (типы карт, доступ, API ключи)
├── README.md
├── deploy.sh               ← Скрипт деплоя
├── backend/
│   ├── Dockerfile
│   ├── app/
│   │   ├── main.py            ← FastAPI app, подключение роутеров
│   │   ├── core/
│   │   │   ├── config.py      ← Settings из .env (Pydantic BaseSettings)
│   │   │   ├── database.py    ← AsyncSession PostgreSQL
│   │   │   └── redis.py       ← Redis клиент
│   │   ├── api/
│   │   │   ├── routes.py      ← Основные эндпоинты (/api/cards, /api/config/tickets)
│   │   │   └── admin_routes.py ← Админка (/api/admin/*)
│   │   ├── models/
│   │   │   └── models.py      ← User, Card, CardSnapshot, Trip, Replenishment, Invoice
│   │   ├── services/
│   │   │   ├── korona_informator.py ← Клиент Корона API + Keycloak auth
│   │   │   └── max_auth.py    ← Валидация X-Max-Init-Data
│   │   └── certs/             ← mTLS сертификаты для Replenisher
│   └── requirements.txt
├── frontend/
│   ├── Dockerfile             ← ВАЖНО: npm install (НЕ npm ci!)
│   ├── nginx.conf             ← /api/ → proxy_pass backend:8000
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html             ← MAX Web App SDK подключён
│   └── src/
│       ├── main.jsx           ← Роутинг: / → App, /admin → AdminPage
│       ├── App.jsx            ← Навигация по экранам (cards/add/det/top/buy/pay/res)
│       ├── api/
│       │   ├── client.js      ← API клиент + parseCardStatus() + translateOp()
│       │   ├── helpers.js     ← fk() (копейки→₽), sd(), ft()
│       │   └── ticketConfig.js ← Загрузка конфига из /api/config/tickets + resolveKind()
│       ├── components/
│       │   ├── Shared.jsx     ← Box, BackBtn
│       │   └── DeleteCardBtn.jsx ← Удаление с подтверждением
│       ├── hooks/
│       │   └── useMaxBridge.js ← WebApp.ready(), BackButton, HapticFeedback
│       ├── pages/
│       │   ├── CardList.jsx   ← Список карт, cfg-driven отображение
│       │   ├── AddCard.jsx    ← Добавление (19 цифр ^9643, QR-сканер)
│       │   ├── CardDetail.jsx ← Детали карты + операции + удаление
│       │   ├── TopUp.jsx      ← Выбор суммы (пресеты из cfg + свободная)
│       │   ├── BuyService.jsx ← Покупка услуг (абонементы/пакеты)
│       │   ├── YooKassa.jsx   ← Оплата (4 метода: карта, СБП, SberPay, T-Pay)
│       │   ├── Result.jsx     ← Экран успеха
│       │   └── AdminPage.jsx  ← Админка (логин/пароль/secret_key)
│       └── styles/
│           └── global.css     ← Светлая тема, #F4F6FA фон
```

---

## API эндпоинты

### Пользовательские (авторизация через X-Max-Init-Data)

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/cards` | Список карт пользователя |
| POST | `/api/cards` | Добавить карту `{ card_pan: "9643..." }` |
| DELETE | `/api/cards/{id}` | Удалить карту (soft delete) |
| GET | `/api/cards/{id}/info` | Данные карты из Короны (через кэш) |
| GET | `/api/cards/{id}/trips` | Поездки |
| GET | `/api/cards/{id}/replenishments` | Пополнения |
| GET | `/api/config/tickets` | Конфиг типов карт из .env |

### Админские (авторизация Basic Auth + X-Secret-Key)

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/admin/stats` | Статистика (users, cards) |
| GET | `/api/admin/users` | Список пользователей |
| GET | `/api/admin/users/{id}/cards` | Карты пользователя |
| GET | `/api/admin/cards` | Все карты |
| GET | `/api/admin/invoices` | Платежи (ЮKassa + Корона) |
| POST | `/api/admin/invoices/{id}/status` | Изменить статус платежа |

---

## Конфигурация (.env)

### Типы карт
```env
TICKET_PURSE=0110                 # Кошелёк (баланс в ₽, свободная сумма)
TICKET_PACK=0111,0112,0191,...    # Пакеты (поездки, покупка пакетами)
TICKET_ABONEMENT=0300             # Абонемент (срок действия, покупка услуг)
TICKET_SOCIAL=1156                # Социальная (баланс + поездки, без пополнения)
CAN_PAY=0110,1156                 # Кому разрешено пополнение
```

### Правила отображения по типу (ticketConfig.js)

| Тип | Баланс | Поездки | Даты | Пополнение |
|-----|--------|---------|------|------------|
| purse | ✅ | — | окончания | ✅ 200/500/1000/1500 + своя (макс 2800−баланс) |
| pack | — | ✅ | — | Только пакетами (услуги) |
| abonement | — | — | С/По из extra_services.abonement[] или "Нет активных услуг" | Покупка услуг |
| social | ✅ | ✅ | сгорания | — (запрещено) |

### Логика определения типа (resolveKind)

1. ticket_id в конфиге .env → соответствующий kind
2. is_social_card → social
3. ticket_type == 1 → abonement
4. ticket_type == 2 → counter
5. ticket_type == 3,4 + есть extra_services → pack
6. ticket_type == 3,4 → purse

### Админка
```env
ADMIN_LOGIN=admin
ADMIN_PASSWORD=ChaspikAdmin2026
ADMIN_SECRET_KEY=sk-chaspik-9f8e7d6c5b4a
```

---

## Перевод операций (type_operation)

| Код API | Отображение |
|---------|-------------|
| REPLENISHMENT | Пополнение баланса |
| MONEY_TRANSFER | Перевод на карту |
| PURCHASE_TRANSFER | Покупка услуги |
| PURCHASE_WITHDRAWAL | Списание за услугу |
| PURCHASE_WRITE_OFF | Списание за услугу |
| MONEY_WRITE_OFF | Списание средств |
| PURCHASE | Покупка услуги |
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
| invoices | Заказы оплаты: статус ЮKassa + статус Короны + ошибки |

### Цепочка запросов (кэширование)
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

# Логи
docker compose logs --tail=50 backend
docker compose logs --tail=50 frontend

# Обновить конфиг (типы карт, CAN_PAY) — без пересборки
docker compose restart backend
```

---

## Деплой на сервер

Хостовый nginx (`/etc/nginx/sites-available/chaspik`) → SSL certbot → proxy_pass `http://127.0.0.1:3000`

---

## ✅ Сделано

- [x] Бэкенд FastAPI + PostgreSQL + Redis + Корона API
- [x] Авторизация через MAX Bridge (HMAC-SHA256)
- [x] Добавление/удаление карт
- [x] Отображение карт по типам (purse/pack/abonement/social)
- [x] Конфиг типов из .env (без пересборки Docker)
- [x] CAN_PAY — контроль доступа к пополнению через .env
- [x] Абонемент из extra_services.abonement[] или "Нет активных услуг"
- [x] Перевод операций на русский
- [x] Админка /admin с авторизацией (login + password + secret_key)
- [x] Таблица invoices в БД
- [x] Docker Compose + SSL + деплой на app.tkpay.ru

## 🔜 В планах

- [ ] Пополнение через ЮKassa (реальная оплата)
- [ ] Покупка услуг через Replenisher API (mTLS, порт 2505)
- [ ] Webhook ЮKassa → подтверждение → отправка в Корону
- [ ] Полировка дизайна (анимации, цвета, адаптивность)
- [ ] Push-уведомления через MAX Bot
- [ ] Фильтры и поиск в админке
- [ ] Логирование запросов/ответов Короны в админке
