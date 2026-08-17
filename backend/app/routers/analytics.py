from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from datetime import date
import json

from app.database import get_db
from app.models import JournalEntry, JournalLine, AccountHead, Inventory, BankLoan, Investor, InvestmentRecord

from app.services.auth import require_roles

router = APIRouter(dependencies=[Depends(require_roles(["ADMIN", "ACCOUNTANT", "STAFF"]))])


def _get_sales_revenue_account_id(db: Session) -> int:
    acc = db.query(AccountHead).filter(AccountHead.code == "4001").first()
    if not acc:
        acc = AccountHead(code="4001", name="Sales Revenue", account_type="INCOME", normal_balance="CREDIT")
        db.add(acc)
        db.commit()
        db.refresh(acc)
    return acc.id


def _get_cogs_account_id(db: Session) -> int:
    acc = db.query(AccountHead).filter(AccountHead.code == "5001").first()
    if not acc:
        acc = AccountHead(code="5001", name="Cost of Goods Sold", account_type="EXPENSE", normal_balance="DEBIT")
        db.add(acc)
        db.commit()
        db.refresh(acc)
    return acc.id


from typing import Optional
from fastapi import Query
from app.routers.journal import parse_fiscal_year

@router.get("/")
def analytics_overview(
    fiscal_year: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    # Auto-repair account heads if missing
    from app.routers.journal import ensure_default_account_heads
    ensure_default_account_heads(db)

    sales_acc_id = _get_sales_revenue_account_id(db)
    cogs_acc_id = _get_cogs_account_id(db)

    fy_start, fy_end = parse_fiscal_year(fiscal_year)

    # Aggregate monthly by joining JournalLine → JournalEntry
    monthly_data = {}

    # Revenue (credit side of sales account)
    if sales_acc_id:
        rev_q = (
            db.query(
                JournalEntry.entry_date,
                func.sum(JournalLine.credit_npr).label("revenue"),
            )
            .join(JournalLine, JournalEntry.id == JournalLine.entry_id)
            .filter(JournalLine.account_id == sales_acc_id)
        )
        if fy_start and fy_end:
            rev_q = rev_q.filter(JournalEntry.entry_date >= fy_start, JournalEntry.entry_date <= fy_end)
        revenue_rows = rev_q.group_by(JournalEntry.entry_date).all()
        for row in revenue_rows:
            key = row.entry_date.strftime("%Y-%m")
            monthly_data.setdefault(key, {"month": key, "revenue_npr": 0, "cogs_npr": 0})
            monthly_data[key]["revenue_npr"] += float(row.revenue or 0)

    # COGS (debit side of COGS account)
    if cogs_acc_id:
        cogs_q = (
            db.query(
                JournalEntry.entry_date,
                func.sum(JournalLine.debit_npr).label("cogs"),
            )
            .join(JournalLine, JournalEntry.id == JournalLine.entry_id)
            .filter(JournalLine.account_id == cogs_acc_id)
        )
        if fy_start and fy_end:
            cogs_q = cogs_q.filter(JournalEntry.entry_date >= fy_start, JournalEntry.entry_date <= fy_end)
        cogs_rows = cogs_q.group_by(JournalEntry.entry_date).all()
        for row in cogs_rows:
            key = row.entry_date.strftime("%Y-%m")
            monthly_data.setdefault(key, {"month": key, "revenue_npr": 0, "cogs_npr": 0})
            monthly_data[key]["cogs_npr"] += float(row.cogs or 0)

    # Fallback / Backup check on JournalEntries directly if lines were omitted
    sale_entries = db.query(JournalEntry).all()
    for je in sale_entries:
        if je.reference and (je.reference.startswith("INV-") or "Sale of" in (je.narration or "")):
            key = je.entry_date.strftime("%Y-%m")
            monthly_data.setdefault(key, {"month": key, "revenue_npr": 0, "cogs_npr": 0})
            # Ensure revenue isn't 0 if entry exists
            if monthly_data[key]["revenue_npr"] == 0 and je.lines:
                total_entry_debit = sum(l.debit_npr for l in je.lines if l.debit_npr > 0)
                monthly_data[key]["revenue_npr"] = total_entry_debit

    result = sorted(monthly_data.values(), key=lambda x: x["month"])
    for row in result:
        row["revenue_npr"] = round(row["revenue_npr"], 2)
        row["cogs_npr"] = round(row["cogs_npr"], 2)
        row["gross_profit_npr"] = round(row["revenue_npr"] - row["cogs_npr"], 2)
        row["gross_margin_pct"] = round(
            (row["gross_profit_npr"] / row["revenue_npr"] * 100) if row["revenue_npr"] > 0 else 0, 1
        )

    # KPI totals
    total_revenue = sum(r["revenue_npr"] for r in result)
    total_cogs = sum(r["cogs_npr"] for r in result)
    inventory_value = db.query(
        func.sum(Inventory.import_cost_npr * Inventory.stock_qty)
    ).scalar() or 0

    active_loans = db.query(BankLoan).filter(BankLoan.is_closed == False).count()
    total_loan_principal = db.query(func.sum(BankLoan.principal_npr)).filter(BankLoan.is_closed == False).scalar() or 0

    # Investor capital & bank loan remaining capital
    total_investor_capital = db.query(func.sum(InvestmentRecord.amount_npr)).scalar() or 0
    total_bank_loan_capital = float(total_loan_principal)

    return {
        "monthly": result,
        "kpis": {
            "total_revenue_npr": round(total_revenue, 2),
            "total_cogs_npr": round(total_cogs, 2),
            "total_gross_profit_npr": round(total_revenue - total_cogs, 2),
            "inventory_value_npr": round(float(inventory_value), 2),
            "active_loans": active_loans,
            "total_loan_principal_npr": round(float(total_loan_principal), 2),
            "total_investor_capital_npr": round(float(total_investor_capital), 2),
            "total_bank_loan_capital_npr": round(float(total_bank_loan_capital), 2),
        },
    }


@router.get("/forecast")
def forecast_revenue(db: Session = Depends(get_db)):
    """Pure-Python linear regression forecast for next 3 months revenue (zero external dependencies)."""
    sales_acc_id = _get_sales_revenue_account_id(db)
    if not sales_acc_id:
        return {"historical": [], "forecast": [], "model": {"slope": 0.0, "intercept": 0.0}}

    rows = (
        db.query(
            JournalEntry.entry_date,
            func.sum(JournalLine.credit_npr).label("revenue"),
        )
        .join(JournalLine, JournalEntry.id == JournalLine.entry_id)
        .filter(JournalLine.account_id == sales_acc_id)
        .group_by(JournalEntry.entry_date)
        .all()
    )

    if not rows:
        return {"historical": [], "forecast": [], "model": {"slope": 0.0, "intercept": 0.0}}

    monthly_dict = {}
    for r in rows:
        if not r.entry_date:
            continue
        m_key = r.entry_date.strftime("%Y-%m")
        monthly_dict[m_key] = monthly_dict.get(m_key, 0.0) + float(r.revenue or 0)

    # Sort months chronologically
    sorted_months = sorted(monthly_dict.keys())
    historical = [{"month": m, "revenue_npr": round(monthly_dict[m], 2)} for m in sorted_months]

    if len(historical) < 2:
        return {
            "historical": historical,
            "forecast": [],
            "model": {"slope": 0.0, "intercept": round(historical[0]["revenue_npr"], 2) if historical else 0.0}
        }

    # Least squares linear regression: y = slope * x + intercept
    n = len(historical)
    y_vals = [h["revenue_npr"] for h in historical]
    sum_x = sum(i for i in range(n))
    sum_y = sum(y_vals)
    sum_xx = sum(i * i for i in range(n))
    sum_xy = sum(i * y for i, y in enumerate(y_vals))

    denom = (n * sum_xx - sum_x * sum_x)
    if denom != 0:
        slope = (n * sum_xy - sum_x * sum_y) / denom
        intercept = (sum_y - slope * sum_x) / n
    else:
        slope = 0.0
        intercept = sum_y / n if n > 0 else 0.0

    # Project next 3 months
    last_month_str = sorted_months[-1]
    last_year = int(last_month_str[:4])
    last_month = int(last_month_str[5:7])

    forecast = []
    for step in range(1, 4):
        pred_idx = (n - 1) + step
        pred_revenue = max(0.0, slope * pred_idx + intercept)
        
        # Next calendar month
        target_month_num = last_month + step
        target_year = last_year + (target_month_num - 1) // 12
        target_month_in_year = (target_month_num - 1) % 12 + 1
        target_month_str = f"{target_year:04d}-{target_month_in_year:02d}"

        forecast.append({
            "month": target_month_str,
            "predicted_revenue_npr": round(pred_revenue, 2),
        })

    return {
        "historical": historical,
        "forecast": forecast,
        "model": {
            "slope": round(float(slope), 2),
            "intercept": round(float(intercept), 2),
        },
    }
