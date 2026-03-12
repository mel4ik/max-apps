#!/bin/bash
# ═══════════════════════════════════════
# Часпик Транспорт Lite — установка на Ubuntu
# Запуск: sudo bash setup.sh
# ═══════════════════════════════════════

set -e
echo "═══ Часпик Транспорт Lite — установка ═══"

# 1. Docker
if ! command -v docker &> /dev/null; then
    echo "→ Установка Docker..."
    apt-get update
    apt-get install -y ca-certificates curl gnupg
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    echo "✓ Docker установлен"
else
    echo "✓ Docker уже установлен"
fi

# 2. Структура проекта
PROJECT_DIR="/opt/chaspik"
echo "→ Создаём $PROJECT_DIR..."
mkdir -p $PROJECT_DIR/certs
echo "✓ Структура создана"

# 3. Сертификаты
echo ""
echo "═══ ВАЖНО: Сертификаты для Replenishment API ═══"
echo "Скопируйте в $PROJECT_DIR/certs/ следующие файлы:"
echo "  - CA_TK_REPLENISHER.crt"
echo "  - client_tkpay.crt"
echo "  - client_tkpay.pem"
echo ""
echo "Пример:"
echo "  scp CA_TK_REPLENISHER.crt user@server:$PROJECT_DIR/certs/"
echo "  scp client_tkpay.crt user@server:$PROJECT_DIR/certs/"
echo "  scp client_tkpay.pem user@server:$PROJECT_DIR/certs/"
echo ""

# 4. Запуск
echo "═══ Для запуска: ═══"
echo "  cd $PROJECT_DIR"
echo "  # Скопируйте файлы проекта сюда"
echo "  # Отредактируйте .env (MAX_BOT_TOKEN)"
echo "  docker compose up -d --build"
echo "  docker compose logs -f backend"
echo ""
echo "═══ Проверка: ═══"
echo "  curl http://localhost:8000/api/health"
echo ""
echo "✓ Готово!"
