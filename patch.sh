#!/bin/bash
# ══════════════════════════════════════════════════════════
# Часпик Транспорт — Патч v3
#
# Фронтенд: тема iOS/Android, ЮKassa, пагинация операций
# Бэкенд:   пагинация trips/replenishments (page 0→1)
#
# Файлы → /opt/chaspik-app/:
#   frontend_fixed.tar.gz
#   backend_fixed.tar.gz  (опционально)
#   patch.sh
#
# Запуск: chmod +x patch.sh && ./patch.sh
# ══════════════════════════════════════════════════════════

set -e

APP_DIR="/opt/chaspik-app"
BACKUP_DIR="$APP_DIR/_backup_$(date +%Y%m%d_%H%M%S)"
TMP_DIR=$(mktemp -d)

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${CYAN}══════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Часпик — Патч v3${NC}"
echo -e "${CYAN}══════════════════════════════════════════════${NC}"
echo ""

REBUILD_FE=false
REBUILD_BE=false

# ── Фронтенд ──
FE_ARCHIVE="$APP_DIR/frontend_fixed.tar.gz"
if [ -f "$FE_ARCHIVE" ]; then
    FE_FILES=(
        "src/styles/global.css"
        "src/App.jsx"
        "src/main.jsx"
        "src/hooks/useMaxBridge.js"
        "src/components/Shared.jsx"
        "src/pages/CardList.jsx"
        "src/pages/CardDetail.jsx"
        "src/pages/AddCard.jsx"
        "src/pages/TopUp.jsx"
        "src/pages/BuyService.jsx"
        "src/pages/YooKassa.jsx"
        "index.html"
        "nginx.conf"
    )

    echo -e "${YELLOW}[frontend] Бэкап...${NC}"
    mkdir -p "$BACKUP_DIR/frontend"
    for f in "${FE_FILES[@]}"; do
        if [ -f "$APP_DIR/frontend/$f" ]; then
            mkdir -p "$BACKUP_DIR/frontend/$(dirname $f)"
            cp "$APP_DIR/frontend/$f" "$BACKUP_DIR/frontend/$f"
        fi
    done

    echo -e "${YELLOW}[frontend] Распаковка...${NC}"
    tar xzf "$FE_ARCHIVE" -C "$TMP_DIR"

    OK=0
    for f in "${FE_FILES[@]}"; do
        if [ -f "$TMP_DIR/frontend/$f" ]; then
            mkdir -p "$APP_DIR/frontend/$(dirname $f)"
            cp "$TMP_DIR/frontend/$f" "$APP_DIR/frontend/$f"
            OK=$((OK + 1))
        fi
    done
    echo -e "       ${GREEN}✓${NC} Заменено $OK файлов"
    REBUILD_FE=true
else
    echo -e "${YELLOW}[frontend] frontend_fixed.tar.gz не найден — пропуск${NC}"
fi

# ── Бэкенд ──
BE_ARCHIVE="$APP_DIR/backend_fixed.tar.gz"
if [ -f "$BE_ARCHIVE" ]; then
    BE_FILES=(
        "app/services/korona_informator.py"
        "app/api/routes.py"
        "app/api/payment_routes.py"
        "app/main.py"
        "app/admin/__init__.py"
        "app/admin/setup.py"
        "app/admin/templates/login.html"
        "requirements.txt"
    )

    echo -e "${YELLOW}[backend] Бэкап...${NC}"
    mkdir -p "$BACKUP_DIR/backend"
    for f in "${BE_FILES[@]}"; do
        if [ -f "$APP_DIR/backend/$f" ]; then
            mkdir -p "$BACKUP_DIR/backend/$(dirname $f)"
            cp "$APP_DIR/backend/$f" "$BACKUP_DIR/backend/$f"
        fi
    done

    echo -e "${YELLOW}[backend] Распаковка...${NC}"
    tar xzf "$BE_ARCHIVE" -C "$TMP_DIR"

    OK=0
    for f in "${BE_FILES[@]}"; do
        if [ -f "$TMP_DIR/backend/$f" ]; then
            mkdir -p "$APP_DIR/backend/$(dirname $f)"
            cp "$TMP_DIR/backend/$f" "$APP_DIR/backend/$f"
            OK=$((OK + 1))
        fi
    done
    echo -e "       ${GREEN}✓${NC} Заменено $OK файлов"
    REBUILD_BE=true
else
    echo -e "${YELLOW}[backend] backend_fixed.tar.gz не найден — пропуск${NC}"
fi

rm -rf "$TMP_DIR"
echo ""

# ── Пересборка ──
cd "$APP_DIR"
if [ "$REBUILD_FE" = true ] && [ "$REBUILD_BE" = true ]; then
    echo -e "${YELLOW}Пересборка frontend + backend...${NC}"
    docker compose build --no-cache frontend backend
    docker compose up -d frontend backend
elif [ "$REBUILD_FE" = true ]; then
    echo -e "${YELLOW}Пересборка frontend...${NC}"
    docker compose build --no-cache frontend
    docker compose up -d frontend
elif [ "$REBUILD_BE" = true ]; then
    echo -e "${YELLOW}Пересборка backend...${NC}"
    docker compose build --no-cache backend
    docker compose up -d backend
fi
echo ""

echo -e "${GREEN}══════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✓ Патч применён!${NC}"
echo -e "${GREEN}══════════════════════════════════════════════${NC}"
echo ""
echo -e "  Бэкап:  $BACKUP_DIR"
echo -e "  Откат:  cp -r $BACKUP_DIR/* $APP_DIR/"
echo -e "  Логи:   docker compose logs --tail=30 frontend backend"
echo ""
