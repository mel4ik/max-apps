#!/bin/bash
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
echo "=== Часпик Транспорт Lite ==="
echo "Директория: $DIR"
echo ""

# 1. Docker
if ! command -v docker &> /dev/null; then
    echo "-> Устанавливаем Docker..."
    apt-get update -qq
    apt-get install -y -qq ca-certificates curl gnupg > /dev/null
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin > /dev/null
    echo "[OK] Docker установлен"
else
    echo "[OK] Docker: $(docker --version)"
fi
echo ""

# 2. .env
if [ ! -f "$DIR/.env" ]; then
    echo "-> Создаём .env с credentials..."
    cp "$DIR/.env.example" "$DIR/.env"
    sed -i 's|KORONA_AUTH_URL=.*|KORONA_AUTH_URL=https://trcard.korona.net/auth/realms/public/protocol/openid-connect/token|' "$DIR/.env"
    sed -i 's|KORONA_CLIENT_ID=.*|KORONA_CLIENT_ID=krdkuban_svc|' "$DIR/.env"
    sed -i 's|KORONA_CLIENT_SECRET=.*|KORONA_CLIENT_SECRET=b7d7700c-70c8-429d-bb3b-5eff3dae11a8|' "$DIR/.env"
    sed -i 's|KORONA_USERNAME=.*|KORONA_USERNAME=it@etkrd.ru|' "$DIR/.env"
    sed -i 's|KORONA_PASSWORD=.*|KORONA_PASSWORD=0r1qaBsk|' "$DIR/.env"
    sed -i 's|KORONA_INFO_URL=.*|KORONA_INFO_URL=https://trcard.korona.net/api/tcard-info/1.0|' "$DIR/.env"
    sed -i 's|KORONA_REPL_URL=.*|KORONA_REPL_URL=https://trcard.korona.net:2505/krasnodar/api/card-replenisher/1.0|' "$DIR/.env"
    echo "[OK] .env создан"
else
    echo "[OK] .env уже есть"
fi
echo ""

# 3. Certs
mkdir -p "$DIR/certs"
for f in CA_TK_REPLENISHER.crt client_tkpay.crt client_tkpay.pem; do
    if [ ! -f "$DIR/certs/$f" ]; then
        echo "[!] Нет certs/$f (для Replenisher)"
    fi
done
echo ""

# 4. Build & start
echo "-> Собираем и запускаем..."
cd "$DIR"
docker compose up -d --build
echo ""

# 5. Wait
echo "-> Ждём backend..."
for i in $(seq 1 30); do
    if curl -sf http://localhost:8000/api/health > /dev/null 2>&1; then
        echo ""
        echo "[OK] Backend работает!"
        curl -s http://localhost:8000/api/health
        echo ""
        break
    fi
    sleep 1
    printf "."
done
echo ""

# 6. Status
docker compose ps
echo ""
echo "=== Готово ==="
echo "API:  http://localhost:8000/api/health"
echo "Логи: docker compose logs -f backend"
echo ""
echo "TODO:"
echo "  1. nano .env -> MAX_BOT_TOKEN=..."
echo "  2. Сертификаты в certs/ (когда откроют IP)"
echo "  3. docker compose restart backend"
