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
            if "hs_code" not in inv_cols:
                conn.exec_driver_sql("ALTER TABLE inventory ADD COLUMN hs_code VARCHAR(20)")
            if "category" not in inv_cols:
                conn.exec_driver_sql("ALTER TABLE inventory ADD COLUMN category VARCHAR(100)")
            if "unit_of_measure" not in inv_cols:
                conn.exec_driver_sql("ALTER TABLE inventory ADD COLUMN unit_of_measure VARCHAR(50) DEFAULT 'pcs'")
            if "specifications" not in inv_cols:
                conn.exec_driver_sql("ALTER TABLE inventory ADD COLUMN specifications TEXT")

            pragma_comp = conn.exec_driver_sql("PRAGMA table_info(company_settings)").fetchall()
            comp_cols = [row[1] for row in pragma_comp]
            if "business_type" not in comp_cols:
                conn.exec_driver_sql("ALTER TABLE company_settings ADD COLUMN business_type VARCHAR(150) DEFAULT 'Commercial Trading & Distribution'")
            if "product_term" not in comp_cols:
                conn.exec_driver_sql("ALTER TABLE company_settings ADD COLUMN product_term VARCHAR(50) DEFAULT 'Product'")
            if "product_term_plural" not in comp_cols:
                conn.exec_driver_sql("ALTER TABLE company_settings ADD COLUMN product_term_plural VARCHAR(50) DEFAULT 'Products'")

            pragma_cust = conn.exec_driver_sql("PRAGMA table_info(customers)").fetchall()
            cust_cols = [row[1] for row in pragma_cust]
            if "credit_limit" not in cust_cols:
                conn.exec_driver_sql("ALTER TABLE customers ADD COLUMN credit_limit FLOAT DEFAULT 0.0")
            if "pan_no" not in cust_cols:
                conn.exec_driver_sql("ALTER TABLE customers ADD COLUMN pan_no VARCHAR(50)")

            pragma_je = conn.exec_driver_sql("PRAGMA table_info(journal_entries)").fetchall()
            je_cols = [row[1] for row in pragma_je]
            if "category" not in je_cols:
                conn.exec_driver_sql("ALTER TABLE journal_entries ADD COLUMN category VARCHAR(30) DEFAULT 'GENERAL'")

            pragma_usr = conn.exec_driver_sql("PRAGMA table_info(users)").fetchall()
            usr_cols = [row[1] for row in pragma_usr]
            if "is_active" not in usr_cols:
                conn.exec_driver_sql("ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1")
            if "email" not in usr_cols:
                conn.exec_driver_sql("ALTER TABLE users ADD COLUMN email VARCHAR(150)")

            conn.commit()
    except Exception as e:
        print(f"[Migration Info] Auto column check: {e}")

    # Ensure default admin, accountant and staff users exist & Account Heads exist
    try:
        db = SessionLocal()
        from app.routers.journal import ensure_default_account_heads
        from app.routers.auth import ensure_default_users
        ensure_default_account_heads(db)
        ensure_default_users(db)
        db.close()
    except Exception as e:
        print(f"[Init DB Info] Initialization check: {e}")

