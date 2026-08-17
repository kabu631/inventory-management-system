from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import date
from app.database import get_db
from app.models import JournalEntry, JournalLine, AccountHead
from app.services.auth import require_roles

router = APIRouter(dependencies=[Depends(require_roles(["ADMIN", "ACCOUNTANT"]))])

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
    category: Optional[str] = "GENERAL"
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
        "category": entry.category or "GENERAL",
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
def get_fiscal_year_for_date(d: date) -> str:
    if d.month > 7 or (d.month == 7 and d.day >= 16):
        bs_start = d.year + 57
    else:
        bs_start = d.year + 56
    bs_end_short = str(bs_start + 1)[-2:]
    return f"{bs_start}/{bs_end_short}"


@router.get("/fiscal-years")
def get_fiscal_years(db: Session = Depends(get_db)):
    today = date.today()
    current_fy = get_fiscal_year_for_date(today)
    current_bs_start = int(current_fy.split("/")[0])

    fys = set()
    for y in range(current_bs_start - 3, current_bs_start + 6):
        fys.add(f"{y}/{str(y+1)[-2:]}")

    entries = db.query(JournalEntry.entry_date).distinct().all()
    for row in entries:
        if row.entry_date:
            fys.add(get_fiscal_year_for_date(row.entry_date))

    return {
        "current_fiscal_year": current_fy,
        "fiscal_years": sorted(list(fys))
    }


def parse_fiscal_year(fy: str):
    if not fy:
        return None, None
    fy = fy.strip()
    if "/" in fy:
        parts = fy.split("/")
        try:
            y1 = int(parts[0])
            if y1 > 2050:
                greg_start = y1 - 57
                return date(greg_start, 7, 16), date(greg_start + 1, 7, 15)
            else:
                return date(y1, 7, 16), date(y1 + 1, 7, 15)
        except Exception:
            pass
    elif fy.isdigit():
        y = int(fy)
        if y > 2050:
            greg_start = y - 57
            return date(greg_start, 7, 16), date(greg_start + 1, 7, 15)
        else:
            return date(y, 1, 1), date(y, 12, 31)
    return None, None



@router.get("/")
def list_entries(
    skip: int = 0,
    limit: int = 100,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    category: Optional[str] = Query(None),
    fiscal_year: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(JournalEntry).order_by(JournalEntry.entry_date.desc(), JournalEntry.id.desc())

    fy_start, fy_end = parse_fiscal_year(fiscal_year)
    if fy_start and fy_end:
        q = q.filter(JournalEntry.entry_date >= fy_start, JournalEntry.entry_date <= fy_end)
    else:
        if start_date:
            q = q.filter(JournalEntry.entry_date >= start_date)
        if end_date:
            q = q.filter(JournalEntry.entry_date <= end_date)

    if category and category.upper() != "ALL":
        q = q.filter(JournalEntry.category == category.upper())

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


@router.get("/trial-balance")
def get_trial_balance(
    fiscal_year: Optional[str] = Query(None),
    as_of_date: Optional[date] = Query(None),
    db: Session = Depends(get_db)
):
    """Generates double-entry Trial Balance verifying Debit == Credit."""
    accounts = db.query(AccountHead).order_by(AccountHead.code).all()
    fy_start, fy_end = parse_fiscal_year(fiscal_year)

    rows = []
    total_debit = 0.0
    total_credit = 0.0

    for acc in accounts:
        q = db.query(JournalLine).join(JournalEntry, JournalLine.entry_id == JournalEntry.id).filter(JournalLine.account_id == acc.id)
        if fy_start and fy_end:
            q = q.filter(JournalEntry.entry_date >= fy_start, JournalEntry.entry_date <= fy_end)
        elif as_of_date:
            q = q.filter(JournalEntry.entry_date <= as_of_date)

        lines = q.all()
        d_sum = sum(l.debit_npr for l in lines)
        c_sum = sum(l.credit_npr for l in lines)
        
        # Calculate net debit / credit balance based on normal balance
        if acc.normal_balance == "DEBIT":
            net = d_sum - c_sum
            debit_bal = max(0.0, net)
            credit_bal = max(0.0, -net)
        else:
            net = c_sum - d_sum
            credit_bal = max(0.0, net)
            debit_bal = max(0.0, -net)

        total_debit += debit_bal
        total_credit += credit_bal

        rows.append({
            "account_id": acc.id,
            "code": acc.code,
            "name": acc.name,
            "account_type": acc.account_type,
            "normal_balance": acc.normal_balance,
            "total_debit_npr": round(d_sum, 2),
            "total_credit_npr": round(c_sum, 2),
            "debit_balance_npr": round(debit_bal, 2),
            "credit_balance_npr": round(credit_bal, 2),
        })

    return {
        "as_of_date": as_of_date.strftime("%Y-%m-%d") if as_of_date else str(date.today()),
        "fiscal_year": fiscal_year or "ALL",
        "total_debit_npr": round(total_debit, 2),
        "total_credit_npr": round(total_credit, 2),
        "is_balanced": abs(total_debit - total_credit) < 0.01,
        "rows": rows,
    }


@router.get("/balance-sheet")
def get_balance_sheet(
    fiscal_year: Optional[str] = Query(None),
    as_of_date: Optional[date] = Query(None),
    db: Session = Depends(get_db)
):
    """Generates official Corporate Balance Sheet (Assets = Liabilities + Equity)."""
    ensure_default_account_heads(db)
    tb = get_trial_balance(fiscal_year=fiscal_year, as_of_date=as_of_date, db=db)
    
    assets = []
    liabilities = []
    equity = []
    
    total_assets = 0.0
    total_liabilities = 0.0
    total_equity = 0.0

    for r in tb["rows"]:
        if r["account_type"] == "ASSET":
            bal = r["debit_balance_npr"] - r["credit_balance_npr"]
            assets.append({**r, "balance_npr": bal})
            total_assets += bal
        elif r["account_type"] == "LIABILITY":
            bal = r["credit_balance_npr"] - r["debit_balance_npr"]
            liabilities.append({**r, "balance_npr": bal})
            total_liabilities += bal
        elif r["account_type"] == "EQUITY":
            bal = r["credit_balance_npr"] - r["debit_balance_npr"]
            equity.append({**r, "balance_npr": bal})
            total_equity += bal

    # Net income from income - expenses
    total_income = sum(r["credit_balance_npr"] - r["debit_balance_npr"] for r in tb["rows"] if r["account_type"] == "INCOME")
    total_expense = sum(r["debit_balance_npr"] - r["credit_balance_npr"] for r in tb["rows"] if r["account_type"] == "EXPENSE")
    current_period_profit = total_income - total_expense

    total_equity_and_reserves = total_equity + current_period_profit

    return {
        "as_of_date": tb["as_of_date"],
        "assets": assets,
        "liabilities": liabilities,
        "equity": equity,
        "current_period_profit_npr": round(current_period_profit, 2),
        "total_assets_npr": round(total_assets, 2),
        "total_liabilities_npr": round(total_liabilities, 2),
        "total_equity_npr": round(total_equity_and_reserves, 2),
        "total_liabilities_and_equity_npr": round(total_liabilities + total_equity_and_reserves, 2),
        "is_balanced": abs(total_assets - (total_liabilities + total_equity_and_reserves)) < 0.01,
    }


@router.get("/profit-loss")
def get_profit_loss(
    fiscal_year: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db)
):
    """Generates Profit & Loss Statement (Income - COGS - Operating Expenses = Net Profit)."""
    ensure_default_account_heads(db)
    accounts = db.query(AccountHead).filter(AccountHead.account_type.in_(["INCOME", "EXPENSE"])).order_by(AccountHead.code).all()
    fy_start, fy_end = parse_fiscal_year(fiscal_year)

    income_items = []
    cogs_items = []
    expense_items = []

    total_revenue = 0.0
    total_cogs = 0.0
    total_operating_expenses = 0.0

    for acc in accounts:
        q = db.query(JournalLine).join(JournalEntry, JournalLine.entry_id == JournalEntry.id).filter(JournalLine.account_id == acc.id)
        if fy_start and fy_end:
            q = q.filter(JournalEntry.entry_date >= fy_start, JournalEntry.entry_date <= fy_end)
        else:
            if start_date:
                q = q.filter(JournalEntry.entry_date >= start_date)
            if end_date:
                q = q.filter(JournalEntry.entry_date <= end_date)

        lines = q.all()
        d_sum = sum(l.debit_npr for l in lines)
        c_sum = sum(l.credit_npr for l in lines)

        if acc.account_type == "INCOME":
            net_income = round(c_sum - d_sum, 2)
            income_items.append({"code": acc.code, "name": acc.name, "amount_npr": net_income})
            total_revenue += net_income
        elif acc.account_type == "EXPENSE":
            net_exp = round(d_sum - c_sum, 2)
            if acc.code == "5001":
                cogs_items.append({"code": acc.code, "name": acc.name, "amount_npr": net_exp})
                total_cogs += net_exp
            else:
                expense_items.append({"code": acc.code, "name": acc.name, "amount_npr": net_exp})
                total_operating_expenses += net_exp

    gross_profit = round(total_revenue - total_cogs, 2)
    net_profit = round(gross_profit - total_operating_expenses, 2)

    return {
        "fiscal_year": fiscal_year or "ALL",
        "income_items": income_items,
        "cogs_items": cogs_items,
        "operating_expense_items": expense_items,
        "total_revenue_npr": round(total_revenue, 2),
        "total_cogs_npr": round(total_cogs, 2),
        "gross_profit_npr": gross_profit,
        "total_operating_expenses_npr": round(total_operating_expenses, 2),
        "net_profit_npr": net_profit,
    }


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
        category=payload.category or "GENERAL",
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
