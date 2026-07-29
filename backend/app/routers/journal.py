from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import date
from app.database import get_db
from app.models import JournalEntry, JournalLine, AccountHead

router = APIRouter()

DEFAULT_ACCOUNT_HEADS = [
    # ASSETS
    {"code": "1001", "name": "Cash in Hand",            "account_type": "ASSET",     "normal_balance": "DEBIT"},
    {"code": "1002", "name": "Bank Account - NBL",      "account_type": "ASSET",     "normal_balance": "DEBIT"},
    {"code": "1003", "name": "Accounts Receivable",     "account_type": "ASSET",     "normal_balance": "DEBIT"},
    {"code": "1004", "name": "Inventory / Stock",       "account_type": "ASSET",     "normal_balance": "DEBIT"},
    {"code": "1005", "name": "Prepaid Expenses",        "account_type": "ASSET",     "normal_balance": "DEBIT"},
    # LIABILITIES
    {"code": "2001", "name": "Accounts Payable",        "account_type": "LIABILITY", "normal_balance": "CREDIT"},
    {"code": "2002", "name": "Bank Loan Payable",       "account_type": "LIABILITY", "normal_balance": "CREDIT"},
    {"code": "2003", "name": "Interest Payable",        "account_type": "LIABILITY", "normal_balance": "CREDIT"},
    {"code": "2004", "name": "VAT Payable",             "account_type": "LIABILITY", "normal_balance": "CREDIT"},
    # EQUITY
    {"code": "3001", "name": "Owner's Equity",          "account_type": "EQUITY",    "normal_balance": "CREDIT"},
    {"code": "3002", "name": "Retained Earnings",       "account_type": "EQUITY",    "normal_balance": "CREDIT"},
    # INCOME
    {"code": "4001", "name": "Sales Revenue",           "account_type": "INCOME",    "normal_balance": "CREDIT"},
    {"code": "4002", "name": "Other Income",            "account_type": "INCOME",    "normal_balance": "CREDIT"},
    # EXPENSES
    {"code": "5001", "name": "Cost of Goods Sold",      "account_type": "EXPENSE",   "normal_balance": "DEBIT"},
    {"code": "5002", "name": "Interest Expense",        "account_type": "EXPENSE",   "normal_balance": "DEBIT"},
    {"code": "5003", "name": "Freight & Import Charges","account_type": "EXPENSE",   "normal_balance": "DEBIT"},
    {"code": "5004", "name": "Salary Expense",          "account_type": "EXPENSE",   "normal_balance": "DEBIT"},
    {"code": "5005", "name": "Rent Expense",            "account_type": "EXPENSE",   "normal_balance": "DEBIT"},
    {"code": "5006", "name": "Utilities Expense",       "account_type": "EXPENSE",   "normal_balance": "DEBIT"},
]


def ensure_default_account_heads(db: Session):
    for ah in DEFAULT_ACCOUNT_HEADS:
        existing = db.query(AccountHead).filter(AccountHead.code == ah["code"]).first()
        if not existing:
            db.add(AccountHead(**ah))
    db.commit()


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------
class JournalLineIn(BaseModel):
    account_id: int
    customer_id: Optional[int] = None
    inventory_id: Optional[int] = None
    debit_npr: float = 0.0
    credit_npr: float = 0.0
    description: Optional[str] = None


class JournalEntryCreate(BaseModel):
    entry_date: date
    reference: Optional[str] = None
    narration: Optional[str] = None
    lines: List[JournalLineIn]

    @field_validator("lines")
    @classmethod
    def must_balance(cls, lines):
        total_debit = sum(l.debit_npr for l in lines)
        total_credit = sum(l.credit_npr for l in lines)
        if abs(total_debit - total_credit) > 0.01:
            raise ValueError(
                f"Journal entry does not balance: debits={total_debit:.2f} credits={total_credit:.2f}"
            )
        if len(lines) < 2:
            raise ValueError("At least 2 journal lines are required")
        return lines


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _serialize_entry(entry: JournalEntry) -> dict:
    # For sales entries that include internal COGS lines (5001), exclude COGS from the main transaction summary total
    # so the journal table displays the actual Sales Invoice Bill Amount (e.g. Rs.38,000 instead of 38,000 + 20,000 COGS = 58,000).
    total_debit = sum(
        l.debit_npr for l in entry.lines
        if not (l.account and l.account.code == "5001")
    )
    if total_debit == 0 and entry.lines:
        total_debit = sum(l.debit_npr for l in entry.lines)

    return {
        "id": entry.id,
        "entry_date": entry.entry_date,
        "reference": entry.reference,
        "narration": entry.narration,
        "is_posted": entry.is_posted,
        "created_at": entry.created_at,
        "total_debit_npr": total_debit,
        "lines": [
            {
                "id": l.id,
                "account_id": l.account_id,
                "account_code": l.account.code if l.account else None,
                "account_name": l.account.name if l.account else None,
                "customer_id": l.customer_id,
                "inventory_id": l.inventory_id,
                "debit_npr": l.debit_npr,
                "credit_npr": l.credit_npr,
                "description": l.description,
            }
            for l in entry.lines
        ],
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@router.get("/")
def list_entries(
    skip: int = 0,
    limit: int = 50,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(JournalEntry).order_by(JournalEntry.entry_date.desc(), JournalEntry.id.desc())
    if start_date:
        q = q.filter(JournalEntry.entry_date >= start_date)
    if end_date:
        q = q.filter(JournalEntry.entry_date <= end_date)
    entries = q.offset(skip).limit(limit).all()
    return [_serialize_entry(e) for e in entries]


@router.get("/accounts")
def list_accounts(db: Session = Depends(get_db)):
    accounts = db.query(AccountHead).order_by(AccountHead.code).all()
    return [
        {
            "id": a.id,
            "code": a.code,
            "name": a.name,
            "account_type": a.account_type,
            "normal_balance": a.normal_balance,
        }
        for a in accounts
    ]


import csv
import io
from datetime import datetime
from fastapi.responses import StreamingResponse


@router.get("/export/csv")
def export_journal_csv(db: Session = Depends(get_db)):
    """
    Exports all double-entry journal transactions as a CSV file formatted for Accounting & Tax Audits.
    """
    entries = db.query(JournalEntry).order_by(JournalEntry.entry_date.desc(), JournalEntry.id.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)

    # Header row
    writer.writerow([
        "Entry ID",
        "Date",
        "Reference No",
        "Narration",
        "Account Code",
        "Account Name",
        "Account Type",
        "Line Description",
        "Debit (NPR)",
        "Credit (NPR)",
    ])

    for entry in entries:
        for line in entry.lines:
            writer.writerow([
                entry.id,
                entry.entry_date.strftime("%Y-%m-%d"),
                entry.reference or "",
                entry.narration or "",
                line.account.code if line.account else "",
                line.account.name if line.account else "",
                line.account.account_type if line.account else "",
                line.description or "",
                f"{line.debit_npr:.2f}",
                f"{line.credit_npr:.2f}",
            ])

    output.seek(0)
    response = StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv"
    )
    response.headers["Content-Disposition"] = "attachment; filename=battery_erp_journal_tax_export.csv"
    return response


@router.get("/export/tax-clearance-csv")
def export_tax_clearance_csv(db: Session = Depends(get_db)):
    """
    Exports a Tax Clearance Summary CSV report (Trial Balance, Total Revenue, COGS, Assets, Liabilities).
    """
    accounts = db.query(AccountHead).order_by(AccountHead.code).all()
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["BATTERY ERP — TAX CLEARANCE & AUDIT REPORT"])
    writer.writerow([f"Generated On: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"])
    writer.writerow([])
    writer.writerow(["Account Code", "Account Name", "Account Category", "Total Debit (NPR)", "Total Credit (NPR)", "Net Balance (NPR)"])

    tot_debit = 0.0
    tot_credit = 0.0

    for acc in accounts:
        debit = sum(l.debit_npr for l in acc.journal_lines)
        credit = sum(l.credit_npr for l in acc.journal_lines)
        net = debit - credit
        writer.writerow([
            acc.code,
            acc.name,
            acc.account_type,
            f"{debit:.2f}",
            f"{credit:.2f}",
            f"{net:.2f}"
        ])
        tot_debit += debit
        tot_credit += credit

    writer.writerow([])
    writer.writerow(["TOTALS", "", "", f"{tot_debit:.2f}", f"{tot_credit:.2f}", f"{(tot_debit - tot_credit):.2f}"])

    output.seek(0)
    response = StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv"
    )
    response.headers["Content-Disposition"] = "attachment; filename=battery_erp_tax_clearance_summary.csv"
    return response


@router.get("/{entry_id}")
def get_entry(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(JournalEntry).filter(JournalEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    return _serialize_entry(entry)


from app.services.backup import trigger_auto_backup

@router.post("/", status_code=201)
def create_entry(payload: JournalEntryCreate, db: Session = Depends(get_db)):
    entry = JournalEntry(
        entry_date=payload.entry_date,
        reference=payload.reference,
        narration=payload.narration,
    )
    db.add(entry)
    db.flush()

    for line_in in payload.lines:
        acc = db.query(AccountHead).filter(AccountHead.id == line_in.account_id).first()
        if not acc:
            raise HTTPException(status_code=400, detail=f"Account id {line_in.account_id} not found")
        line = JournalLine(
            entry_id=entry.id,
            account_id=line_in.account_id,
            customer_id=line_in.customer_id,
            inventory_id=line_in.inventory_id,
            debit_npr=line_in.debit_npr,
            credit_npr=line_in.credit_npr,
            description=line_in.description,
        )
        db.add(line)

    db.commit()
    db.refresh(entry)
    trigger_auto_backup()
    return _serialize_entry(entry)


@router.delete("/{entry_id}", status_code=204)
def delete_entry(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(JournalEntry).filter(JournalEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    db.delete(entry)
    db.commit()
    trigger_auto_backup()
