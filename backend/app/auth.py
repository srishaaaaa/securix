import os
import bcrypt
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session

from .database import get_db
from . import models

# In production, set SECURIX_SECRET_KEY as an environment variable.
SECRET_KEY = os.getenv("SECURIX_SECRET_KEY", "dev-secret-change-me-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 12

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None:
        raise credentials_exception
    return user


def require_admin(user: models.User = Depends(get_current_user)) -> models.User:
    if user.role != models.UserRole.admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ---------------------------------------------------------------------------
# Additional module - KYC-as-a-service API key auth
# ---------------------------------------------------------------------------
import hashlib
import secrets
from fastapi import Header


def generate_api_key() -> tuple[str, str, str]:
    """Returns (raw_key, prefix, sha256_hash). The raw key is shown to the
    caller exactly once; only the hash is ever persisted."""
    raw = f"sx_live_{secrets.token_urlsafe(32)}"
    prefix = raw[:14]
    key_hash = hashlib.sha256(raw.encode()).hexdigest()
    return raw, prefix, key_hash


def require_api_key(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    db: Session = Depends(get_db),
) -> models.ApiKey:
    """Authenticates partner-API requests (/api/v1/...) via the X-API-Key
    header instead of a JWT bearer token. Kept fully separate from
    get_current_user so nothing about the existing session-based auth
    changes."""
    if not x_api_key:
        raise HTTPException(status_code=401, detail="Missing X-API-Key header.")

    key_hash = hashlib.sha256(x_api_key.encode()).hexdigest()
    api_key = db.query(models.ApiKey).filter(
        models.ApiKey.key_hash == key_hash, models.ApiKey.is_active == True  # noqa: E712
    ).first()
    if not api_key:
        raise HTTPException(status_code=401, detail="Invalid or revoked API key.")

    api_key.last_used_at = datetime.utcnow()
    db.commit()
    return api_key
