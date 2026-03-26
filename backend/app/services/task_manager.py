"""
Task manager that prevents asyncio tasks from being garbage collected.
Keeps strong references to all running background tasks.
"""
import asyncio
import logging
from typing import Set

logger = logging.getLogger(__name__)

# Global set of strong references to running tasks
_background_tasks: Set[asyncio.Task] = set()


def create_background_task(coro, name: str = None) -> asyncio.Task:
    """Create an asyncio task with a strong reference so it won't be GC'd."""
    task = asyncio.create_task(coro, name=name)
    _background_tasks.add(task)
    task.add_done_callback(_task_done)
    logger.info(f"Background task started: {name or task.get_name()}")
    return task


def _task_done(task: asyncio.Task):
    """Callback when task completes — remove reference and log errors."""
    _background_tasks.discard(task)
    name = task.get_name()
    if task.cancelled():
        logger.warning(f"Background task cancelled: {name}")
    elif task.exception():
        logger.error(f"Background task failed: {name}", exc_info=task.exception())
    else:
        logger.info(f"Background task completed: {name}")


def get_active_task_count() -> int:
    return len(_background_tasks)
