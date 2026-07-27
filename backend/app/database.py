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

