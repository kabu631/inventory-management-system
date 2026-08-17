import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.services.backup import trigger_auto_backup
from app.routers import inventory, customers, journal, loans, analytics, backup, warehouses, serials, suppliers, auth, investors, company


async def periodic_backup_task(interval_seconds: int = 1800):
    """Background task that runs every 30 minutes (1800 seconds) to back up database to Google Drive."""
    while True:
        try:
            await asyncio.sleep(interval_seconds)
            backup_path = trigger_auto_backup()
            print(f"[30-Min Auto-Backup] Successfully backed up database to Google Drive: {backup_path}")
        except asyncio.CancelledError:
            print("[30-Min Auto-Backup] Scheduled backup task stopped.")
            break
        except Exception as e:
            print(f"[30-Min Auto-Backup Warning] Scheduled backup failed: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables & seed default users / investors / company profile if empty
    from app.database import SessionLocal
    from app.routers.auth import ensure_default_users
    from app.routers.investors import ensure_default_investors
    from app.routers.journal import ensure_default_account_heads
    from app.routers.warehouses import ensure_default_warehouses
    from app.routers.company import ensure_default_company_settings
    init_db()
    db = SessionLocal()
    try:
        ensure_default_company_settings(db)
        ensure_default_account_heads(db)
        ensure_default_users(db)
        ensure_default_investors(db)
        ensure_default_warehouses(db)
    finally:
        db.close()
    # Trigger an immediate startup backup to Google Drive
    trigger_auto_backup()
    # Start 30-minute background backup loop (1800 seconds)
    backup_bg_task = asyncio.create_task(periodic_backup_task(1800))
    yield
    # Shutdown
    backup_bg_task.cancel()


app = FastAPI(
    title="Renew Gen Resources ERP API",
    description="Corporate Inventory & Supply Chain ERP for Renew Gen Resources",
    version="2.2.0",
    lifespan=lifespan,
)

# Allow Next.js dev server + Electron renderer
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(company.router, prefix="/api/company", tags=["Company Profile & Branding"])
app.include_router(investors.router, prefix="/api/investors", tags=["Investors & Capital"])
app.include_router(inventory.router, prefix="/api/inventory", tags=["Inventory"])
app.include_router(customers.router, prefix="/api/customers", tags=["Customers"])
app.include_router(journal.router, prefix="/api/journal", tags=["Journal"])
app.include_router(loans.router, prefix="/api/loans", tags=["Loans"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(backup.router, prefix="/api/backup", tags=["Backup"])
app.include_router(warehouses.router, prefix="/api/warehouses", tags=["Warehouses"])
app.include_router(serials.router, prefix="/api/serials", tags=["Battery Serials & Warranty"])
app.include_router(suppliers.router, prefix="/api/suppliers", tags=["Suppliers & PO"])


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "service": "Corporate Battery ERP API v2",
        "auto_backup_schedule": "Every 30 Minutes (1800s) + On Every Write Entry",
        "gdrive_destination": "G:\\My Drive\\BatteryERP_Backups\\erp_latest.db"
    }
