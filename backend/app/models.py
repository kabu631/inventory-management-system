from sqlalchemy import (
    Column, Integer, String, Float, Date, DateTime, ForeignKey, Text, Boolean
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


# ---------------------------------------------------------------------------
# System Users & Authentication
# ---------------------------------------------------------------------------
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(150), nullable=True)
    password_hash = Column(String(255), nullable=False)
    salt = Column(String(64), nullable=False)
    role = Column(String(20), nullable=False, default="STAFF")  # ADMIN | STAFF | ACCOUNTANT
    full_name = Column(String(100), nullable=False)
    staff_id = Column(String(50), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())


# ---------------------------------------------------------------------------
# Multi-Warehouse & Locations
# ---------------------------------------------------------------------------
class Warehouse(Base):
    __tablename__ = "warehouses"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), unique=True, nullable=False)
    name = Column(String(200), nullable=False)
    location = Column(String(200))
    is_primary = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())


# ---------------------------------------------------------------------------
# Suppliers & Vendors
# ---------------------------------------------------------------------------
class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    contact_person = Column(String(100))
    phone = Column(String(30))
    email = Column(String(150))
    address = Column(Text)
    pan_vat_no = Column(String(50))
    created_at = Column(DateTime, server_default=func.now())


# ---------------------------------------------------------------------------
# Customers
# ---------------------------------------------------------------------------
class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    phone = Column(String(20))
    email = Column(String(150))
    address = Column(Text)
    customer_type = Column(String(10), default="B2C")  # B2B | B2C
    credit_limit = Column(Float, default=0.0)
    pan_no = Column(String(50), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    journal_lines = relationship("JournalLine", back_populates="customer")


# ---------------------------------------------------------------------------
# Inventory / Battery SKUs
# ---------------------------------------------------------------------------
class Inventory(Base):
    __tablename__ = "inventory"

    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String(50), unique=True, nullable=False)
    name = Column(String(200), nullable=False)
    brand = Column(String(100))
    capacity_ah = Column(Float)       # Amp-hours
    voltage_v = Column(Float)         # Volts
    import_cost_npr = Column(Float, default=0.0)   # Cost per unit (NPR)
    selling_price_npr = Column(Float, default=0.0) # Selling price (NPR)
    stock_qty = Column(Integer, default=0)
    reorder_level = Column(Integer, default=5)
    warranty_months = Column(Integer, default=24) # Standard warranty (e.g. 24 months)
    hs_code = Column(String(20), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    journal_lines = relationship("JournalLine", back_populates="inventory_item")
    serials = relationship("BatterySerial", back_populates="inventory_item")


# ---------------------------------------------------------------------------
# Battery Serial & Warranty Tracking
# ---------------------------------------------------------------------------
class BatterySerial(Base):
    __tablename__ = "battery_serials"

    id = Column(Integer, primary_key=True, index=True)
    inventory_id = Column(Integer, ForeignKey("inventory.id"), nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=True)
    serial_number = Column(String(100), unique=True, nullable=False)
    purchase_date = Column(Date, nullable=False)
    warranty_months = Column(Integer, default=24)
    warranty_expiry_date = Column(Date, nullable=True)
    status = Column(String(30), default="IN_STOCK")  # IN_STOCK | SOLD | WARRANTY_CLAIM | SCRAPPED
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    sale_invoice_ref = Column(String(100), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    inventory_item = relationship("Inventory", back_populates="serials")
    customer = relationship("Customer")


class WarrantyClaim(Base):
    __tablename__ = "warranty_claims"

    id = Column(Integer, primary_key=True, index=True)
    serial_id = Column(Integer, ForeignKey("battery_serials.id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    claim_date = Column(Date, nullable=False)
    issue_description = Column(Text, nullable=False)
    status = Column(String(30), default="PENDING")  # PENDING | REPLACED | REJECTED
    replacement_serial_number = Column(String(100), nullable=True)
    notes = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

    serial = relationship("BatterySerial")
    customer = relationship("Customer")


# ---------------------------------------------------------------------------
# Inter-Warehouse Stock Transfers
# ---------------------------------------------------------------------------
class StockTransfer(Base):
    __tablename__ = "stock_transfers"

    id = Column(Integer, primary_key=True, index=True)
    transfer_date = Column(Date, nullable=False)
    reference = Column(String(100))
    from_warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    to_warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    inventory_id = Column(Integer, ForeignKey("inventory.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    notes = Column(Text)
    created_at = Column(DateTime, server_default=func.now())


# ---------------------------------------------------------------------------
# Purchase Orders (PO)
# ---------------------------------------------------------------------------
class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id = Column(Integer, primary_key=True, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    po_number = Column(String(100), unique=True, nullable=False)
    po_date = Column(Date, nullable=False)
    status = Column(String(30), default="SENT")  # DRAFT | SENT | RECEIVED | CANCELLED
    total_amount_npr = Column(Float, default=0.0)
    payment_method = Column(String(50), default="BANK")  # BANK | CASH | CREDIT
    notes = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

    supplier = relationship("Supplier")
    items = relationship("PurchaseOrderItem", back_populates="purchase_order", cascade="all, delete-orphan")


class PurchaseOrderItem(Base):
    __tablename__ = "purchase_order_items"

    id = Column(Integer, primary_key=True, index=True)
    po_id = Column(Integer, ForeignKey("purchase_orders.id"), nullable=False)
    inventory_id = Column(Integer, ForeignKey("inventory.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_cost_npr = Column(Float, nullable=False)
    total_cost_npr = Column(Float, nullable=False)

    purchase_order = relationship("PurchaseOrder", back_populates="items")
    inventory_item = relationship("Inventory")


# ---------------------------------------------------------------------------
# Chart of Accounts (Account Heads)
# ---------------------------------------------------------------------------
class AccountHead(Base):
    __tablename__ = "account_heads"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), unique=True, nullable=False)
    name = Column(String(200), nullable=False)
    account_type = Column(String(20), nullable=False)  # ASSET|LIABILITY|EQUITY|INCOME|EXPENSE
    normal_balance = Column(String(6), default="DEBIT")  # DEBIT | CREDIT

    journal_lines = relationship("JournalLine", back_populates="account")


# ---------------------------------------------------------------------------
# Journal Entries (double-entry)
# ---------------------------------------------------------------------------
class JournalEntry(Base):
    __tablename__ = "journal_entries"

    id = Column(Integer, primary_key=True, index=True)
    entry_date = Column(Date, nullable=False)
    reference = Column(String(100))
    narration = Column(Text)
    category = Column(String(30), default="GENERAL")  # SALES | PURCHASE | PAYMENT | RECEIPT | EXPENSE | LOAN | INVESTMENT | GENERAL
    is_posted = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

    lines = relationship("JournalLine", back_populates="entry", cascade="all, delete-orphan")


class JournalLine(Base):
    __tablename__ = "journal_lines"

    id = Column(Integer, primary_key=True, index=True)
    entry_id = Column(Integer, ForeignKey("journal_entries.id"), nullable=False)
    account_id = Column(Integer, ForeignKey("account_heads.id"), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    inventory_id = Column(Integer, ForeignKey("inventory.id"), nullable=True)
    debit_npr = Column(Float, default=0.0)
    credit_npr = Column(Float, default=0.0)
    description = Column(Text)

    entry = relationship("JournalEntry", back_populates="lines")
    account = relationship("AccountHead", back_populates="journal_lines")
    customer = relationship("Customer", back_populates="journal_lines")
    inventory_item = relationship("Inventory", back_populates="journal_lines")


# ---------------------------------------------------------------------------
# Bank Loans
# ---------------------------------------------------------------------------
class BankLoan(Base):
    __tablename__ = "bank_loans"

    id = Column(Integer, primary_key=True, index=True)
    bank_name = Column(String(200), nullable=False)
    loan_account_no = Column(String(100))
    principal_npr = Column(Float, nullable=False)
    annual_interest_rate = Column(Float, default=10.0)  # 10% simple interest
    disbursement_date = Column(Date, nullable=False)
    due_date = Column(Date)
    purpose = Column(Text)
    is_closed = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())

    repayments = relationship("LoanRepayment", back_populates="loan", cascade="all, delete-orphan")


class LoanRepayment(Base):
    __tablename__ = "loan_repayments"

    id = Column(Integer, primary_key=True, index=True)
    loan_id = Column(Integer, ForeignKey("bank_loans.id"), nullable=False)
    payment_date = Column(Date, nullable=False)
    principal_paid_npr = Column(Float, default=0.0)
    interest_paid_npr = Column(Float, default=0.0)
    total_paid_npr = Column(Float, default=0.0)
    journal_entry_id = Column(Integer, ForeignKey("journal_entries.id"), nullable=True)
    notes = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

    loan = relationship("BankLoan", back_populates="repayments")


# ---------------------------------------------------------------------------
# Company Investors & Equity Capital
# ---------------------------------------------------------------------------
class Investor(Base):
    __tablename__ = "investors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    phone = Column(String(30))
    email = Column(String(150))
    address = Column(Text)
    ownership_pct = Column(Float, default=0.0)
    notes = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

    investments = relationship("InvestmentRecord", back_populates="investor", cascade="all, delete-orphan")


class InvestmentRecord(Base):
    __tablename__ = "investment_records"

    id = Column(Integer, primary_key=True, index=True)
    investor_id = Column(Integer, ForeignKey("investors.id"), nullable=False)
    amount_npr = Column(Float, nullable=False)
    investment_date = Column(Date, nullable=False)
    payment_method = Column(String(50), default="BANK")  # BANK | CASH | CHEQUE
    reference = Column(String(100))
    journal_entry_id = Column(Integer, ForeignKey("journal_entries.id"), nullable=True)
    notes = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

    investor = relationship("Investor", back_populates="investments")
