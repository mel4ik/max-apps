# Часпик Транспорт Lite — Фронтенд

Мини-приложение для мессенджера **MAX**. Управление транспортными картами ЕТК через «Корона Информатор»: баланс, поездки, пополнение, покупка услуг.

## Стек

- React 18 + Vite
- MAX Bridge (`max-web-app.js`)
- Inline styles (как в согласованном прототипе)
- Шрифт Manrope

## Быстрый старт

```bash
cd chaspik-frontend
npm install
npm run dev
```

В `vite.config.js` укажите URL бэкенда в `proxy.target`.

## Экраны

1. **CardList** — список карт (кошелёк/поездки/абонемент) с балансом
2. **AddCard** — ввод 19-значного номера ЕТК + QR-сканер
3. **CardDetail** — баланс/поездки/период + история операций
4. **TopUp** — пополнение кошелька (пресеты 100–2000₽)
5. **BuyService** — покупка абонемента или пакета поездок
6. **YooKassa** — экран оплаты (карта, СБП, SberPay, T-Pay)
7. **Result** — успешная оплата
8. **Admin** — все invoices, фильтры, смена статусов

## Три типа карт

| Тип | kind | Цвет | Показатель |
|---|---|---|---|
| Электронный кошелёк | `purse` | #FF6B00 | Баланс в ₽ |
| Пакет поездок | `counter` | #1B6EF3 | X/Y поездок + дата |
| Абонемент | `abonement` | #7C3AED | Период действия |

## API (суммы в копейках)

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/cards` | Список карт |
| POST | `/api/cards` | Добавить `{ card_number }` |
| GET | `/api/cards/{id}/info` | Баланс, тип, статус |
| GET | `/api/cards/{id}/trips` | История операций |
| POST | `/api/cards/{id}/replenish` | Создать invoice `{ amount, service_id? }` |
| GET | `/api/invoices` | Все invoices |
| PATCH | `/api/invoices/{id}` | Сменить статус |

## MAX Bridge

- `WebApp.ready()`, `BackButton`, `HapticFeedback`
- `openCodeReader()` — QR-сканер
- `openLink()` — оплата YooKassa
- `X-Max-Init-Data` заголовок для валидации

## Деплой

```bash
npm run build
# dist/ → HTTPS-хостинг → URL в business.max.ru
```
