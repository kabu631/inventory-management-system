from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional
from datetime import date
import io
import csv
from fastapi.responses import StreamingResponse
from app.database import get_db
from app.models import Customer, JournalLine, JournalEntry, BatterySerial, WarrantyClaim
from app.routers.company import get_company_dict

router = APIRouter()


class CustomerCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    customer_type: str = "B2C"
    credit_limit: float = 0.0
    pan_no: Optional[str] = None


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    customer_type: Optional[str] = None
    credit_limit: Optional[float] = None
    pan_no: Optional[str] = None


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
    Re-assigns all JournalLine.customer_id, BatterySerial.customer_id, and WarrantyClaim.customer_id
    references to the primary customer ID, then removes duplicate customer records.
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
            # Reassign all foreign keys from duplicate customer c.id to primary.id
            db.query(JournalLine).filter(JournalLine.customer_id == c.id).update(
                {JournalLine.customer_id: primary.id}, synchronize_session=False
            )
            db.query(BatterySerial).filter(BatterySerial.customer_id == c.id).update(
                {BatterySerial.customer_id: primary.id}, synchronize_session=False
            )
            db.query(WarrantyClaim).filter(WarrantyClaim.customer_id == c.id).update(
                {WarrantyClaim.customer_id: primary.id}, synchronize_session=False
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
            "pan_no": c.pan_no,
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
        "pan_no": c.pan_no,
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
            "pan_no": c.pan_no,
            "outstanding_balance_npr": get_customer_balance(db, c.id),
            "total_billed_npr": round(total_billed, 2),
            "total_paid_npr": round(total_paid, 2),
            "total_transactions": len(rows),
        },
        "ledger": rows
    }


@router.get("/{customer_id}/statement")
def customer_statement(customer_id: int, db: Session = Depends(get_db)):
    """Customer Account Statement & Receivables Summary."""
    return customer_ledger(customer_id, db)


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
        if payload.pan_no and payload.pan_no.strip():
            existing.pan_no = payload.pan_no.strip()
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


import csv
import io
from fastapi.responses import StreamingResponse

@router.get("/{customer_id}/ledger/export-csv")
def export_customer_ledger_csv(customer_id: int, db: Session = Depends(get_db)):
    """Export customer sales details and ledger as CSV file."""
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

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["CUSTOMER SALES & LEDGER STATEMENT"])
    writer.writerow([f"Customer Name: {c.name}", f"Type: {c.customer_type}", f"PAN No: {c.pan_no or 'N/A'}"])
    writer.writerow([f"Phone: {c.phone or 'N/A'}", f"Email: {c.email or 'N/A'}", f"Address: {c.address or 'N/A'}"])
    writer.writerow([])
    writer.writerow(["Line ID", "Entry ID", "Date", "Reference", "Narration", "Billed / Debit (NPR)", "Paid / Credit (NPR)", "Running Balance (NPR)"])

    running_bal = 0.0
    for line in lines:
        change = line.debit_npr - line.credit_npr
        running_bal += change
        entry_date = line.entry.entry_date.strftime("%Y-%m-%d") if hasattr(line.entry.entry_date, "strftime") else str(line.entry.entry_date)
        ref = line.entry.reference or f"INV-{line.entry_id:05d}"
        narration = line.description or line.entry.narration or ""
        writer.writerow([
            line.id, line.entry_id, entry_date, ref, narration,
            f"{line.debit_npr:.2f}", f"{line.credit_npr:.2f}", f"{running_bal:.2f}"
        ])

    writer.writerow([])
    writer.writerow(["NET OUTSTANDING BALANCE", "", "", "", "", "", "", f"{running_bal:.2f}"])

    output.seek(0)
    filename = f"customer_{c.id}_sales_statement.csv"
    response = StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv"
    )
    response.headers["Content-Disposition"] = f"attachment; filename={filename}"
    return response


@router.get("/export/all-sales-csv")
def export_all_customer_sales_csv(db: Session = Depends(get_db)):
    """Export summary of all customer sales and outstanding balances as CSV."""
    comp = get_company_dict(db)
    comp_name = comp.get("company_name", "COMPANY").upper()
    comp_pan = comp.get("pan_vat_no", "N/A")

    customers = db.query(Customer).order_by(Customer.name).all()

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([f"{comp_name} — CUSTOMER SALES SUMMARY REPORT"])
    writer.writerow([f"Generated Date: {date.today().strftime('%Y-%m-%d')}", f"Company PAN / VAT: {comp_pan}"])
    writer.writerow([])
    writer.writerow(["Customer ID", "Name", "Customer Type", "PAN No", "Phone", "Email", "Address", "Credit Limit (NPR)", "Outstanding Balance (NPR)"])

    total_receivable = 0.0
    for c in customers:
        bal = get_customer_balance(db, c.id)
        total_receivable += bal
        writer.writerow([
            c.id, c.name, c.customer_type, c.pan_no or "", c.phone or "", c.email or "", c.address or "",
            f"{c.credit_limit:.2f}", f"{bal:.2f}"
        ])

    writer.writerow([])
    writer.writerow(["TOTAL RECEIVABLE", "", "", "", "", "", "", "", f"{total_receivable:.2f}"])

    output.seek(0)
    response = StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv"
    )
    safe_filename = comp_name.lower().replace(" ", "_")[:20]
    response.headers["Content-Disposition"] = f"attachment; filename={safe_filename}_customer_sales_summary.csv"
    return response

