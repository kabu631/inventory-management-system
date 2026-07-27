from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.models import Inventory
from app.routers.customers import get_customer_balance

router = APIRouter()


class InventoryCreate(BaseModel):
    sku: str
    name: str
    brand: Optional[str] = None
    capacity_ah: Optional[float] = None
    voltage_v: Optional[float] = None
    import_cost_npr: float = 0.0
    selling_price_npr: float = 0.0
    stock_qty: int = 0
    reorder_level: int = 5


class InventoryUpdate(BaseModel):
    name: Optional[str] = None
    brand: Optional[str] = None
    capacity_ah: Optional[float] = None
    voltage_v: Optional[float] = None
    import_cost_npr: Optional[float] = None
    selling_price_npr: Optional[float] = None
    stock_qty: Optional[int] = None
    reorder_level: Optional[int] = None


@router.get("/")
def list_inventory(db: Session = Depends(get_db)):
    items = db.query(Inventory).order_by(Inventory.sku).all()
    return [
        {
            "id": i.id,
            "sku": i.sku,
            "name": i.name,
            "brand": i.brand,
            "capacity_ah": i.capacity_ah,
            "voltage_v": i.voltage_v,
            "import_cost_npr": i.import_cost_npr,
            "selling_price_npr": i.selling_price_npr,
            "stock_qty": i.stock_qty,
            "reorder_level": i.reorder_level,
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
def create_inventory(payload: InventoryCreate, db: Session = Depends(get_db)):
    existing = db.query(Inventory).filter(Inventory.sku == payload.sku).first()
    if existing:
        raise HTTPException(status_code=400, detail="SKU already exists")
    item = Inventory(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{item_id}")
def update_inventory(item_id: int, payload: InventoryUpdate, db: Session = Depends(get_db)):
    item = db.query(Inventory).filter(Inventory.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


from datetime import date
from typing import List
from app.models import Customer, AccountHead, JournalEntry, JournalLine
from app.services.backup import trigger_auto_backup


class SaleItemIn(BaseModel):
    inventory_id: int
    quantity: int
    unit_price_npr: Optional[float] = None


class SalesInvoiceCreate(BaseModel):
    customer_id: int
    payment_method: str  # "CREDIT", "CASH", "BANK"
    invoice_date: date
    reference: Optional[str] = None
    items: List[SaleItemIn]
    apply_vat: Optional[bool] = False
    vat_rate: Optional[float] = 13.0


@router.post("/sell", status_code=201)
def create_sales_invoice(payload: SalesInvoiceCreate, db: Session = Depends(get_db)):
    """
    Sells products to a customer:
    1. Validates stock availability.
    2. Decrements Inventory.stock_qty in real time.
    3. Updates Customer.outstanding_balance_npr if sold on Credit.
    4. Auto-posts balanced double-entry Journal Entry (AR/Cash, Sales Revenue, VAT Payable, COGS, Stock Reduction).
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
        item_revenue = unit_price * item_in.quantity
        item_cogs = sku.import_cost_npr * item_in.quantity

        subtotal_revenue += item_revenue
        total_cogs += item_cogs

        # Deduct Stock
        sku.stock_qty -= item_in.quantity
        processed_items.append({"sku": sku, "qty": item_in.quantity, "unit_price": unit_price})

    # Calculate VAT (if applied)
    vat_amount = 0.0
    if payload.apply_vat:
        rate = payload.vat_rate if payload.vat_rate is not None else 13.0
        vat_amount = round(subtotal_revenue * (rate / 100.0), 2)

    grand_total_revenue = subtotal_revenue + vat_amount

    # 2. Update Customer Balance & Enforce Credit Limit if CREDIT
    if payload.payment_method.upper() == "CREDIT":
        current_balance = get_customer_balance(db, customer.id)
        if customer.credit_limit > 0 and (current_balance + grand_total_revenue) > customer.credit_limit:
            new_total = current_balance + grand_total_revenue
            raise HTTPException(
                status_code=400,
                detail=f"Credit Limit Exceeded for '{customer.name}'! Max Credit Limit: Rs.{customer.credit_limit:,.2f}, Current Due: Rs.{current_balance:,.2f}, New Bill Total: Rs.{new_total:,.2f}"
            )

    # 3. Create Journal Entry
    ref = payload.reference or f"INV-{payload.invoice_date.strftime('%Y%m%d')}-{customer.id}"
    item_names = ", ".join([f"{pi['qty']}x {pi['sku'].name}" for pi in processed_items])
    vat_str = " (incl. 13% VAT)" if payload.apply_vat else ""
    narration = f"Sale of {item_names} to {customer.name} ({payload.payment_method}){vat_str}"

    entry = JournalEntry(
        entry_date=payload.invoice_date,
        reference=ref,
        narration=narration,
    )
    db.add(entry)
    db.flush()

    # Look up Account Heads
    acc_ar    = db.query(AccountHead).filter(AccountHead.code == "1003").first()
    acc_cash  = db.query(AccountHead).filter(AccountHead.code == "1001").first()
    acc_bank  = db.query(AccountHead).filter(AccountHead.code == "1002").first()
    acc_stock = db.query(AccountHead).filter(AccountHead.code == "1004").first()
    acc_sales = db.query(AccountHead).filter(AccountHead.code == "4001").first()
    acc_vat   = db.query(AccountHead).filter(AccountHead.code == "2004").first()
    acc_cogs  = db.query(AccountHead).filter(AccountHead.code == "5001").first()

    # Determine Payment/Receivable Account
    payment_acc = acc_ar if payload.payment_method.upper() == "CREDIT" else (acc_bank if payload.payment_method.upper() == "BANK" else acc_cash)

    if payment_acc:
        db.add(JournalLine(
            entry_id=entry.id, account_id=payment_acc.id, customer_id=customer.id,
            debit_npr=grand_total_revenue, credit_npr=0.0, description=f"Payment/Receivable from {customer.name}"
        ))

    if acc_sales:
        db.add(JournalLine(
            entry_id=entry.id, account_id=acc_sales.id,
            debit_npr=0.0, credit_npr=subtotal_revenue, description=f"Sales Revenue ({len(processed_items)} items)"
        ))

    if acc_vat and vat_amount > 0:
        db.add(JournalLine(
            entry_id=entry.id, account_id=acc_vat.id,
            debit_npr=0.0, credit_npr=vat_amount, description=f"13% VAT Payable ({customer.name})"
        ))

    if acc_cogs and total_cogs > 0:
        db.add(JournalLine(
            entry_id=entry.id, account_id=acc_cogs.id,
            debit_npr=total_cogs, credit_npr=0.0, description="Cost of Goods Sold"
        ))

    if acc_stock and total_cogs > 0:
        db.add(JournalLine(
            entry_id=entry.id, account_id=acc_stock.id,
            debit_npr=0.0, credit_npr=total_cogs, description="Inventory reduction"
        ))

    db.commit()
    db.refresh(entry)

    # 4. Trigger Real-Time Backup to Google Drive
    trigger_auto_backup()

    return {
        "status": "success",
        "message": f"Sales invoice created successfully for {customer.name}!",
        "total_revenue_npr": grand_total_revenue,
        "total_cogs_npr": total_cogs,
        "journal_entry_id": entry.id,
    }


class PurchaseItemIn(BaseModel):
    inventory_id: int
    quantity: int
    unit_cost_npr: Optional[float] = None


class InventoryPurchaseCreate(BaseModel):
    payment_method: str  # "BANK" (Bank Loan Funds), "CASH", "SUPPLIER_CREDIT"
    purchase_date: date
    reference: Optional[str] = None
    items: List[PurchaseItemIn]


@router.post("/purchase", status_code=201)
def create_inventory_purchase(payload: InventoryPurchaseCreate, db: Session = Depends(get_db)):
    """
    Purchases/imports inventory using Bank Loan funds, Cash, or Supplier Credit:
    1. Increases Inventory stock_qty.
    2. Auto-posts balanced double-entry Journal Entry (Debit 1004 Inventory / Credit 1002 Bank or 2001 AP).
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

    # Journal Entry: Debit Inventory (1004) / Credit Bank Account (1002) or Cash (1001) or AP (2001)
    ref = payload.reference or f"PO-{payload.purchase_date.strftime('%Y%m%d')}"
    item_names = ", ".join([f"{pi['qty']}x {pi['sku'].name}" for pi in processed_items])
    payment_label = "Bank Loan / Bank Account" if payload.payment_method.upper() == "BANK" else payload.payment_method.upper()
    narration = f"Purchased {item_names} using {payment_label} funds"

    entry = JournalEntry(
        entry_date=payload.purchase_date,
        reference=ref,
        narration=narration,
    )
    db.add(entry)
    db.flush()

    acc_stock = db.query(AccountHead).filter(AccountHead.code == "1004").first()
    acc_bank  = db.query(AccountHead).filter(AccountHead.code == "1002").first()
    acc_cash  = db.query(AccountHead).filter(AccountHead.code == "1001").first()
    acc_ap    = db.query(AccountHead).filter(AccountHead.code == "2001").first()

    payment_acc = acc_bank if payload.payment_method.upper() == "BANK" else (acc_cash if payload.payment_method.upper() == "CASH" else acc_ap)

    if acc_stock:
        db.add(JournalLine(
            entry_id=entry.id, account_id=acc_stock.id,
            debit_npr=total_cost, credit_npr=0.0, description=f"Stock received ({item_names})"
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
    from app.models import JournalEntry
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
            }

        # Track total invoice bill amount (debit amount on payment/receivable line)
        if code in {"1001", "1002", "1003"} and line.debit_npr > 0:
            total_invoice_amount = line.debit_npr

        lines_detail.append({
            "account_code": code,
            "account_name": line.account.name if line.account else "",
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
        "company_info": {
            "name": "Renew Gen Resources Nepal Pvt. Ltd.",
            "pan_vat_no": "610464122",
            "address": "New Baneshwor, Kathmandu, Nepal",
            "phone": "+977 01-4780990 / 9851099882",
            "email": "invoicing@renewgen.com.np",
        },
        "customer": customer_info or {"name": "Cash / Walk-in Customer", "address": "Kathmandu, Nepal", "phone": "—"},
        "lines": lines_detail,
    }



