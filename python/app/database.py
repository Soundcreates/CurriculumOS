from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel
from dotenv import load_dotenv
import os
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit


def normalize_database_url(raw_url: str) -> str:
    normalized = raw_url.strip()
    if normalized.startswith("postgres://"):
        normalized = normalized.replace("postgres://", "postgresql+asyncpg://", 1)
    elif normalized.startswith("postgresql://"):
        normalized = normalized.replace("postgresql://", "postgresql+asyncpg://", 1)

    parsed = urlsplit(normalized)
    query_params = dict(parse_qsl(parsed.query, keep_blank_values=True))

    # asyncpg does not accept libpq params like sslmode/channel_binding.
    sslmode = query_params.pop("sslmode", None)
    query_params.pop("channel_binding", None)
    if sslmode and "ssl" not in query_params:
        query_params["ssl"] = sslmode

    return urlunsplit(
        (parsed.scheme, parsed.netloc, parsed.path, urlencode(query_params), parsed.fragment)
    )

load_dotenv()
db_url = os.getenv("DATABASE_URL")
if not db_url:
    raise RuntimeError("DATABASE_URL is not set")

engine = create_async_engine(normalize_database_url(db_url), echo=True)

SessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)


async def get_session():
    async with SessionLocal() as session:
        yield session

