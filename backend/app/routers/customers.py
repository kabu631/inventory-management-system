from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.models import Customer, JournalLine, JournalEntry

router = APIRouter()


class CustomerCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    customer_type: str = "B2C"
    credit_limit: float = 0.0


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    customer_type: Optional[str] = None
    credit_limit: Optional[float] = None


def get_customer_balance(db: Session, customer_id: int) -> float:
    """Net AR balance for customer (sum of debits - credits on AR lines)."""
    result = db.query(
        func.coalesce(func.sum(JournalLine.debit_npr), 0) -
        func.coalesce(func.sum(JournalLine.credit_npr), 0)
    ).filter(JournalLine.customer_id == customer_id).scalar()
    return round(float(result or 0), 2)


_customer_balance = get_customer_balance


def auto_merge_duplicate_customers(db: Session):
    """
    Finds and merges duplicate customers sharing the same name (case-insensitive) or phone.
    Re-assigns all JournalLine.customer_id references to the primary customer ID,
    then removes duplicate customer records.
    """
    customers = db.query(Customer).order_by(Customer.id.asc()).all()
    seen_by_name = {}
    seen_by_phone = {}
    duplicates_to_delete = []

    for c in customers:
        norm_name = c.name.strip().lower() if c.name else ""
        norm_phone = c.phone.strip() if c.phone else ""

        primary = None
        if norm_name and norm_name in seen_by_name:
            primary = seen_by_name[norm_name]
        elif norm_phone and norm_phone in seen_by_phone:
            primary = seen_by_phone[norm_phone]

        if primary and primary.id != c.id:
            # Reassign all journal lines from duplicate customer c.id to primary.id
            db.query(JournalLine).filter(JournalLine.customer_id == c.id).update(
                {JournalLine.customer_id: primary.id}, synchronize_session=False
            )
            duplicates_to_delete.append(c)
        else:
            if norm_name:
                seen_by_name[norm_name] = c
            if norm_phone:
                seen_by_phone[norm_phone] = c

    if duplicates_to_delete:
        for dup in duplicates_to_delete:
            db.delete(dup)
        db.commit()


@router.get("/")
def list_customers(db: Session = Depends(get_db)):
    # Auto-clean duplicates on list retrieval
    auto_merge_duplicate_customers(db)

    customers = db.query(Customer).order_by(Customer.name).all()
    return [
        {
            "id": c.id,
            "name": c.name,
            "phone": c.phone,
            "email": c.email,
            "address": c.address,
            "customer_type": c.customer_type,
            "credit_limit": c.credit_limit,
            "outstanding_balance_npr": _customer_balance(db, c.id),
            "created_at": c.created_at,
        }
        for c in customers
    ]


@router.get("/{customer_id}")
def get_customer(customer_id: int, db: Session = Depends(get_db)):
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {
        "id": c.id,
        "name": c.name,
        "phone": c.phone,
        "email": c.email,
        "address": c.address,
        "customer_type": c.customer_type,
        "credit_limit": c.credit_limit,
        "outstanding_balance_npr": _customer_balance(db, c.id),
        "created_at": c.created_at,
    }


@router.get("/{customer_id}/ledger")
def customer_ledger(customer_id: int, db: Session = Depends(get_db)):
    """Full transaction ledger & invoice history for a specific customer."""
    auto_merge_duplicate_customers(db)
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")

    lines = (
        db.query(JournalLine)
        .filter(JournalLine.customer_id == customer_id)
        .join(JournalLine.entry)
        .order_by(JournalLine.entry_id.asc(), JournalLine.id.asc())
        .all()
    )
    running_balance = 0.0
    rows = []
    total_billed = 0.0
    total_paid = 0.0

    for line in lines:
        change = line.debit_npr - line.credit_npr
        running_balance += change
        if line.debit_npr > 0:
            total_billed += line.debit_npr
        if line.credit_npr > 0:
            total_paid += line.credit_npr

        rows.append({
            "line_id": line.id,
            "entry_id": line.entry_id,
            "entry_date": line.entry.entry_date.strftime("%Y-%m-%d") if hasattr(line.entry.entry_date, "strftime") else str(line.entry.entry_date),
            "reference": line.entry.reference or f"INV-{line.entry_id:05d}",
            "narration": line.description or line.entry.narration,
            "debit_npr": line.debit_npr,
            "credit_npr": line.credit_npr,
            "balance_npr": round(running_balance, 2),
        })

    return {
        "customer": {
            "id": c.id,
            "name": c.name,
            "phone": c.phone,
            "email": c.email,
            "address": c.address,
            "customer_type": c.customer_type,
            "credit_limit": c.credit_limit,
            "outstanding_balance_npr": get_customer_balance(db, c.id),
            "total_billed_npr": round(total_billed, 2),
            "total_paid_npr": round(total_paid, 2),
            "total_transactions": len(rows),
        },
        "ledger": rows
    }


@router.post("/", status_code=201)
def create_customer(payload: CustomerCreate, db: Session = Depends(get_db)):
    name_clean = payload.name.strip()
    phone_clean = payload.phone.strip() if payload.phone else None

    # Re-use existing customer if name (case-insensitive) or phone already exists
    existing = None
    if name_clean:
        existing = db.query(Customer).filter(func.lower(Customer.name) == name_clean.lower()).first()
    if not existing and phone_clean:
        existing = db.query(Customer).filter(Customer.phone == phone_clean).first()

    if existing:
        if phone_clean and not existing.phone:
            existing.phone = phone_clean
        if payload.email and payload.email.strip() and not existing.email:
            existing.email = payload.email.strip()
        if payload.address and payload.address.strip() and not existing.address:
            existing.address = payload.address.strip()
        if payload.customer_type and existing.customer_type != payload.customer_type:
            existing.customer_type = payload.customer_type
        if payload.credit_limit > 0:
            existing.credit_limit = payload.credit_limit
        db.commit()
        db.refresh(existing)
        return existing

    c = Customer(**payload.model_dump())
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.patch("/{customer_id}")
def update_customer(customer_id: int, payload: CustomerUpdate, db: Session = Depends(get_db)):
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(c, field, value)
    db.commit()
    db.refresh(c)
    return c


@router.delete("/{customer_id}", status_code=204)
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    db.delete(c)
    db.commit()
