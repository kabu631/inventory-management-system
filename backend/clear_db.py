import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(BASE_DIR)

db_files = [
    os.path.join(BASE_DIR, "erp.db"),
    os.path.join(BASE_DIR, "erp.db-wal"),
    os.path.join(BASE_DIR, "erp.db-shm"),
    r"G:\My Drive\BatteryERP_Backups\erp_latest.db"
]

for f in db_files:
    if os.path.exists(f):
        try:
            os.remove(f)
            print(f"Removed: {f}")
        except Exception as e:
            print(f"Could not remove {f}: {e}")

from app.database import init_db
init_db()
print("Database reset and re-initialized with fresh Chart of Accounts!")
