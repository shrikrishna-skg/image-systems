import logging

from sqlalchemy import event
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool
from app.config import settings


def _is_sqlite(url: str) -> bool:
    return url.startswith("sqlite+aiosqlite://")


def _pg_connect_args() -> dict:
    args: dict = {
        "server_settings": {"search_path": "public"},
        "statement_cache_size": 0,
        "prepared_statement_cache_size": 0,
    }
    if settings.database_use_ssl:
        args["ssl"] = True
    return args


_db_url = settings.effective_database_url
_sql_echo = settings.resolved_python_log_level <= logging.DEBUG

if _is_sqlite(_db_url):
    engine = create_async_engine(
        _db_url,
        echo=_sql_echo,
        poolclass=NullPool,
        pool_pre_ping=False,
    )

    @event.listens_for(engine.sync_engine, "connect")
    def _sqlite_fast_pragmas(dbapi_conn, _):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA journal_mode=WAL")
        cur.execute("PRAGMA synchronous=NORMAL")
        cur.execute("PRAGMA busy_timeout=8000")
        cur.execute("PRAGMA cache_size=-64000")
        cur.close()
else:
    engine = create_async_engine(
        _db_url,
        echo=_sql_echo,
        pool_size=5,
        max_overflow=5,
        pool_pre_ping=True,
        connect_args=_pg_connect_args(),
    )

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
