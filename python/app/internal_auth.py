import hmac
import os

from fastapi import Header, HTTPException


def require_internal_service(authorization: str | None = Header(None)) -> None:
    token = os.getenv("INTERNAL_SERVICE_TOKEN", "")
    expected = f"Bearer {token}"
    if not token or not authorization or not hmac.compare_digest(authorization, expected):
        raise HTTPException(status_code=401, detail="unauthorized")
