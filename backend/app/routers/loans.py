from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional
from datetime import date, timedelta
from app.database import get_db
from app.models import BankLoan, LoanRepayment, JournalEntry, JournalLine, AccountHead
from app.services.auth import require_roles

router = APIRouter(dependencies=[Depends(require_roles(["ADMIN"]))])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class LoanCreate(BaseModel):
    bank_name: str
    loan_account_no: Optional[str] = None
    principal_npr: float
    annual_interest_rate: float = 10.0
    disbursement_date: date
    due_date: Optional[date] = None
    purpose: Optional[str] = None


class RepaymentCreate(BaseModel):
    payment_date: date
    principal_paid_npr: float = 0.0
    interest_paid_npr: float = 0.0
    notes: Optional[str] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _calc_interest(loan: BankLoan, as_of: date) -> float:
    """Simple interest: P × r × t (t in years)."""
    days = (as_of - loan.disbursement_date).days
    if days <= 0:
        return 0.0
    t = days / 365.0
    interest = loan.principal_npr * (loan.annual_interest_rate / 100) * t
    return round(interest, 2)


def _total_repaid(loan: BankLoan) -> tuple[float, float]:
    principal = sum(r.principal_paid_npr for r in loan.repayments)
    interest = sum(r.interest_paid_npr for r in loan.repayments)
    return round(principal, 2), round(interest, 2)


def _loan_summary(loan: BankLoan, as_of: date = None) -> dict:
    if as_of is None:
        as_of = date.today()
    accrued = _calc_interest(loan, as_of)
    principal_paid, interest_paid = _total_repaid(loan)
    outstanding_principal = round(loan.principal_npr - principal_paid, 2)
    outstanding_interest = round(accrued - interest_paid, 2)
    return {
        "id": loan.id,
        "bank_name": loan.bank_name,
        "loan_account_no": loan.loan_account_no,
        "principal_npr": loan.principal_npr,
        "annual_interest_rate": loan.annual_interest_rate,
        "disbursement_date": loan.disbursement_date,
        "due_date": loan.due_date,
        "purpose": loan.purpose,
        "is_closed": loan.is_closed,
        "accrued_interest_npr": accrued,
        "principal_paid_npr": principal_paid,
        "interest_paid_npr": interest_paid,
        "outstanding_principal_npr": outstanding_principal,
        "outstanding_interest_npr": outstanding_interest,
        "total_outstanding_npr": round(outstanding_principal + max(outstanding_interest, 0), 2),
        "repayment_count": len(loan.repayments),
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@router.get("/")
def list_loans(db: Session = Depends(get_db)):
    loans = db.query(BankLoan).order_by(BankLoan.disbursement_date).all()
    return [_loan_summary(l) for l in loans]


@router.get("/summary")
def loans_summary(db: Session = Depends(get_db)):
    """Aggregate summary of all active loans."""
    loans = db.query(BankLoan).filter(BankLoan.is_closed == False).all()
    today = date.today()
    total_principal = sum(l.principal_npr for l in loans)
    total_accrued_interest = sum(_calc_interest(l, today) for l in loans)
    total_principal_paid = sum(_total_repaid(l)[0] for l in loans)
    total_interest_paid = sum(_total_repaid(l)[1] for l in loans)
    return {
        "active_loans": len(loans),
        "total_principal_npr": round(total_principal, 2),
        "total_accrued_interest_npr": round(total_accrued_interest, 2),
        "total_principal_paid_npr": round(total_principal_paid, 2),
        "total_interest_paid_npr": round(total_interest_paid, 2),
        "total_outstanding_npr": round(
            (total_principal - total_principal_paid) + max(total_accrued_interest - total_interest_paid, 0), 2
        ),
    }


@router.get("/{loan_id}")
def get_loan(loan_id: int, db: Session = Depends(get_db)):
    loan = db.query(BankLoan).filter(BankLoan.id == loan_id).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    summary = _loan_summary(loan)
    summary["repayments"] = [
        {
            "id": r.id,
            "payment_date": r.payment_date,
            "principal_paid_npr": r.principal_paid_npr,
            "interest_paid_npr": r.interest_paid_npr,
            "total_paid_npr": r.total_paid_npr,
            "notes": r.notes,
        }
        for r in sorted(loan.repayments, key=lambda r: r.payment_date)
    ]
    return summary


from app.services.backup import trigger_auto_backup

@router.post("/", status_code=201)
def create_loan(payload: LoanCreate, db: Session = Depends(get_db)):
    loan = BankLoan(**payload.model_dump())
    db.add(loan)
    db.flush()

    # Look up Account Heads: Bank Account (1002) and Bank Loan Payable (2002)
    acc_bank = db.query(AccountHead).filter(AccountHead.code == "1002").first()
    acc_loan = db.query(AccountHead).filter(AccountHead.code == "2002").first()

    if acc_bank and acc_loan and loan.principal_npr > 0:
        entry = JournalEntry(
            entry_date=loan.disbursement_date,
            reference=loan.loan_account_no or f"LOAN-{loan.id}",
            narration=f"Disbursement of bank loan from {loan.bank_name} ({loan.purpose or 'Working capital'})",
        )
        db.add(entry)
        db.flush()

        # Debit Bank Account (Increase cash/bank asset to spend on inventory)
        db.add(JournalLine(
            entry_id=entry.id, account_id=acc_bank.id,
            debit_npr=loan.principal_npr, credit_npr=0.0, description=f"Loan funds received from {loan.bank_name}"
        ))

        # Credit Bank Loan Payable (Increase bank loan liability)
        db.add(JournalLine(
            entry_id=entry.id, account_id=acc_loan.id,
            debit_npr=0.0, credit_npr=loan.principal_npr, description=f"Bank loan liability to {loan.bank_name}"
        ))

    db.commit()
    db.refresh(loan)
    trigger_auto_backup()
    return _loan_summary(loan)


@router.post("/{loan_id}/repayments", status_code=201)
def add_repayment(loan_id: int, payload: RepaymentCreate, db: Session = Depends(get_db)):
    loan = db.query(BankLoan).filter(BankLoan.id == loan_id).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    total = payload.principal_paid_npr + payload.interest_paid_npr

    # Lookup account heads
    def get_acc(code):
        a = db.query(AccountHead).filter(AccountHead.code == code).first()
        if not a:
            raise HTTPException(status_code=500, detail=f"Account {code} not found — run seed first")
        return a

    loan_payable = get_acc("2002")
    interest_payable = get_acc("2003")
    bank_acc = get_acc("1002")

    # Auto-post journal entry
    je = JournalEntry(
        entry_date=payload.payment_date,
        reference=f"LREP-{loan_id}-{payload.payment_date.strftime('%Y%m%d')}",
        narration=f"Loan repayment to {loan.bank_name}" + (f" — {payload.notes}" if payload.notes else ""),
    )
    je.lines = [
        JournalLine(account_id=loan_payable.id, debit_npr=payload.principal_paid_npr, credit_npr=0),
        JournalLine(account_id=interest_payable.id, debit_npr=payload.interest_paid_npr, credit_npr=0),
        JournalLine(account_id=bank_acc.id, debit_npr=0, credit_npr=total),
    ]
    db.add(je)
    db.flush()

    rep = LoanRepayment(
        loan_id=loan_id,
        payment_date=payload.payment_date,
        principal_paid_npr=payload.principal_paid_npr,
        interest_paid_npr=payload.interest_paid_npr,
        total_paid_npr=total,
        journal_entry_id=je.id,
        notes=payload.notes,
    )
    db.add(rep)
    db.commit()
    db.refresh(loan)
    trigger_auto_backup()
    return _loan_summary(loan)


class RepaymentUpdate(BaseModel):
    payment_date: Optional[date] = None
    principal_paid_npr: Optional[float] = None
    interest_paid_npr: Optional[float] = None
    notes: Optional[str] = None


class LoanUpdate(BaseModel):
    bank_name: Optional[str] = None
    loan_account_no: Optional[str] = None
    principal_npr: Optional[float] = None
    annual_interest_rate: Optional[float] = None
    disbursement_date: Optional[date] = None
    due_date: Optional[date] = None
    purpose: Optional[str] = None
    is_closed: Optional[bool] = None


@router.patch("/{loan_id}")
def update_loan(loan_id: int, payload: LoanUpdate, db: Session = Depends(get_db)):
    loan = db.query(BankLoan).filter(BankLoan.id == loan_id).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(loan, field, value)
    db.commit()
    db.refresh(loan)
    trigger_auto_backup()
    return _loan_summary(loan)


@router.patch("/repayments/{repayment_id}")
def update_repayment(repayment_id: int, payload: RepaymentUpdate, db: Session = Depends(get_db)):
    rep = db.query(LoanRepayment).filter(LoanRepayment.id == repayment_id).first()
    if not rep:
        raise HTTPException(status_code=404, detail="Repayment not found")

    if payload.payment_date is not None:
        rep.payment_date = payload.payment_date
    if payload.principal_paid_npr is not None:
        rep.principal_paid_npr = payload.principal_paid_npr
    if payload.interest_paid_npr is not None:
        rep.interest_paid_npr = payload.interest_paid_npr
    if payload.notes is not None:
        rep.notes = payload.notes

    rep.total_paid_npr = rep.principal_paid_npr + rep.interest_paid_npr

    # Update associated JournalEntry if present
    if rep.journal_entry_id:
        je = db.query(JournalEntry).filter(JournalEntry.id == rep.journal_entry_id).first()
        if je:
            je.entry_date = rep.payment_date
            je.narration = f"Loan repayment to {rep.loan.bank_name}" + (f" — {rep.notes}" if rep.notes else "")
            for line in je.lines:
                if line.account and line.account.code == "2002":
                    line.debit_npr = rep.principal_paid_npr
                elif line.account and line.account.code == "2003":
                    line.debit_npr = rep.interest_paid_npr
                elif line.account and line.account.code == "1002":
                    line.credit_npr = rep.total_paid_npr

    db.commit()
    db.refresh(rep)
    trigger_auto_backup()
    return {"status": "success", "message": "Repayment amount updated successfully", "repayment_id": rep.id}


@router.delete("/repayments/{repayment_id}", status_code=204)
def delete_repayment(repayment_id: int, db: Session = Depends(get_db)):
    rep = db.query(LoanRepayment).filter(LoanRepayment.id == repayment_id).first()
    if not rep:
        raise HTTPException(status_code=404, detail="Repayment not found")

    # Delete journal entry if present
    if rep.journal_entry_id:
        je = db.query(JournalEntry).filter(JournalEntry.id == rep.journal_entry_id).first()
        if je:
            db.delete(je)

    db.delete(rep)
    db.commit()
    trigger_auto_backup()


@router.patch("/{loan_id}/close")
def close_loan(loan_id: int, db: Session = Depends(get_db)):
    loan = db.query(BankLoan).filter(BankLoan.id == loan_id).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    loan.is_closed = True
    db.commit()
    trigger_auto_backup()
    return {"message": "Loan closed"}

