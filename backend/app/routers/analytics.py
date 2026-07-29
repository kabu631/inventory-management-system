from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from datetime import date
import json

from app.database import get_db
from app.models import JournalEntry, JournalLine, AccountHead, Inventory, BankLoan, Investor, InvestmentRecord

from app.services.auth import require_roles

router = APIRouter(dependencies=[Depends(require_roles(["ADMIN"]))])


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


@router.get("/")
def analytics_overview(db: Session = Depends(get_db)):
    # Auto-repair account heads if missing
    from app.routers.journal import ensure_default_account_heads
    ensure_default_account_heads(db)

    sales_acc_id = _get_sales_revenue_account_id(db)
    cogs_acc_id = _get_cogs_account_id(db)

    # Aggregate monthly by joining JournalLine → JournalEntry
    monthly_data = {}

    # Revenue (credit side of sales account)
    if sales_acc_id:
        revenue_rows = (
            db.query(
                JournalEntry.entry_date,
                func.sum(JournalLine.credit_npr).label("revenue"),
            )
            .join(JournalLine, JournalEntry.id == JournalLine.entry_id)
            .filter(JournalLine.account_id == sales_acc_id)
            .group_by(JournalEntry.entry_date)
            .all()
        )
        for row in revenue_rows:
            key = row.entry_date.strftime("%Y-%m")
            monthly_data.setdefault(key, {"month": key, "revenue_npr": 0, "cogs_npr": 0})
            monthly_data[key]["revenue_npr"] += float(row.revenue or 0)

    # COGS (debit side of COGS account)
    if cogs_acc_id:
        cogs_rows = (
            db.query(
                JournalEntry.entry_date,
                func.sum(JournalLine.debit_npr).label("cogs"),
            )
            .join(JournalLine, JournalEntry.id == JournalLine.entry_id)
            .filter(JournalLine.account_id == cogs_acc_id)
            .group_by(JournalEntry.entry_date)
            .all()
        )
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
    """Linear regression forecast for next 3 months revenue."""
    try:
        import pandas as pd
        from sklearn.linear_model import LinearRegression
        import numpy as np
    except ImportError:
        return {"error": "pandas/scikit-learn not installed"}

    sales_acc_id = _get_sales_revenue_account_id(db)
    if not sales_acc_id:
        return {"historical": [], "forecast": []}

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
        return {"historical": [], "forecast": []}

    df = pd.DataFrame([{"date": r.entry_date, "revenue": float(r.revenue or 0)} for r in rows])
    df["month"] = df["date"].apply(lambda d: d.strftime("%Y-%m"))
    monthly = df.groupby("month")["revenue"].sum().reset_index().sort_values("month")

    if len(monthly) < 3:
        return {"historical": monthly.to_dict(orient="records"), "forecast": []}

    monthly["t"] = range(len(monthly))
    X = monthly[["t"]].values
    y = monthly["revenue"].values

    model = LinearRegression()
    model.fit(X, y)

    # Forecast next 3 months
    last_t = monthly["t"].max()
    last_month = monthly["month"].max()
    last_date = date(int(last_month[:4]), int(last_month[5:7]), 1)

    forecast = []
    for i in range(1, 4):
        fm = i
        if last_date.month + fm <= 12:
            fdate = date(last_date.year, last_date.month + fm, 1)
        else:
            extra = (last_date.month + fm - 1) // 12
            fdate = date(last_date.year + extra, (last_date.month + fm - 1) % 12 + 1, 1)
        predicted = max(float(model.predict([[last_t + i]])[0]), 0)
        forecast.append({
            "month": fdate.strftime("%Y-%m"),
            "predicted_revenue_npr": round(predicted, 2),
        })

    return {
        "historical": [
            {"month": row["month"], "revenue_npr": round(row["revenue"], 2)}
            for _, row in monthly.iterrows()
        ],
        "forecast": forecast,
        "model": {
            "slope": round(float(model.coef_[0]), 2),
            "intercept": round(float(model.intercept_), 2),
        },
    }
