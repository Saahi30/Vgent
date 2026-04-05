from celery import Celery
from app.core.config import get_settings

settings = get_settings()

celery = Celery(
    "vgent",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

celery.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    beat_schedule={
        "scan-campaigns": {
            "task": "app.tasks.campaign_tasks.scan_active_campaigns",
            "schedule": 60.0,  # Every 60 seconds
        },
    },
)

# Auto-discover tasks
celery.autodiscover_tasks(["app.tasks", "app.tasks.kb_tasks"])
