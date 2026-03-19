# backend/app/main.py
import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from starlette.staticfiles import StaticFiles

from app.core.config import get_settings
from app.core.database import engine
from app.core.redis import close_redis
from app.models.models import Base
from app.api.routes import router
from app.api.payment_routes import router as payment_router
from app.services.keycloak import get_keycloak
from app.admin.setup import setup_admin

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logging.info("Database tables ready")
    yield
    # Shutdown
    keycloak = get_keycloak()
    await keycloak.close()
    await close_redis()
    await engine.dispose()


app = FastAPI(
    title=settings.app_name,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Session middleware для SQLAdmin авторизации
app.add_middleware(SessionMiddleware, secret_key=settings.secret_key)

# За HTTPS-прокси (nginx + certbot) — доверяем X-Forwarded-Proto
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")

app.include_router(router)
app.include_router(payment_router)

# SQLAdmin — /admin
admin = setup_admin(app, engine)

# Fix: sqladmin 0.20 не устанавливает directory для StaticFiles.
# Патчим внутренний statics mount после инициализации.
import sqladmin as _sqladmin
_statics_dir = os.path.join(os.path.dirname(_sqladmin.__file__), "statics")

# Находим admin Mount в app.routes, внутри него — statics Mount
for route in app.routes:
    if getattr(route, 'name', '') == 'admin':
        sub_app = getattr(route, 'app', None)
        if sub_app and hasattr(sub_app, 'routes'):
            for i, r in enumerate(sub_app.routes):
                if getattr(r, 'name', '') == 'statics':
                    # Заменяем сломанный mount на рабочий
                    from starlette.routing import Mount
                    sub_app.routes[i] = Mount(
                        "/statics",
                        app=StaticFiles(directory=_statics_dir),
                        name="statics",
                    )
                    logging.info("SQLAdmin statics patched: %s", _statics_dir)
                    break
        break
