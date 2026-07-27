from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import date
from app.database import get_db
from app.models import Warehouse, StockTransfer, Inventory, BatterySerial
from app.services.backup import trigger_auto_backup

router = APIRouter()


class WarehouseCreate(BaseModel):
    code: str
    name: str
    location: Optional[str] = None
    is_primary: bool = False


class StockTransferCreate(BaseModel):
    transfer_date: date
    from_warehouse_id: int
    to_warehouse_id: int
    inventory_id: int
    quantity: int
    notes: Optional[str] = None


@router.get("/")
def list_warehouses(db: Session = Depends(get_db)):
    # Auto-seed primary warehouse if empty
    if db.query(Warehouse).count() == 0:
        w1 = Warehouse(code="KTM-WH-01", name="Kathmandu Central Warehouse", location="Kathmandu Depot", is_primary=True)
        db.add(w1)
        db.commit()
    return db.query(Warehouse).order_by(Warehouse.id).all()


@router.post("/", status_code=201)
def create_warehouse(payload: WarehouseCreate, db: Session = Depends(get_db)):
    if db.query(Warehouse).filter(Warehouse.code == payload.code.upper()).first():
        raise HTTPException(status_code=400, detail=f"Warehouse code '{payload.code}' already exists")
    wh = Warehouse(
        code=payload.code.upper(),
        name=payload.name,
        location=payload.location,
        is_primary=payload.is_primary,
    )
    db.add(wh)
    db.commit()
    db.refresh(wh)
    trigger_auto_backup()
    return wh


@router.get("/transfers")
def list_transfers(db: Session = Depends(get_db)):
    transfers = db.query(StockTransfer).order_by(StockTransfer.transfer_date.desc()).all()
    results = []
    for t in transfers:
        from_w = db.query(Warehouse).filter(Warehouse.id == t.from_warehouse_id).first()
        to_w = db.query(Warehouse).filter(Warehouse.id == t.to_warehouse_id).first()
        sku = db.query(Inventory).filter(Inventory.id == t.inventory_id).first()
        results.append({
            "id": t.id,
            "transfer_date": t.transfer_date,
            "reference": t.reference,
            "from_warehouse": from_w.name if from_w else "Unknown",
            "to_warehouse": to_w.name if to_w else "Unknown",
            "sku": sku.sku if sku else "",
            "item_name": sku.name if sku else "",
            "quantity": t.quantity,
            "notes": t.notes,
        })
    return results


@router.post("/transfers", status_code=201)
def create_stock_transfer(payload: StockTransferCreate, db: Session = Depends(get_db)):
    if payload.from_warehouse_id == payload.to_warehouse_id:
        raise HTTPException(status_code=400, detail="Source and destination warehouses cannot be the same")

    sku = db.query(Inventory).filter(Inventory.id == payload.inventory_id).first()
    if not sku:
        raise HTTPException(status_code=404, detail="Battery SKU not found")

    from_w = db.query(Warehouse).filter(Warehouse.id == payload.from_warehouse_id).first()
    to_w = db.query(Warehouse).filter(Warehouse.id == payload.to_warehouse_id).first()
    if not from_w or not to_w:
        raise HTTPException(status_code=404, detail="Warehouse location not found")

    ref = f"TRF-{payload.transfer_date.strftime('%Y%m%d')}-{payload.from_warehouse_id}T{payload.to_warehouse_id}"

    transfer = StockTransfer(
        transfer_date=payload.transfer_date,
        reference=ref,
        from_warehouse_id=payload.from_warehouse_id,
        to_warehouse_id=payload.to_warehouse_id,
        inventory_id=payload.inventory_id,
        quantity=payload.quantity,
        notes=payload.notes,
    )
    db.add(transfer)

    # Move serials if serial numbers exist for this warehouse
    serials = db.query(BatterySerial).filter(
        BatterySerial.inventory_id == payload.inventory_id,
        BatterySerial.warehouse_id == payload.from_warehouse_id,
        BatterySerial.status == "IN_STOCK"
    ).limit(payload.quantity).all()

    for s in serials:
        s.warehouse_id = payload.to_warehouse_id

    db.commit()
    trigger_auto_backup()
    return {"status": "success", "message": f"Successfully transferred {payload.quantity} units of '{sku.name}' from {from_w.name} to {to_w.name}!"}
