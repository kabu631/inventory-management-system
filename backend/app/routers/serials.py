from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, timedelta
from app.database import get_db
from app.models import BatterySerial, WarrantyClaim, Inventory, Customer, Warehouse
from app.services.backup import trigger_auto_backup

router = APIRouter()


class SerialRegister(BaseModel):
    inventory_id: int
    warehouse_id: Optional[int] = None
    serial_numbers: List[str]
    purchase_date: date
    warranty_months: int = 24


class WarrantyClaimCreate(BaseModel):
    serial_number: str
    claim_date: date
    issue_description: str
    replacement_serial_number: Optional[str] = None
    notes: Optional[str] = None


@router.get("/")
def list_serials(status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(BatterySerial)
    if status:
        query = query.filter(BatterySerial.status == status.upper())
    serials = query.order_by(BatterySerial.created_at.desc()).all()
    results = []
    for s in serials:
        sku = db.query(Inventory).filter(Inventory.id == s.inventory_id).first()
        cust = db.query(Customer).filter(Customer.id == s.customer_id).first() if s.customer_id else None
        wh = db.query(Warehouse).filter(Warehouse.id == s.warehouse_id).first() if s.warehouse_id else None
        results.append({
            "id": s.id,
            "serial_number": s.serial_number,
            "sku": sku.sku if sku else "",
            "item_name": sku.name if sku else "",
            "warehouse": wh.name if wh else "Central Warehouse",
            "purchase_date": s.purchase_date,
            "warranty_months": s.warranty_months,
            "warranty_expiry_date": s.warranty_expiry_date,
            "status": s.status,
            "customer_name": cust.name if cust else "—",
            "sale_invoice_ref": s.sale_invoice_ref or "—",
            "is_expired": (s.warranty_expiry_date < date.today()) if s.warranty_expiry_date else False,
        })
    return results


@router.post("/", status_code=201)
def register_serials(payload: SerialRegister, db: Session = Depends(get_db)):
    sku = db.query(Inventory).filter(Inventory.id == payload.inventory_id).first()
    if not sku:
        raise HTTPException(status_code=404, detail="Battery SKU not found")

    created = []
    for sn in payload.serial_numbers:
        clean_sn = sn.strip()
        if not clean_sn:
            continue
        if db.query(BatterySerial).filter(BatterySerial.serial_number == clean_sn).first():
            raise HTTPException(status_code=400, detail=f"Serial number '{clean_sn}' already exists in system")

        # Calculate warranty expiry
        exp_date = payload.purchase_date + timedelta(days=payload.warranty_months * 30)

        bs = BatterySerial(
            inventory_id=payload.inventory_id,
            warehouse_id=payload.warehouse_id,
            serial_number=clean_sn,
            purchase_date=payload.purchase_date,
            warranty_months=payload.warranty_months,
            warranty_expiry_date=exp_date,
            status="IN_STOCK",
        )
        db.add(bs)
        created.append(clean_sn)

    db.commit()
    trigger_auto_backup()
    return {"status": "success", "message": f"Successfully registered {len(created)} battery serial numbers for '{sku.name}'!"}


@router.get("/warranty-claims")
def list_warranty_claims(db: Session = Depends(get_db)):
    claims = db.query(WarrantyClaim).order_by(WarrantyClaim.claim_date.desc()).all()
    results = []
    for c in claims:
        ser = db.query(BatterySerial).filter(BatterySerial.id == c.serial_id).first()
        cust = db.query(Customer).filter(Customer.id == c.customer_id).first()
        results.append({
            "id": c.id,
            "claim_date": c.claim_date,
            "serial_number": ser.serial_number if ser else "Unknown",
            "customer_name": cust.name if cust else "Unknown",
            "issue_description": c.issue_description,
            "status": c.status,
            "replacement_serial_number": c.replacement_serial_number or "—",
            "notes": c.notes,
        })
    return results


@router.post("/warranty-claims", status_code=201)
def submit_warranty_claim(payload: WarrantyClaimCreate, db: Session = Depends(get_db)):
    ser = db.query(BatterySerial).filter(BatterySerial.serial_number == payload.serial_number.strip()).first()
    if not ser:
        raise HTTPException(status_code=404, detail=f"Serial number '{payload.serial_number}' not found in system")

    if not ser.customer_id:
        raise HTTPException(status_code=400, detail="This serial number was not linked to any registered customer sale")

    # Flag serial as WARRANTY_CLAIM
    ser.status = "WARRANTY_CLAIM"

    claim = WarrantyClaim(
        serial_id=ser.id,
        customer_id=ser.customer_id,
        claim_date=payload.claim_date,
        issue_description=payload.issue_description,
        status="REPLACED" if payload.replacement_serial_number else "PENDING",
        replacement_serial_number=payload.replacement_serial_number,
        notes=payload.notes,
    )
    db.add(claim)

    # If replacement serial provided, flag replacement as SOLD to this customer
    if payload.replacement_serial_number:
        rep_ser = db.query(BatterySerial).filter(BatterySerial.serial_number == payload.replacement_serial_number.strip()).first()
        if rep_ser:
            rep_ser.status = "SOLD"
            rep_ser.customer_id = ser.customer_id
            rep_ser.sale_invoice_ref = f"WARRANTY-REPLACEMENT-{ser.serial_number}"

    db.commit()
    trigger_auto_backup()
    return {"status": "success", "message": f"Warranty claim recorded for Serial '{ser.serial_number}'!"}
