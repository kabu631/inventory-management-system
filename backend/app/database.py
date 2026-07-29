from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Single-system SQLite3 Database Configuration
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DB_PATH = os.path.join(BASE_DIR, "..", "erp.db")
DB_PATH = os.getenv("ERP_DB_PATH", DEFAULT_DB_PATH)

# SQLite3 Connection URL
DATABASE_URL = f"sqlite:///{os.path.abspath(DB_PATH)}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)

# Enable SQLite3 PRAGMAs for optimal single-system desktop performance & reliability
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables if they don't exist and run auto-column migrations."""
    from app import models  # noqa: F401 – ensure models are registered
    Base.metadata.create_all(bind=engine)

    # Auto-add missing columns to existing SQLite tables if any
    try:
        with engine.connect() as conn:
            pragma_inv = conn.exec_driver_sql("PRAGMA table_info(inventory)").fetchall()
            inv_cols = [row[1] for row in pragma_inv]
            if "warranty_months" not in inv_cols:
                conn.exec_driver_sql("ALTER TABLE inventory ADD COLUMN warranty_months INTEGER DEFAULT 24")

            pragma_cust = conn.exec_driver_sql("PRAGMA table_info(customers)").fetchall()
            cust_cols = [row[1] for row in pragma_cust]
            if "credit_limit" not in cust_cols:
                conn.exec_driver_sql("ALTER TABLE customers ADD COLUMN credit_limit FLOAT DEFAULT 0.0")

            conn.commit()
    except Exception as e:
        print(f"[Migration Info] Auto column check: {e}")

    # Ensure default admin and staff users exist & Account Heads exist
    try:
        db = SessionLocal()
        from app.models import User, AccountHead
        if db.query(AccountHead).count() == 0:
            heads = [
                {"code": "1001", "name": "Cash in Hand",            "account_type": "ASSET",     "normal_balance": "DEBIT"},
                {"code": "1002", "name": "Bank Account - NBL",      "account_type": "ASSET",     "normal_balance": "DEBIT"},
                {"code": "1003", "name": "Accounts Receivable",     "account_type": "ASSET",     "normal_balance": "DEBIT"},
                {"code": "1004", "name": "Inventory / Stock",       "account_type": "ASSET",     "normal_balance": "DEBIT"},
                {"code": "1005", "name": "Prepaid Expenses",        "account_type": "ASSET",     "normal_balance": "DEBIT"},
                {"code": "2001", "name": "Accounts Payable",        "account_type": "LIABILITY", "normal_balance": "CREDIT"},
                {"code": "2002", "name": "Bank Loan Payable",       "account_type": "LIABILITY", "normal_balance": "CREDIT"},
                {"code": "2003", "name": "Interest Payable",        "account_type": "LIABILITY", "normal_balance": "CREDIT"},
                {"code": "2004", "name": "VAT Payable",             "account_type": "LIABILITY", "normal_balance": "CREDIT"},
                {"code": "3001", "name": "Owner's Equity",          "account_type": "EQUITY",    "normal_balance": "CREDIT"},
                {"code": "3002", "name": "Retained Earnings",       "account_type": "EQUITY",    "normal_balance": "CREDIT"},
                {"code": "4001", "name": "Sales Revenue",           "account_type": "INCOME",    "normal_balance": "CREDIT"},
                {"code": "4002", "name": "Other Income",            "account_type": "INCOME",    "normal_balance": "CREDIT"},
                {"code": "5001", "name": "Cost of Goods Sold",      "account_type": "EXPENSE",   "normal_balance": "DEBIT"},
                {"code": "5002", "name": "Interest Expense",        "account_type": "EXPENSE",   "normal_balance": "DEBIT"},
                {"code": "5003", "name": "Freight & Import Charges","account_type": "EXPENSE",   "normal_balance": "DEBIT"},
                {"code": "5004", "name": "Salary Expense",          "account_type": "EXPENSE",   "normal_balance": "DEBIT"},
                {"code": "5005", "name": "Rent Expense",            "account_type": "EXPENSE",   "normal_balance": "DEBIT"},
                {"code": "5006", "name": "Utilities Expense",       "account_type": "EXPENSE",   "normal_balance": "DEBIT"},
            ]
            for h in heads:
                db.add(AccountHead(**h))
            db.commit()
            print(f"[Init DB] Initialized {len(heads)} Chart of Accounts (Account Heads)")

        if db.query(User).count() == 0:
            from app.services.auth import hash_password
            admin_user = User(
                username="renewgenadmin",
                email="admin@renewgen.com.np",
                full_name="Renew Gen Administrator",
                hashed_password=hash_password("P@shupat1n@th"),
                role="ADMIN",
            )
            staff_user = User(
                username="staff",
                email="staff@renewgen.com.np",
                full_name="Renew Gen Staff Member",
                hashed_password=hash_password("staff123"),
                role="STAFF",
            )
            db.add(admin_user)
            db.add(staff_user)
            db.commit()
            print("[Init DB] Verified default users: renewgenadmin (ADMIN) and staff (STAFF)")
        db.close()
    except Exception as e:
        print(f"[Init DB Info] Initialization check: {e}")

