"""
Script to wipe all operational data from the database.
Re-initializes standard default users and Chart of Accounts so the ERP is ready for fresh data from scratch.
Run: py -m app.clear_db
"""
import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.database import SessionLocal, engine, Base
from app.models import (
    Customer, Inventory, AccountHead, JournalEntry, JournalLine,
    BankLoan, LoanRepayment, Investor, InvestmentRecord, BatterySerial,
    WarrantyClaim, StockTransfer, PurchaseOrder, PurchaseOrderItem, Supplier, Warehouse
)
from app.routers.auth import ensure_default_users
from app.routers.journal import ensure_default_account_heads

def clear_db():
    print("Wiping all operational data from SQLite database...")
    db = SessionLocal()
    try:
        # Delete in order of foreign key dependencies
        db.query(WarrantyClaim).delete()
        db.query(BatterySerial).delete()
        db.query(StockTransfer).delete()
        db.query(PurchaseOrderItem).delete()
        db.query(PurchaseOrder).delete()
        db.query(LoanRepayment).delete()
        db.query(BankLoan).delete()
        db.query(InvestmentRecord).delete()
        db.query(Investor).delete()
        db.query(JournalLine).delete()
        db.query(JournalEntry).delete()
        db.query(Inventory).delete()
        db.query(Customer).delete()
        db.query(Supplier).delete()
        db.query(Warehouse).delete()
        db.commit()
        print("  - All operational data tables cleared successfully.")

        # Ensure default logins, Chart of Accounts, Central Warehouse, and Investors exist
        from app.routers.warehouses import ensure_default_warehouses
        from app.routers.investors import ensure_default_investors
        ensure_default_account_heads(db)
        ensure_default_users(db)
        ensure_default_warehouses(db)
        ensure_default_investors(db)
        print("  - Standard Chart of Accounts (COA), System User Logins, Central Warehouse & Investors verified.")

        print("\n[OK] Database reset complete! The system is now 100% clean and ready for fresh entries.")

    except Exception as e:
        db.rollback()
        print(f"[FAIL] Error clearing database: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    clear_db()
