from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
import base64

from app.database import get_db
from app.models import CompanySetting, User
from app.services.auth import get_current_user

router = APIRouter()


DEFAULT_COMPANY = {
    "company_name": "Renew Gen Resources",
    "tagline": "Corporate Commercial & Supply Chain Management",
    "business_type": "Commercial Trading & Distribution",
    "product_term": "Product",
    "product_term_plural": "Products",
    "pan_vat_no": "610464122",
    "phone": "+977 01-4573200",
    "email": "info@renewgenresources.com",
    "address": "Babarmahal, Kathmandu, Nepal",
    "website": "www.renewgenresources.com",
    "logo_data": "/logo.png",
    "terms_and_conditions": (
        "1. Goods once sold are not returnable without authorization.\n"
        "2. Warranty claims require original tax invoice & intact serial number.\n"
        "3. Payment is due as per agreed invoice credit terms.\n"
        "4. Subject to Kathmandu, Nepal jurisdiction."
    ),
    "invoice_footer": "Thank you for your business! This is a computer-generated tax invoice.",
    "currency_symbol": "NPR",
}


def ensure_default_company_settings(db: Session) -> CompanySetting:
    """Ensures at least one default CompanySetting record exists in the database."""
    setting = db.query(CompanySetting).first()
    if not setting:
        setting = CompanySetting(
            company_name=DEFAULT_COMPANY["company_name"],
            tagline=DEFAULT_COMPANY["tagline"],
            business_type=DEFAULT_COMPANY["business_type"],
            product_term=DEFAULT_COMPANY["product_term"],
            product_term_plural=DEFAULT_COMPANY["product_term_plural"],
            pan_vat_no=DEFAULT_COMPANY["pan_vat_no"],
            phone=DEFAULT_COMPANY["phone"],
            email=DEFAULT_COMPANY["email"],
            address=DEFAULT_COMPANY["address"],
            website=DEFAULT_COMPANY["website"],
            logo_data=DEFAULT_COMPANY["logo_data"],
            terms_and_conditions=DEFAULT_COMPANY["terms_and_conditions"],
            invoice_footer=DEFAULT_COMPANY["invoice_footer"],
            currency_symbol=DEFAULT_COMPANY["currency_symbol"],
        )
        db.add(setting)
        db.commit()
        db.refresh(setting)
    return setting


def get_company_dict(db: Session) -> dict:
    """Helper for other routers (like inventory & invoices) to retrieve company info."""
    setting = ensure_default_company_settings(db)
    return {
        "id": setting.id,
        "company_name": setting.company_name or DEFAULT_COMPANY["company_name"],
        "name": setting.company_name or DEFAULT_COMPANY["company_name"],  # alias for backward-compatibility
        "tagline": setting.tagline or "",
        "business_type": getattr(setting, "business_type", None) or DEFAULT_COMPANY["business_type"],
        "product_term": getattr(setting, "product_term", None) or DEFAULT_COMPANY["product_term"],
        "product_term_plural": getattr(setting, "product_term_plural", None) or DEFAULT_COMPANY["product_term_plural"],
        "pan_vat_no": setting.pan_vat_no or "",
        "phone": setting.phone or "",
        "email": setting.email or "",
        "address": setting.address or "",
        "website": setting.website or "",
        "logo_data": setting.logo_data or "/logo.png",
        "terms_and_conditions": setting.terms_and_conditions or DEFAULT_COMPANY["terms_and_conditions"],
        "invoice_footer": setting.invoice_footer or DEFAULT_COMPANY["invoice_footer"],
        "currency_symbol": setting.currency_symbol or "NPR",
        "updated_at": setting.updated_at.isoformat() if setting.updated_at else "",
    }


class CompanyProfileUpdate(BaseModel):
    company_name: Optional[str] = None
    tagline: Optional[str] = None
    business_type: Optional[str] = None
    product_term: Optional[str] = None
    product_term_plural: Optional[str] = None
    pan_vat_no: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    website: Optional[str] = None
    logo_data: Optional[str] = None
    terms_and_conditions: Optional[str] = None
    invoice_footer: Optional[str] = None
    currency_symbol: Optional[str] = None


@router.get("/profile")
def get_company_profile(db: Session = Depends(get_db)):
    """Public endpoint to fetch company profile & branding information."""
    return get_company_dict(db)


@router.put("/profile")
def update_company_profile(
    data: CompanyProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Admin / Staff endpoint to update company profile and branding settings."""
    setting = ensure_default_company_settings(db)

    update_fields = data.model_dump(exclude_unset=True)
    for field, value in update_fields.items():
        if value is not None and hasattr(setting, field):
            setattr(setting, field, value)

    setting.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(setting)

    return {
        "status": "success",
        "message": "Company profile & branding updated successfully",
        "company": get_company_dict(db),
    }


@router.post("/logo")
async def upload_company_logo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Uploads a new company logo and stores as a self-contained base64 data URL."""
    allowed_types = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image format. Supported formats: PNG, JPEG, SVG, WebP."
        )

    content = await file.read()
    # Limit logo size to 3MB
    if len(content) > 3 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Logo file size exceeds 3MB limit."
        )

    b64_encoded = base64.b64encode(content).decode("utf-8")
    data_url = f"data:{file.content_type};base64,{b64_encoded}"

    setting = ensure_default_company_settings(db)
    setting.logo_data = data_url
    setting.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(setting)

    return {
        "status": "success",
        "message": "Company logo uploaded successfully",
        "logo_data": data_url,
    }


@router.post("/reset-default")
def reset_default_company(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Resets company profile to defaults."""
    setting = ensure_default_company_settings(db)
    for k, v in DEFAULT_COMPANY.items():
        setattr(setting, k, v)
    setting.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(setting)

    return {
        "status": "success",
        "message": "Company settings reset to default",
        "company": get_company_dict(db),
    }
