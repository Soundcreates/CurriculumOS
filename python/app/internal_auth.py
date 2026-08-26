import hmac
import os

from fastapi import Header, HTTPException


def get_internal_service_token() -> str:
    token = os.getenv("INTERNAL_SERVICE_TOKEN", "").strip()
    if token.lower().startswith("bearer "):
        token = token[7:].strip()
    return token


def require_internal_service(authorization: str | None = Header(None)) -> None:
    token = get_internal_service_token()
    expected = f"Bearer {token}"
    if not token or not authorization or not hmac.compare_digest(authorization, expected):
        raise HTTPException(status_code=401, detail="unauthorized")
