from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from .. import models, schemas, auth as auth_utils
from ..database import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=schemas.Token)
def register(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    user = models.User(
        full_name=payload.full_name,
        email=payload.email,
        mobile=payload.mobile,
        password_hash=auth_utils.hash_password(payload.password),
        role=models.UserRole.customer,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    db.add(models.AuditLog(user_id=user.id, action="register", detail=f"New account created for {user.email}"))
    db.commit()

    token = auth_utils.create_access_token({"sub": user.id, "role": user.role.value})
    return schemas.Token(access_token=token, user=schemas.UserOut.model_validate(user))


@router.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not auth_utils.verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")

    token = auth_utils.create_access_token({"sub": user.id, "role": user.role.value})
    db.add(models.AuditLog(user_id=user.id, action="login", detail=f"{user.email} logged in"))
    db.commit()
    return schemas.Token(access_token=token, user=schemas.UserOut.model_validate(user))


@router.get("/me", response_model=schemas.UserOut)
def me(current_user: models.User = Depends(auth_utils.get_current_user)):
    return current_user
