from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import date
from app.database import get_db
from app.models import Supplier, PurchaseOrder, PurchaseOrderItem, Inventory, AccountHead, JournalEntry, JournalLine
from app.services.backup import trigger_auto_backup

router = APIRouter()


class SupplierCreate(BaseModel):
    name: str
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    pan_vat_no: Optional[str] = None


class POItemIn(BaseModel):
    inventory_id: int
    quantity: int
    unit_cost_npr: float


class POCreate(BaseModel):
    supplier_id: int
    po_date: date
    payment_method: str = "BANK"  # BANK | CASH | CREDIT
    notes: Optional[str] = None
    items: List[POItemIn]


@router.get("/")
def list_suppliers(db: Session = Depends(get_db)):
    return db.query(Supplier).order_by(Supplier.name).all()


@router.post("/", status_code=201)
def create_supplier(payload: SupplierCreate, db: Session = Depends(get_db)):
    sup = Supplier(**payload.model_dump())
    db.add(sup)
    db.commit()
    db.refresh(sup)
    trigger_auto_backup()
    return sup


@router.get("/purchase-orders")
def list_purchase_orders(db: Session = Depends(get_db)):
    pos = db.query(PurchaseOrder).order_by(PurchaseOrder.po_date.desc()).all()
    results = []
    for po in pos:
        sup = db.query(Supplier).filter(Supplier.id == po.supplier_id).first()
        results.append({
            "id": po.id,
            "po_number": po.po_number,
            "po_date": po.po_date,
            "supplier_name": sup.name if sup else "Unknown Supplier",
            "status": po.status,
            "total_amount_npr": po.total_amount_npr,
            "payment_method": po.payment_method,
            "items_count": len(po.items),
        })
    return results


@router.post("/purchase-orders", status_code=201)
def create_purchase_order(payload: POCreate, db: Session = Depends(get_db)):
    if not payload.items:
        raise HTTPException(status_code=400, detail="At least 1 item is required for a Purchase Order")

    sup = db.query(Supplier).filter(Supplier.id == payload.supplier_id).first()
    if not sup:
        raise HTTPException(status_code=404, detail="Supplier not found")

    po_count = db.query(PurchaseOrder).count() + 1
    po_number = f"PO-{payload.po_date.strftime('%Y%m%d')}-{po_count:03d}"

    total_amount = 0.0
    po_items_to_add = []

    for item_in in payload.items:
        sku = db.query(Inventory).filter(Inventory.id == item_in.inventory_id).first()
        if not sku:
            raise HTTPException(status_code=404, detail=f"Inventory item ID {item_in.inventory_id} not found")

        item_cost = item_in.unit_cost_npr * item_in.quantity
        total_amount += item_cost

        # Increase stock & update import cost
        sku.stock_qty += item_in.quantity
        sku.import_cost_npr = item_in.unit_cost_npr

        po_items_to_add.append(PurchaseOrderItem(
            inventory_id=item_in.inventory_id,
            quantity=item_in.quantity,
            unit_cost_npr=item_in.unit_cost_npr,
            total_cost_npr=item_cost,
        ))

    po = PurchaseOrder(
        supplier_id=payload.supplier_id,
        po_number=po_number,
        po_date=payload.po_date,
        status="RECEIVED",
        total_amount_npr=total_amount,
        payment_method=payload.payment_method,
        notes=payload.notes,
    )
    db.add(po)
    db.flush()

    for item in po_items_to_add:
        item.po_id = po.id
        db.add(item)

    # Post Double-Entry Journal Entry
    acc_stock = db.query(AccountHead).filter(AccountHead.code == "1004").first()
    acc_bank  = db.query(AccountHead).filter(AccountHead.code == "1002").first()
    acc_cash  = db.query(AccountHead).filter(AccountHead.code == "1001").first()
    acc_ap    = db.query(AccountHead).filter(AccountHead.code == "2001").first()

    credit_acc = acc_bank if payload.payment_method.upper() == "BANK" else (acc_cash if payload.payment_method.upper() == "CASH" else acc_ap)

    entry = JournalEntry(
        entry_date=payload.po_date,
        reference=po_number,
        narration=f"Purchase Order {po_number} from supplier {sup.name} ({payload.payment_method})",
    )
    db.add(entry)
    db.flush()

    if acc_stock:
        db.add(JournalLine(entry_id=entry.id, account_id=acc_stock.id, debit_npr=total_amount, credit_npr=0.0, description=f"PO Stock Received from {sup.name}"))

    if credit_acc:
        db.add(JournalLine(entry_id=entry.id, account_id=credit_acc.id, debit_npr=0.0, credit_npr=total_amount, description=f"PO Paid via {payload.payment_method}"))

    db.commit()
    db.refresh(po)
    trigger_auto_backup()

    return {
        "status": "success",
        "message": f"Purchase Order {po_number} created & stock received from {sup.name}!",
        "po_id": po.id,
        "total_amount_npr": total_amount,
    }
