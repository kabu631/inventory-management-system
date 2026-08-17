from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import date
from typing import Optional, List

from app.database import get_db
from app.models import Investor, InvestmentRecord, JournalEntry, JournalLine, AccountHead
from app.services.auth import require_roles

router = APIRouter(dependencies=[Depends(require_roles(["ADMIN"]))])


class InvestorCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    ownership_pct: Optional[float] = 0.0
    notes: Optional[str] = None


class InvestmentCreate(BaseModel):
    amount_npr: float
    investment_date: date
    payment_method: Optional[str] = "BANK"  # BANK | CASH | CHEQUE
    reference: Optional[str] = None
    notes: Optional[str] = None


def _get_account_head(db: Session, code: str) -> Optional[AccountHead]:
    return db.query(AccountHead).filter(AccountHead.code == code).first()


def ensure_default_investors(db: Session):
    """No-op: allows clean manual data entry for investors from scratch."""
    pass


@router.get("/")
def list_investors(db: Session = Depends(get_db)):
    ensure_default_investors(db)

    investors = db.query(Investor).all()
    result = []

    for inv in investors:
        records = (
            db.query(InvestmentRecord)
            .filter(InvestmentRecord.investor_id == inv.id)
            .order_by(InvestmentRecord.investment_date.desc())
            .all()
        )
        total_invested = sum(r.amount_npr for r in records)
        last_date = records[0].investment_date.strftime("%Y-%m-%d") if records else ""

        result.append({
            "id": inv.id,
            "name": inv.name,
            "phone": inv.phone or "",
            "email": inv.email or "",
            "address": inv.address or "",
            "ownership_pct": inv.ownership_pct,
            "notes": inv.notes or "",
            "total_invested_npr": total_invested,
            "investment_count": len(records),
            "last_investment_date": last_date,
            "created_at": inv.created_at.strftime("%Y-%m-%d") if inv.created_at else "",
            "investments": [
                {
                    "id": r.id,
                    "amount_npr": r.amount_npr,
                    "investment_date": r.investment_date.strftime("%Y-%m-%d"),
                    "payment_method": r.payment_method,
                    "reference": r.reference or "",
                    "notes": r.notes or "",
                }
                for r in records
            ],
        })

    total_capital = sum(item["total_invested_npr"] for item in result)

    return {
        "summary": {
            "total_capital_npr": total_capital,
            "total_investors": len(result),
            "avg_investment_npr": round(total_capital / len(result), 2) if result else 0.0,
        },
        "investors": result,
    }


@router.post("/")
def create_investor(payload: InvestorCreate, db: Session = Depends(get_db)):
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Investor name is required")

    investor = Investor(
        name=payload.name.strip(),
        phone=payload.phone,
        email=payload.email,
        address=payload.address,
        ownership_pct=payload.ownership_pct or 0.0,
        notes=payload.notes,
    )
    db.add(investor)
    db.commit()
    db.refresh(investor)

    return {
        "status": "success",
        "message": f"Investor '{investor.name}' registered successfully!",
        "investor": {
            "id": investor.id,
            "name": investor.name,
            "phone": investor.phone,
            "email": investor.email,
            "ownership_pct": investor.ownership_pct,
        },
    }


@router.post("/{investor_id}/invest")
def record_investment(investor_id: int, payload: InvestmentCreate, db: Session = Depends(get_db)):
    investor = db.query(Investor).filter(Investor.id == investor_id).first()
    if not investor:
        raise HTTPException(status_code=404, detail="Investor not found")

    if payload.amount_npr <= 0:
        raise HTTPException(status_code=400, detail="Investment amount must be greater than zero")

    bank_acc = _get_account_head(db, "1002") or _get_account_head(db, "1001")
    equity_acc = _get_account_head(db, "3001") or _get_account_head(db, "3002")

    journal_id = None
    ref = payload.reference or f"EQUITY-{payload.investment_date.strftime('%Y%m%d')}-{investor.id}"

    if bank_acc and equity_acc:
        je = JournalEntry(
            entry_date=payload.investment_date,
            reference=ref,
            narration=f"Equity Investment from {investor.name} ({payload.notes or 'Capital injection'})",
        )
        je.lines = [
            JournalLine(
                account_id=bank_acc.id,
                debit_npr=payload.amount_npr,
                credit_npr=0.0,
                description=f"Bank Deposit - Investment from {investor.name}",
            ),
            JournalLine(
                account_id=equity_acc.id,
                debit_npr=0.0,
                credit_npr=payload.amount_npr,
                description=f"Owner's Equity Capital ({investor.name})",
            ),
        ]
        db.add(je)
        db.flush()
        journal_id = je.id

    rec = InvestmentRecord(
        investor_id=investor.id,
        amount_npr=payload.amount_npr,
        investment_date=payload.investment_date,
        payment_method=payload.payment_method or "BANK",
        reference=ref,
        journal_entry_id=journal_id,
        notes=payload.notes,
    )
    db.add(rec)
    db.commit()

    return {
        "status": "success",
        "message": f"Investment of Rs. {payload.amount_npr:,.2f} recorded for {investor.name}!",
        "investment_id": rec.id,
    }
