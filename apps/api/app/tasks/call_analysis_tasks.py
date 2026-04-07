"""Celery tasks for post-call analysis (summary + sentiment)."""

import asyncio
import logging
from celery_app import celery

logger = logging.getLogger(__name__)


def _run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _analyze(call_id: str):
    from app.core.database import async_session
    from app.services.call_analyzer import analyze_call

    async with async_session() as db:
        result = await analyze_call(db, call_id)
        if result:
            await db.commit()
            logger.info("Post-call analysis completed for call %s", call_id)
        else:
            logger.warning("Post-call analysis returned no result for call %s", call_id)


@celery.task(name="app.tasks.call_analysis_tasks.analyze_call_task", bind=True, max_retries=2)
def analyze_call_task(self, call_id: str):
    """Async Celery task: generate summary + sentiment for a completed call."""
    try:
        _run_async(_analyze(call_id))
    except Exception as exc:
        logger.exception("analyze_call_task failed for call %s", call_id)
        raise self.retry(exc=exc, countdown=30)
