from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.core.config import get_settings
from app.routers import auth, tenants, agents, campaigns, contacts, calls, providers, knowledge_base, admin, team
from app.routers import ws
from app.routers.webhooks import twilio as twilio_webhook, vobiz as vobiz_webhook

settings = get_settings()

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="Vgent API",
    description="Voice AI Agent SaaS Platform — Backend API",
    version="0.1.0",
)

# CORS
cors_origins = [
    settings.app_url,
    "https://vgent-web-tau.vercel.app",
    "http://localhost:3000",
]
if settings.cors_origins:
    cors_origins.extend([o.strip() for o in settings.cors_origins.split(",") if o.strip()])
# Deduplicate while preserving order
cors_origins = list(dict.fromkeys(cors_origins))
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiting
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"data": None, "error": {"code": "rate_limit", "message": "Too many requests"}},
    )


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"data": None, "error": {"code": "internal_error", "message": str(exc)}},
    )


# Register routers
app.include_router(auth.router, prefix="/api")
app.include_router(tenants.router, prefix="/api")
app.include_router(agents.router, prefix="/api")
app.include_router(campaigns.router, prefix="/api")
app.include_router(contacts.router, prefix="/api")
app.include_router(calls.router, prefix="/api")
app.include_router(providers.router, prefix="/api")
app.include_router(knowledge_base.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(team.router, prefix="/api")

# WebSocket endpoints
app.include_router(ws.router, prefix="/api")

# Webhook endpoints (no auth — signature-verified instead)
app.include_router(twilio_webhook.router, prefix="/api")
app.include_router(vobiz_webhook.router, prefix="/api")


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "vgent-api"}
