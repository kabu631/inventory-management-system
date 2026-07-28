"""
Users & Auth Router
Handles User Authentication (/api/auth/login), Session Check (/api/auth/me),
and Admin User Management (/api/auth/users).
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.services.auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, require_roles
)

router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserCreateRequest(BaseModel):
    username: str
    password: str
    full_name: str
    email: Optional[str] = None
    role: str = "STAFF"  # ADMIN | STAFF


class UserResponse(BaseModel):
    id: int
    username: str
    full_name: str
    email: Optional[str]
    role: str
    is_active: bool

    class Config:
        from_attributes = True


@router.post("/login", response_model=LoginResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate user with username and password, returning JWT access token."""
    username_clean = req.username.strip()
    user = db.query(User).filter(User.username == username_clean).first()
    
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated. Contact Administrator.",
        )

    token = create_access_token(user.id, user.username, user.role)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role,
        }
    }


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    """Return profile details of currently logged-in user."""
    return {
        "id": current_user.id,
        "username": current_user.username,
        "full_name": current_user.full_name,
        "email": current_user.email,
        "role": current_user.role,
        "created_at": current_user.created_at,
    }


@router.get("/users", response_model=List[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_roles(["ADMIN"]))
):
    """Admin Only: List all registered user accounts."""
    return db.query(User).order_by(User.id).all()


@router.post("/users", response_model=UserResponse)
def create_user(
    req: UserCreateRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_roles(["ADMIN"]))
):
    """Admin Only: Create new staff or admin user account."""
    if req.role.upper() not in ["ADMIN", "STAFF"]:
        raise HTTPException(status_code=400, detail="Role must be ADMIN or STAFF")

    existing = db.query(User).filter(User.username == req.username.strip()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")

    new_user = User(
        username=req.username.strip(),
        full_name=req.full_name.strip(),
        email=req.email.strip() if req.email else None,
        hashed_password=hash_password(req.password),
        role=req.role.upper(),
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user
