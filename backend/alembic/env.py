from logging.config import fileConfig
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from alembic import context
from dotenv import load_dotenv
from sqlalchemy import create_engine, pool

# Load backend/.env before importing app settings (no secrets in this file).
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from app.config import settings
from app.database import Base
from app.models import ApiKey, Image, ImageVersion, Job, User  # noqa: F401

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _sync_migration_url() -> str:
    url = settings.DATABASE_URL
    if url.startswith("postgresql+asyncpg://"):
        url = url.replace("postgresql+asyncpg://", "postgresql+psycopg://", 1)
    if settings.database_use_ssl:
        parsed = urlparse(url)
        q = dict(parse_qsl(parsed.query, keep_blank_values=True))
        keys_lower = {k.lower() for k in q}
        if "sslmode" not in keys_lower and "ssl" not in keys_lower:
            q["sslmode"] = "require"
        url = urlunparse(parsed._replace(query=urlencode(q)))
    return url


def run_migrations_offline() -> None:
    url = _sync_migration_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = create_engine(_sync_migration_url(), poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
