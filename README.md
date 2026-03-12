# Часпик Транспорт Lite — Этап 1

## Быстрый старт

```bash
# 1. Клонируйте и настройте
cp .env.example .env
# Заполните .env своими credentials

# 2. Запуск
docker compose up -d

# 3. Проверка
curl http://localhost:8000/api/health
# {"status":"ok","stage":1}
```

## API эндпоинты (Этап 1)

| Метод | URL | Описание |
|-------|-----|----------|
| GET | /api/health | Health check |
| GET | /api/cards | Список карт пользователя |
| POST | /api/cards | Добавить карту `{"card_pan":"9643..."}` |
| GET | /api/cards/{id}/info | Баланс и статус (кэш/fallback) |
| GET | /api/cards/{id}/info?force=true | Принудительное обновление |
| GET | /api/cards/{id}/trips?page=0&size=20 | Поездки |
| GET | /api/cards/{id}/replenishments?page=0&size=20 | Пополнения |
| DELETE | /api/cards/{id} | Удалить карту |

Все запросы требуют заголовок `X-Max-Init-Data` из MAX Bridge.

## .env — что заполнить

Получите от Золотой Короны:
- `KORONA_AUTH_URL` — URL Keycloak token endpoint
- `KORONA_CLIENT_ID` / `KORONA_CLIENT_SECRET`
- `KORONA_USERNAME` / `KORONA_PASSWORD`
- `KORONA_API_URL` — base URL Informator API

Получите в MAX для партнёров:
- `MAX_BOT_TOKEN` — токен бота

## Структура

```
backend/
├── app/
│   ├── api/routes.py              # API эндпоинты
│   ├── core/
│   │   ├── config.py              # Настройки из .env
│   │   ├── database.py            # PostgreSQL
│   │   └── redis.py               # Redis
│   ├── models/models.py           # SQLAlchemy модели
│   ├── services/
│   │   ├── keycloak.py            # Авторизация Keycloak
│   │   ├── korona_informator.py   # Resilient-прокси к Короне
│   │   └── max_auth.py            # MAX Bridge авторизация
│   └── main.py                    # FastAPI app
├── Dockerfile
└── requirements.txt
docker-compose.yml
.env.example
```
