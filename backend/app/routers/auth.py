from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
import hashlib
import secrets
from typing import Optional

from app.database import get_db
from app.models import User

router = APIRouter()


def hash_password(password: str, salt: Optional[str] = None) -> tuple[str, str]:
    if not salt:
        salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        100000,
    ).hex()
    return hashed, salt


def verify_password(password: str, hashed: str, salt: str) -> bool:
    new_hash, _ = hash_password(password, salt)
    return secrets.compare_digest(new_hash, hashed)


def ensure_default_users(db: Session):
    """Ensures renewgenadmin (Admin) and staff (Staff) accounts exist with target credentials."""
    default_accounts = [
        {
            "username": "renewgenadmin",
            "password": "P@shupat1n@th",
            "role": "ADMIN",
            "full_name": "Renew Gen Administrator",
            "staff_id": "EMP-001",
        },
        {
            "username": "staff",
            "password": "staff123",
            "role": "STAFF",
            "full_name": "Renew Gen Operations Staff",
            "staff_id": "EMP-102",
        },
        {
            "username": "accountant",
            "password": "accountant123",
            "role": "ACCOUNTANT",
            "full_name": "Renew Gen Accountant",
            "staff_id": "ACC-001",
        },
    ]

    for acc in default_accounts:
        user = db.query(User).filter(User.username == acc["username"]).first()
        pwd_hash, salt = hash_password(acc["password"])
        if not user:
            user = User(
                username=acc["username"],
                password_hash=pwd_hash,
                salt=salt,
                role=acc["role"],
                full_name=acc["full_name"],
                staff_id=acc["staff_id"],
            )
            db.add(user)
        else:
            # Ensure password & metadata are up to date
            user.password_hash = pwd_hash
            user.salt = salt
            user.role = acc["role"]
            user.full_name = acc["full_name"]
            user.staff_id = acc["staff_id"]

    db.commit()


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    ensure_default_users(db)

    user = db.query(User).filter(User.username == req.username.strip()).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    if not verify_password(req.password, user.password_hash, user.salt):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    # Simple session token generation
    session_token = secrets.token_hex(24)

    return {
        "status": "success",
        "message": f"Welcome back, {user.full_name}!",
        "token": f"rg_session_{user.id}_{session_token}",
        "user": {
            "id": user.id,
            "username": user.username,
            "role": user.role,
            "full_name": user.full_name,
            "staff_id": user.staff_id,
        },
    }


@router.get("/users")
def get_users(db: Session = Depends(get_db)):
    ensure_default_users(db)
    users = db.query(User).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "role": u.role,
            "full_name": u.full_name,
            "staff_id": u.staff_id,
            "created_at": u.created_at.strftime("%Y-%m-%d %H:%M") if u.created_at else "",
        }
        for u in users
    ]
