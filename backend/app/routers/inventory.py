from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import date
import csv
import io
from fastapi.responses import StreamingResponse

from app.database import get_db
from app.models import Inventory, User, Customer, AccountHead, JournalEntry, JournalLine
from app.routers.customers import get_customer_balance
from app.routers.company import get_company_dict
from app.services.auth import require_roles
from app.services.backup import trigger_auto_backup

router = APIRouter()


class InventoryCreate(BaseModel):
    sku: str
    name: str
    category: Optional[str] = None
    brand: Optional[str] = None
    unit_of_measure: Optional[str] = "pcs"
    specifications: Optional[str] = None
    capacity_ah: Optional[float] = None
    voltage_v: Optional[float] = None
    import_cost_npr: float = 0.0
    selling_price_npr: float = 0.0
    stock_qty: int = 0
    reorder_level: int = 5
    hs_code: Optional[str] = None


class InventoryUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    brand: Optional[str] = None
    unit_of_measure: Optional[str] = None
    specifications: Optional[str] = None
    capacity_ah: Optional[float] = None
    voltage_v: Optional[float] = None
    import_cost_npr: Optional[float] = None
    selling_price_npr: Optional[float] = None
    stock_qty: Optional[int] = None
    reorder_level: Optional[int] = None
    hs_code: Optional[str] = None


@router.get("/")
def list_inventory(db: Session = Depends(get_db)):
    items = db.query(Inventory).order_by(Inventory.sku).all()
    return [
        {
            "id": i.id,
            "sku": i.sku,
            "name": i.name,
            "category": i.category or "General",
            "brand": i.brand or "—",
            "unit_of_measure": i.unit_of_measure or "pcs",
            "specifications": i.specifications or (f"{i.voltage_v}V / {i.capacity_ah}Ah" if (i.voltage_v or i.capacity_ah) else "—"),
            "capacity_ah": i.capacity_ah,
            "voltage_v": i.voltage_v,
            "import_cost_npr": i.import_cost_npr,
            "selling_price_npr": i.selling_price_npr,
            "stock_qty": i.stock_qty,
            "reorder_level": i.reorder_level,
            "hs_code": i.hs_code,
            "inventory_value_npr": round(i.import_cost_npr * i.stock_qty, 2),
            "low_stock": i.stock_qty <= i.reorder_level,
        }
        for i in items
    ]


@router.get("/{item_id}")
def get_inventory_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(Inventory).filter(Inventory.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


@router.post("/", status_code=201)
def create_inventory(
    payload: InventoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "STAFF"])),
):
    existing = db.query(Inventory).filter(Inventory.sku == payload.sku).first()
    if existing:
        raise HTTPException(status_code=400, detail="SKU already exists")
    item = Inventory(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{item_id}")
def update_inventory(
    item_id: int,
    payload: InventoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "STAFF"])),
):
    item = db.query(Inventory).filter(Inventory.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


class SaleItemIn(BaseModel):
    inventory_id: int
    quantity: int
    unit_price_npr: Optional[float] = None
    discount_pct: Optional[float] = 0.0


class SalesInvoiceCreate(BaseModel):
    customer_id: int
    payment_method: str  # "CREDIT", "CASH", "BANK", "PARTIAL"
    invoice_date: date
    reference: Optional[str] = None
    items: List[SaleItemIn]
    apply_vat: Optional[bool] = False
    vat_rate: Optional[float] = 13.0
    paid_amount_npr: Optional[float] = None
    partial_payment_method: Optional[str] = "BANK"  # "CASH" or "BANK" for upfront payment portion
    discount_pct: Optional[float] = 0.0


@router.post("/sell", status_code=201)
def create_sales_invoice(
    payload: SalesInvoiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "STAFF"])),
):
    """
    Sells products to a customer:
    1. Validates stock availability.
    2. Decrements Inventory.stock_qty in real time.
    3. Handles Full Cash, Full Bank, Full Credit, or Partial Payments (Upfront Cash/Bank + Remaining Credit).
    4. Auto-posts balanced double-entry Journal Entry (AR / Cash / Bank, Sales Revenue, VAT Payable, COGS, Stock Reduction).
    5. Triggers automated backup to Google Drive.
    """
    if not payload.items:
        raise HTTPException(status_code=400, detail="At least 1 sale item is required")

    customer = db.query(Customer).filter(Customer.id == payload.customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    subtotal_revenue = 0.0
    total_cogs = 0.0
    processed_items = []

    # 1. Validate & process each item
    for item_in in payload.items:
        sku = db.query(Inventory).filter(Inventory.id == item_in.inventory_id).first()
        if not sku:
            raise HTTPException(status_code=404, detail=f"Inventory item ID {item_in.inventory_id} not found")

        if sku.stock_qty < item_in.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for '{sku.name}'. Available: {sku.stock_qty}, Requested: {item_in.quantity}"
            )

        unit_price = item_in.unit_price_npr if item_in.unit_price_npr is not None else sku.selling_price_npr
        disc_pct = item_in.discount_pct if item_in.discount_pct is not None else (payload.discount_pct or 0.0)
        item_gross_revenue = unit_price * item_in.quantity
        item_discount = round(item_gross_revenue * (disc_pct / 100.0), 2)
        item_revenue = round(item_gross_revenue - item_discount, 2)
        item_cogs = sku.import_cost_npr * item_in.quantity

        subtotal_revenue += item_revenue
        total_cogs += item_cogs

        # Deduct Stock
        sku.stock_qty -= item_in.quantity
        processed_items.append({
            "sku": sku,
            "qty": item_in.quantity,
            "unit_price": unit_price,
            "discount_pct": disc_pct,
            "discount_amount": item_discount,
            "net_revenue": item_revenue
        })

    # Calculate VAT (if applied)
    vat_amount = 0.0
    if payload.apply_vat:
        rate = payload.vat_rate if payload.vat_rate is not None else 13.0
        vat_amount = round(subtotal_revenue * (rate / 100.0), 2)

    grand_total_revenue = round(subtotal_revenue + vat_amount, 2)

    # 2. Determine Paid Amount (Upfront) vs Credit Due
    method_upper = payload.payment_method.upper()

    if payload.paid_amount_npr is not None and payload.paid_amount_npr > 0:
        paid_amount = round(max(0.0, min(float(payload.paid_amount_npr), grand_total_revenue)), 2)
        credit_due = round(grand_total_revenue - paid_amount, 2)
        is_partial = credit_due > 0
    elif method_upper == "CREDIT":
        paid_amount = 0.0
        credit_due = grand_total_revenue
        is_partial = False
    elif method_upper in ("CASH", "BANK"):
        paid_amount = grand_total_revenue
        credit_due = 0.0
        is_partial = False
    else:
        paid_amount = 0.0
        credit_due = grand_total_revenue
        is_partial = False

    # 3. Enforce Credit Limit if there is a remaining credit due portion
    if credit_due > 0:
        current_balance = get_customer_balance(db, customer.id)
        if customer.credit_limit > 0 and (current_balance + credit_due) > customer.credit_limit:
            new_total = current_balance + credit_due
            raise HTTPException(
                status_code=400,
                detail=f"Credit Limit Exceeded for '{customer.name}'! Max Credit Limit: Rs.{customer.credit_limit:,.2f}, Current Due: Rs.{current_balance:,.2f}, Remaining Invoice Credit: Rs.{credit_due:,.2f}, New Total Balance: Rs.{new_total:,.2f}"
            )

    # 4. Create Journal Entry
    ref = payload.reference or f"INV-{payload.invoice_date.strftime('%Y%m%d')}-{customer.id}"
    item_names = ", ".join([f"{pi['qty']}x {pi['sku'].name}" for pi in processed_items])
    vat_str = " (incl. 13% VAT)" if payload.apply_vat else ""
    disc_summary = ""
    total_disc = sum(pi["discount_amount"] for pi in processed_items)
    if total_disc > 0:
        disc_summary = f" (Discount Applied: Rs.{total_disc:,.2f})"

    narration = f"Sale of {item_names} to {customer.name} ({payload.payment_method}){vat_str}{disc_summary}"
    if is_partial and paid_amount > 0 and credit_due > 0:
        narration += f" — Paid Rs.{paid_amount:,.2f}, Remaining Due Rs.{credit_due:,.2f}"

    entry = JournalEntry(
        entry_date=payload.invoice_date,
        reference=ref,
        narration=narration,
        category="SALES",
    )
    db.add(entry)
    db.flush()

    # Ensure Account Heads exist in database
    from app.routers.journal import ensure_default_account_heads
    ensure_default_account_heads(db)

    # Look up Account Heads
    acc_ar    = db.query(AccountHead).filter(AccountHead.code == "1003").first()
    acc_cash  = db.query(AccountHead).filter(AccountHead.code == "1001").first()
    acc_bank  = db.query(AccountHead).filter(AccountHead.code == "1002").first()
    acc_stock = db.query(AccountHead).filter(AccountHead.code == "1004").first()
    acc_sales = db.query(AccountHead).filter(AccountHead.code == "4001").first()
    acc_vat   = db.query(AccountHead).filter(AccountHead.code == "2004").first()
    acc_cogs  = db.query(AccountHead).filter(AccountHead.code == "5001").first()

    # Debit Upfront Payment (Cash or Bank)
    if paid_amount > 0:
        upfront_method = (payload.partial_payment_method or "BANK").upper()
        if method_upper in ("CASH", "BANK"):
            upfront_method = method_upper
        upfront_acc = acc_bank if upfront_method == "BANK" else acc_cash

        if upfront_acc:
            db.add(JournalLine(
                entry_id=entry.id, account_id=upfront_acc.id, customer_id=customer.id,
                debit_npr=paid_amount, credit_npr=0.0, description=f"Upfront Payment ({upfront_method}) from {customer.name}"
            ))

    # Debit Remaining Credit Balance Due (Accounts Receivable)
    if credit_due > 0:
        if acc_ar:
            db.add(JournalLine(
                entry_id=entry.id, account_id=acc_ar.id, customer_id=customer.id,
                debit_npr=credit_due, credit_npr=0.0, description=f"Remaining Credit Balance Due from {customer.name}"
            ))

    if acc_sales:
        for pi in processed_items:
            db.add(JournalLine(
                entry_id=entry.id, account_id=acc_sales.id, inventory_id=pi["sku"].id, customer_id=customer.id,
                debit_npr=0.0, credit_npr=pi["net_revenue"],
                description=f"Sales Revenue ({pi['qty']}x {pi['sku'].name})"
            ))

    if acc_vat and vat_amount > 0:
        db.add(JournalLine(
            entry_id=entry.id, account_id=acc_vat.id, customer_id=customer.id,
            debit_npr=0.0, credit_npr=vat_amount, description=f"13% VAT Payable ({customer.name})"
        ))

    for pi in processed_items:
        item_cogs = pi["sku"].import_cost_npr * pi["qty"]
        if acc_cogs and item_cogs > 0:
            db.add(JournalLine(
                entry_id=entry.id, account_id=acc_cogs.id, inventory_id=pi["sku"].id, customer_id=customer.id,
                debit_npr=item_cogs, credit_npr=0.0, description=f"Cost of Goods Sold ({pi['qty']}x {pi['sku'].name})"
            ))

        if acc_stock and item_cogs > 0:
            db.add(JournalLine(
                entry_id=entry.id, account_id=acc_stock.id, inventory_id=pi["sku"].id, customer_id=customer.id,
                debit_npr=0.0, credit_npr=item_cogs, description=f"Inventory reduction ({pi['qty']}x {pi['sku'].name})"
            ))

    db.commit()
    db.refresh(entry)

    # 5. Trigger Real-Time Backup to Google Drive
    trigger_auto_backup()

    return {
        "status": "success",
        "message": f"Sales invoice created for {customer.name}! (Paid: Rs.{paid_amount:,.2f}, Remaining Due: Rs.{credit_due:,.2f})",
        "total_revenue_npr": grand_total_revenue,
        "paid_amount_npr": paid_amount,
        "remaining_credit_npr": credit_due,
        "total_cogs_npr": total_cogs,
        "journal_entry_id": entry.id,
    }


class PurchaseItemIn(BaseModel):
    inventory_id: int
    quantity: int
    unit_cost_npr: Optional[float] = None


class InventoryPurchaseCreate(BaseModel):
    payment_method: str  # "BANK", "LOAN", "INVESTOR", "CASH", "SUPPLIER_CREDIT"
    purchase_date: date
    reference: Optional[str] = None
    loan_id: Optional[int] = None
    items: List[PurchaseItemIn]


@router.post("/purchase", status_code=201)
def create_inventory_purchase(
    payload: InventoryPurchaseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN", "STAFF"])),
):
    """
    Purchases/imports inventory using Bank Loan funds, Investor Equity Capital, Cash, or Supplier Credit:
    1. Increases Inventory stock_qty.
    2. Auto-posts balanced double-entry Journal Entry (Debit 1004 Inventory / Credit 1002 Bank or 2002 Bank Loan).
    3. Triggers automated backup to Google Drive.
    """
    if not payload.items:
        raise HTTPException(status_code=400, detail="At least 1 purchase item is required")

    total_cost = 0.0
    processed_items = []

    for item_in in payload.items:
        sku = db.query(Inventory).filter(Inventory.id == item_in.inventory_id).first()
        if not sku:
            raise HTTPException(status_code=404, detail=f"Inventory item ID {item_in.inventory_id} not found")

        unit_cost = item_in.unit_cost_npr if item_in.unit_cost_npr is not None else sku.import_cost_npr
        item_cost = unit_cost * item_in.quantity
        total_cost += item_cost

        # Increase Stock Qty & update unit cost
        sku.stock_qty += item_in.quantity
        if item_in.unit_cost_npr is not None:
            sku.import_cost_npr = item_in.unit_cost_npr

        processed_items.append({"sku": sku, "qty": item_in.quantity, "unit_cost": unit_cost})

    # Look up specific Bank Loan if loan_id provided
    loan_info = ""
    if payload.loan_id:
        from app.models import BankLoan
        loan = db.query(BankLoan).filter(BankLoan.id == payload.loan_id).first()
        if loan:
            loan_info = f" ({loan.bank_name} #{loan.loan_account_no})"

    # Journal Entry: Debit Inventory (1004) / Credit Bank Account (1002) or Cash (1001) or AP (2001)
    ref = payload.reference or f"PO-{payload.purchase_date.strftime('%Y%m%d')}"
    item_names = ", ".join([f"{pi['qty']}x {pi['sku'].name}" for pi in processed_items])
    
    if payload.payment_method.upper() in ["LOAN", "BANK_LOAN"]:
        payment_label = f"Bank Loan Funds{loan_info}"
    elif payload.payment_method.upper() == "INVESTOR":
        payment_label = "Investor Equity Capital"
    else:
        payment_label = "Bank / Cash Account" if payload.payment_method.upper() == "BANK" else payload.payment_method.upper()
        
    narration = f"Purchased {item_names} using {payment_label}"

    entry = JournalEntry(
        entry_date=payload.purchase_date,
        reference=ref,
        narration=narration,
        category="PURCHASE",
    )
    db.add(entry)
    db.flush()

    acc_stock = db.query(AccountHead).filter(AccountHead.code == "1004").first()
    acc_bank  = db.query(AccountHead).filter(AccountHead.code == "1002").first()
    acc_cash  = db.query(AccountHead).filter(AccountHead.code == "1001").first()
    acc_ap    = db.query(AccountHead).filter(AccountHead.code == "2001").first()

    payment_acc = acc_bank if payload.payment_method.upper() == "BANK" else (acc_cash if payload.payment_method.upper() == "CASH" else acc_ap)

    if acc_stock:
        for pi in processed_items:
            item_total_cost = pi["unit_cost"] * pi["qty"]
            db.add(JournalLine(
                entry_id=entry.id, account_id=acc_stock.id, inventory_id=pi["sku"].id,
                debit_npr=item_total_cost, credit_npr=0.0, description=f"Stock received ({pi['qty']}x {pi['sku'].name})"
            ))

    if payment_acc:
        db.add(JournalLine(
            entry_id=entry.id, account_id=payment_acc.id,
            debit_npr=0.0, credit_npr=total_cost, description=f"Paid from {payment_label}"
        ))

    db.commit()
    db.refresh(entry)
    trigger_auto_backup()

    return {
        "status": "success",
        "message": f"Successfully purchased inventory using {payment_label} funds! Stock increased.",
        "total_cost_npr": total_cost,
        "journal_entry_id": entry.id,
    }


@router.get("/invoices/journal-entry/{entry_id}")
def get_printable_invoice(entry_id: int, db: Session = Depends(get_db)):
    """Retrieve tax invoice details for printable customer letterhead view (excluding internal COGS/inventory cost lines)."""
    entry = db.query(JournalEntry).filter(JournalEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Invoice record not found")

    lines_detail = []
    customer_info = None
    total_invoice_amount = 0.0

    # Filter out internal cost/inventory accounting lines so purchase cost price (e.g. COGS) is never visible to customers
    INTERNAL_COST_ACCOUNT_CODES = {"5001", "1004"}

    for line in entry.lines:
        code = line.account.code if line.account else ""
        if code in INTERNAL_COST_ACCOUNT_CODES:
            continue

        if line.customer and not customer_info:
            customer_info = {
                "id": line.customer.id,
                "name": line.customer.name,
                "phone": line.customer.phone or "—",
                "email": line.customer.email or "—",
                "address": line.customer.address or "Nepal",
                "customer_type": line.customer.customer_type,
                "credit_limit": line.customer.credit_limit,
                "pan_no": line.customer.pan_no or "—",
            }

        # Track total invoice bill amount (debit amount on payment/receivable line)
        if code in {"1001", "1002", "1003"} and line.debit_npr > 0:
            total_invoice_amount = line.debit_npr

        lines_detail.append({
            "account_code": code,
            "account_name": line.account.name if line.account else "",
            "hs_code": line.inventory_item.hs_code if line.inventory_item else None,
            "debit_npr": line.debit_npr,
            "credit_npr": line.credit_npr,
            "description": line.description,
        })

    # Fallback total amount if payment line not explicitly identified
    if total_invoice_amount == 0.0 and lines_detail:
        total_invoice_amount = max([l["debit_npr"] for l in lines_detail] + [l["credit_npr"] for l in lines_detail])

    return {
        "invoice_no": entry.reference or f"INV-{entry.id:05d}",
        "invoice_date": entry.entry_date.strftime("%Y-%m-%d"),
        "narration": entry.narration,
        "total_amount_npr": total_invoice_amount,
        "company_info": get_company_dict(db),
        "customer": customer_info or {"name": "Cash / Walk-in Customer", "address": "Kathmandu, Nepal", "phone": "—"},
        "lines": lines_detail,
    }


@router.get("/movements/log")
def get_inventory_movements(
    sku_id: Optional[int] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Returns inventory movements (Stock IN from purchases, Stock OUT from sales)
    by querying journal lines attached to inventory items.
    """
    q = (
        db.query(JournalLine)
        .join(JournalLine.entry)
        .filter(JournalLine.inventory_id.isnot(None))
    )

    if sku_id:
        q = q.filter(JournalLine.inventory_id == sku_id)
    if start_date:
        q = q.filter(JournalEntry.entry_date >= start_date)
    if end_date:
        q = q.filter(JournalEntry.entry_date <= end_date)

    lines = q.order_by(JournalEntry.entry_date.desc(), JournalLine.id.desc()).all()

    movements = []
    for line in lines:
        entry = line.entry
        if not entry:
            continue
        movements.append({
            "id": line.id,
            "entry_id": entry.id,
            "entry_date": entry.entry_date.strftime("%Y-%m-%d") if entry.entry_date else "",
            "reference": entry.reference or f"JE-{entry.id:04d}",
            "sku": line.inventory_item.sku if line.inventory_item else "—",
            "item_name": line.inventory_item.name if line.inventory_item else "—",
            "movement_type": "STOCK_OUT (SALE)" if line.credit_npr > 0 else "STOCK_IN (PURCHASE)",
            "amount_npr": line.credit_npr if line.credit_npr > 0 else line.debit_npr,
            "description": line.description or entry.narration or "—",
            "customer_name": line.customer.name if line.customer else "—",
        })

    return movements


@router.get("/export/stock-audit-csv")
def export_stock_audit_csv(db: Session = Depends(get_db)):
    """
    Exports downloadable Stock Audit CSV report containing remaining stock quantities,
    HS Codes, categories, unit costs, selling prices, and total stock asset valuation for tax auditing.
    """
    comp = get_company_dict(db)
    comp_name = comp.get("company_name", "COMPANY").upper()
    comp_pan = comp.get("pan_vat_no", "N/A")
    prod_plural = comp.get("product_term_plural", "Products").upper()

    items = db.query(Inventory).order_by(Inventory.sku.asc()).all()

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([f"{comp_name} — {prod_plural} STOCK AUDIT & ASSET VALUATION REPORT"])
    writer.writerow([f"Generated Date: {date.today().strftime('%Y-%m-%d')}", f"Company PAN / VAT: {comp_pan}"])
    writer.writerow([])
    writer.writerow([
        "Item ID", "SKU", "HS Code", "Product / Item Name", "Category", "Brand", "Unit (UOM)", "Specifications / Details",
        "Remaining Stock Qty", "Reorder Level", "Stock Status",
        "Import Unit Cost (NPR)", "Selling Price (NPR)", "Total Stock Asset Valuation (NPR)"
    ])

    total_units = 0
    total_inventory_valuation = 0.0

    for item in items:
        total_val = item.import_cost_npr * item.stock_qty
        total_units += item.stock_qty
        total_inventory_valuation += total_val
        status = "LOW STOCK WARNING" if item.stock_qty <= item.reorder_level else "OK"
        spec = item.specifications or (f"{item.voltage_v or 0}V / {item.capacity_ah or 0}Ah" if (item.voltage_v or item.capacity_ah) else "—")
        category = item.category or "General"
        uom = item.unit_of_measure or "pcs"

        writer.writerow([
            item.id,
            item.sku,
            item.hs_code or "N/A",
            item.name,
            category,
            item.brand or "—",
            uom,
            spec,
            item.stock_qty,
            item.reorder_level,
            status,
            f"{item.import_cost_npr:.2f}",
            f"{item.selling_price_npr:.2f}",
            f"{total_val:.2f}"
        ])

    writer.writerow([])
    writer.writerow([
        "TOTAL INVENTORY AUDIT VALUATION", "", "", "", "", "", "", "",
        total_units, "", "", "", "", f"{total_inventory_valuation:.2f}"
    ])

    output.seek(0)
    response = StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv"
    )
    safe_filename = comp_name.lower().replace(" ", "_")[:20]
    response.headers["Content-Disposition"] = f"attachment; filename={safe_filename}_inventory_stock_audit.csv"
    return response
