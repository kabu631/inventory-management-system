"""
Script to wipe all data from the database.
Optionally recreates the standard Chart of Accounts so the ERP is ready for fresh data.
Run: python -m app.clear_db
"""
import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.database import SessionLocal, engine, Base
from app.models import (
    Customer, Inventory, AccountHead, JournalEntry,
    JournalLine, BankLoan, LoanRepayment,
)
from app.seed import ACCOUNT_HEADS

def clear_db(seed_chart_of_accounts=True):
    print("Clearing all data from SQLite database...")
    db = SessionLocal()
    try:
        # Drop all data using SQLAlchemy metadata or direct DELETE
        db.query(LoanRepayment).delete()
        db.query(BankLoan).delete()
        db.query(JournalLine).delete()
        db.query(JournalEntry).delete()
        db.query(Customer).delete()
        db.query(Inventory).delete()
        db.query(AccountHead).delete()
        db.commit()
        print("  All tables cleared successfully.")

        if seed_chart_of_accounts:
            print("  Seeding default Chart of Accounts...")
            for ah in ACCOUNT_HEADS:
                db.add(AccountHead(**ah))
            db.commit()
            print(f"  Initialized {len(ACCOUNT_HEADS)} standard account heads.")

        print("[OK] Database reset complete! Database is now empty and ready.")

    except Exception as e:
        db.rollback()
        print(f"[FAIL] Error clearing database: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    clear_db(seed_chart_of_accounts=True)
