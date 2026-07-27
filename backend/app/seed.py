"""
Seed script: generates 12 months of realistic data for the Battery ERP.
Run once: python -m app.seed
"""
import os
import sys
import random
from datetime import date, timedelta

# Make sure the backend root is on sys.path when run directly
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.database import SessionLocal, init_db
from app.models import (
    Customer, Inventory, AccountHead, JournalEntry,
    JournalLine, BankLoan, LoanRepayment,
)

random.seed(42)

# ---------------------------------------------------------------------------
# Reference data
# ---------------------------------------------------------------------------
BATTERY_SKUS = [
    {"sku": "LFP-12-100", "name": "LFP 12V 100Ah Battery", "brand": "PowerNep", "capacity_ah": 100, "voltage_v": 12, "import_cost_npr": 18000, "selling_price_npr": 24000},
    {"sku": "LFP-24-100", "name": "LFP 24V 100Ah Battery", "brand": "PowerNep", "capacity_ah": 100, "voltage_v": 24, "import_cost_npr": 35000, "selling_price_npr": 46000},
    {"sku": "LFP-48-50",  "name": "LFP 48V 50Ah Battery",  "brand": "VoltEdge", "capacity_ah": 50,  "voltage_v": 48, "import_cost_npr": 28000, "selling_price_npr": 38000},
    {"sku": "LFP-48-100", "name": "LFP 48V 100Ah Battery", "brand": "VoltEdge", "capacity_ah": 100, "voltage_v": 48, "import_cost_npr": 52000, "selling_price_npr": 68000},
    {"sku": "NMC-12-60",  "name": "NMC 12V 60Ah Battery",  "brand": "SunStore", "capacity_ah": 60,  "voltage_v": 12, "import_cost_npr": 12000, "selling_price_npr": 16500},
    {"sku": "NMC-24-60",  "name": "NMC 24V 60Ah Battery",  "brand": "SunStore", "capacity_ah": 60,  "voltage_v": 24, "import_cost_npr": 22000, "selling_price_npr": 29000},
    {"sku": "LFP-72-50",  "name": "LFP 72V 50Ah E-Bike",   "brand": "EcoRide",  "capacity_ah": 50,  "voltage_v": 72, "import_cost_npr": 32000, "selling_price_npr": 44000},
    {"sku": "LFP-72-30",  "name": "LFP 72V 30Ah E-Bike",   "brand": "EcoRide",  "capacity_ah": 30,  "voltage_v": 72, "import_cost_npr": 21000, "selling_price_npr": 29000},
    {"sku": "LFP-12-200", "name": "LFP 12V 200Ah Deep Cycle","brand": "SolarMax","capacity_ah": 200, "voltage_v": 12, "import_cost_npr": 34000, "selling_price_npr": 46000},
    {"sku": "LFP-48-200", "name": "LFP 48V 200Ah Solar",    "brand": "SolarMax", "capacity_ah": 200, "voltage_v": 48, "import_cost_npr": 98000, "selling_price_npr": 130000},
]

CUSTOMER_NAMES_B2B = [
    "Himalayan Solar Pvt. Ltd.", "Kathmandu EV Hub", "Pokhara Power Solutions",
    "Green Energy Nepal", "Everest Electronics", "Boudha Battery House",
    "Lalitpur Solar Depot", "Bhaktapur EcoStore", "Chitwan Power Hub",
    "Birgunj Trade Center", "Butwal Solar & EV",
]
CUSTOMER_NAMES_B2C = [
    "Ram Bahadur Thapa", "Sita Devi Sharma", "Hari Prasad Adhikari",
    "Gita Kumari Poudel", "Bikash Raj Karki", "Anjali Maharjan",
    "Suresh Tamang", "Priya Shrestha", "Dipak Bhandari",
    "Manisha Basnet", "Roshan Khadka", "Samjhana Rai",
    "Nabin Gurung", "Puja Lama", "Sanjay Thapa",
    "Rupa Yadav", "Mohan Prasad Jha", "Bimala Devi Acharya",
    "Kiran Rijal", "Sunita Shrestha",
]

BANK_LOANS_DATA = [
    {"bank_name": "Nepal Bank Limited",         "loan_account_no": "NBL-2024-001", "principal_npr": 2000000, "annual_interest_rate": 10.0, "disbursement_date": date(2024, 1, 15), "due_date": date(2026, 1, 15), "purpose": "Working capital for battery import"},
    {"bank_name": "Rastriya Banijya Bank",      "loan_account_no": "RBB-2024-042", "principal_npr": 3500000, "annual_interest_rate": 10.0, "disbursement_date": date(2024, 3, 1),  "due_date": date(2026, 3, 1),  "purpose": "Warehouse expansion"},
    {"bank_name": "Nabil Bank",                 "loan_account_no": "NABIL-24-789", "principal_npr": 1500000, "annual_interest_rate": 10.0, "disbursement_date": date(2024, 6, 10), "due_date": date(2025, 12, 10),"purpose": "E-bike battery stock import"},
    {"bank_name": "NIC Asia Bank",              "loan_account_no": "NICA-2024-33",  "principal_npr": 5000000, "annual_interest_rate": 10.0, "disbursement_date": date(2024, 7, 20), "due_date": date(2027, 7, 20), "purpose": "Capital equipment purchase"},
    {"bank_name": "Himalayan Bank",             "loan_account_no": "HBL-2025-007", "principal_npr": 2500000, "annual_interest_rate": 10.0, "disbursement_date": date(2025, 1, 5),  "due_date": date(2027, 1, 5),  "purpose": "Solar battery bulk import"},
]

ACCOUNT_HEADS = [
    # ASSETS
    {"code": "1001", "name": "Cash in Hand",            "account_type": "ASSET",     "normal_balance": "DEBIT"},
    {"code": "1002", "name": "Bank Account - NBL",      "account_type": "ASSET",     "normal_balance": "DEBIT"},
    {"code": "1003", "name": "Accounts Receivable",     "account_type": "ASSET",     "normal_balance": "DEBIT"},
    {"code": "1004", "name": "Inventory / Stock",       "account_type": "ASSET",     "normal_balance": "DEBIT"},
    {"code": "1005", "name": "Prepaid Expenses",        "account_type": "ASSET",     "normal_balance": "DEBIT"},
    # LIABILITIES
    {"code": "2001", "name": "Accounts Payable",        "account_type": "LIABILITY", "normal_balance": "CREDIT"},
    {"code": "2002", "name": "Bank Loan Payable",       "account_type": "LIABILITY", "normal_balance": "CREDIT"},
    {"code": "2003", "name": "Interest Payable",        "account_type": "LIABILITY", "normal_balance": "CREDIT"},
    {"code": "2004", "name": "VAT Payable",             "account_type": "LIABILITY", "normal_balance": "CREDIT"},
    # EQUITY
    {"code": "3001", "name": "Owner's Equity",          "account_type": "EQUITY",    "normal_balance": "CREDIT"},
    {"code": "3002", "name": "Retained Earnings",       "account_type": "EQUITY",    "normal_balance": "CREDIT"},
    # INCOME
    {"code": "4001", "name": "Sales Revenue",           "account_type": "INCOME",    "normal_balance": "CREDIT"},
    {"code": "4002", "name": "Other Income",            "account_type": "INCOME",    "normal_balance": "CREDIT"},
    # EXPENSES
    {"code": "5001", "name": "Cost of Goods Sold",      "account_type": "EXPENSE",   "normal_balance": "DEBIT"},
    {"code": "5002", "name": "Interest Expense",        "account_type": "EXPENSE",   "normal_balance": "DEBIT"},
    {"code": "5003", "name": "Freight & Import Charges","account_type": "EXPENSE",   "normal_balance": "DEBIT"},
    {"code": "5004", "name": "Salary Expense",          "account_type": "EXPENSE",   "normal_balance": "DEBIT"},
    {"code": "5005", "name": "Rent Expense",            "account_type": "EXPENSE",   "normal_balance": "DEBIT"},
    {"code": "5006", "name": "Utilities Expense",       "account_type": "EXPENSE",   "normal_balance": "DEBIT"},
]


def seed():
    db = SessionLocal()
    try:
        # Check if already seeded
        if db.query(Customer).count() > 0:
            print("Database already seeded. Skipping.")
            return

        print("Seeding database...")

        # 1. Account Heads
        acc_map = {}
        for ah in ACCOUNT_HEADS:
            obj = AccountHead(**ah)
            db.add(obj)
            db.flush()
            acc_map[ah["code"]] = obj
        print(f"  Created {len(ACCOUNT_HEADS)} account heads")

        # 2. Inventory
        inv_map = {}
        for b in BATTERY_SKUS:
            obj = Inventory(**b, stock_qty=random.randint(10, 80))
            db.add(obj)
            db.flush()
            inv_map[b["sku"]] = obj
        print(f"  Created {len(BATTERY_SKUS)} battery SKUs")

        # 3. Customers
        customers = []
        for n in CUSTOMER_NAMES_B2B:
            c = Customer(
                name=n, customer_type="B2B",
                phone=f"98{random.randint(10000000, 99999999)}",
                address="Nepal",
                credit_limit=random.choice([100000, 200000, 500000, 1000000]),
            )
            db.add(c); db.flush(); customers.append(c)

        for n in CUSTOMER_NAMES_B2C:
            c = Customer(
                name=n, customer_type="B2C",
                phone=f"98{random.randint(10000000, 99999999)}",
                address="Nepal",
                credit_limit=0,
            )
            db.add(c); db.flush(); customers.append(c)
        print(f"  Created {len(customers)} customers")

        # 4. Bank Loans
        loans = []
        for l in BANK_LOANS_DATA:
            obj = BankLoan(**l)
            db.add(obj); db.flush(); loans.append(obj)
        print(f"  Created {len(loans)} bank loans")

        # 5. Journal Entries — 12 months of transactions
        start = date(2025, 1, 1)
        entry_count = 0

        for month_offset in range(12):
            month_start = date(start.year, start.month + month_offset if start.month + month_offset <= 12 else (start.month + month_offset) % 12, 1) if start.month + month_offset <= 12 else date(start.year + 1, (start.month + month_offset) % 12 or 12, 1)
            # Simplified: just iterate by adding ~30 days
            month_base = start + timedelta(days=month_offset * 30)

            # Salary payment (monthly)
            salary_entry = JournalEntry(
                entry_date=month_base + timedelta(days=25),
                reference=f"SAL-{month_base.strftime('%Y%m')}",
                narration="Monthly salary payment",
            )
            salary_amount = random.randint(80000, 120000)
            salary_entry.lines = [
                JournalLine(account_id=acc_map["5004"].id, debit_npr=salary_amount, credit_npr=0, description="Salary expense"),
                JournalLine(account_id=acc_map["1002"].id, debit_npr=0, credit_npr=salary_amount, description="Paid from bank"),
            ]
            db.add(salary_entry); entry_count += 1

            # Rent payment (monthly)
            rent_entry = JournalEntry(
                entry_date=month_base + timedelta(days=1),
                reference=f"RENT-{month_base.strftime('%Y%m')}",
                narration="Monthly warehouse rent",
            )
            rent_entry.lines = [
                JournalLine(account_id=acc_map["5005"].id, debit_npr=35000, credit_npr=0),
                JournalLine(account_id=acc_map["1002"].id, debit_npr=0, credit_npr=35000),
            ]
            db.add(rent_entry); entry_count += 1

            # Sales transactions (15–25 per month)
            sales_count = random.randint(15, 25)
            for _ in range(sales_count):
                sku_obj = random.choice(list(inv_map.values()))
                qty = random.randint(1, 5)
                revenue = sku_obj.selling_price_npr * qty
                cogs = sku_obj.import_cost_npr * qty
                cust = random.choice(customers)
                sale_date = month_base + timedelta(days=random.randint(0, 28))
                ref = f"INV-{month_base.strftime('%Y%m')}-{random.randint(100, 999)}"

                # Revenue recognition: Debit AR / Credit Sales
                sale_entry = JournalEntry(
                    entry_date=sale_date,
                    reference=ref,
                    narration=f"Sale of {qty}x {sku_obj.name} to {cust.name}",
                )
                sale_entry.lines = [
                    JournalLine(account_id=acc_map["1003"].id, customer_id=cust.id, inventory_id=sku_obj.id, debit_npr=revenue, credit_npr=0, description=f"AR - {cust.name}"),
                    JournalLine(account_id=acc_map["4001"].id, debit_npr=0, credit_npr=revenue, description="Sales revenue"),
                    JournalLine(account_id=acc_map["5001"].id, debit_npr=cogs, credit_npr=0, description="COGS"),
                    JournalLine(account_id=acc_map["1004"].id, debit_npr=0, credit_npr=cogs, description="Inventory reduction"),
                ]
                db.add(sale_entry); entry_count += 1

            # Import purchase (1–2 per month)
            import_count = random.randint(1, 2)
            for _ in range(import_count):
                sku_obj = random.choice(list(inv_map.values()))
                qty = random.randint(10, 30)
                total_cost = sku_obj.import_cost_npr * qty
                freight = int(total_cost * 0.03)
                imp_date = month_base + timedelta(days=random.randint(0, 15))

                imp_entry = JournalEntry(
                    entry_date=imp_date,
                    reference=f"IMP-{month_base.strftime('%Y%m')}-{random.randint(100, 999)}",
                    narration=f"Import of {qty}x {sku_obj.name} from India",
                )
                imp_entry.lines = [
                    JournalLine(account_id=acc_map["1004"].id, debit_npr=total_cost + freight, credit_npr=0, description="Stock received"),
                    JournalLine(account_id=acc_map["2001"].id, debit_npr=0, credit_npr=total_cost, description="Payable to supplier"),
                    JournalLine(account_id=acc_map["5003"].id, debit_npr=freight, credit_npr=0, description="Freight charges"),
                    JournalLine(account_id=acc_map["1002"].id, debit_npr=0, credit_npr=freight, description="Freight paid"),
                ]
                db.add(imp_entry); entry_count += 1

            # Loan interest accrual (quarterly simplified to monthly)
            for loan in loans:
                if loan.disbursement_date <= month_base:
                    monthly_interest = int(loan.principal_npr * (loan.annual_interest_rate / 100) / 12)
                    int_entry = JournalEntry(
                        entry_date=month_base + timedelta(days=28),
                        reference=f"INT-{loan.id}-{month_base.strftime('%Y%m')}",
                        narration=f"Interest accrual on {loan.bank_name} loan",
                    )
                    int_entry.lines = [
                        JournalLine(account_id=acc_map["5002"].id, debit_npr=monthly_interest, credit_npr=0),
                        JournalLine(account_id=acc_map["2003"].id, debit_npr=0, credit_npr=monthly_interest),
                    ]
                    db.add(int_entry); entry_count += 1

        print(f"  Created {entry_count} journal entries")

        # 6. Loan repayments (1–2 per loan)
        rep_count = 0
        for loan in loans:
            for _ in range(random.randint(1, 2)):
                rep_date = loan.disbursement_date + timedelta(days=random.randint(90, 300))
                if rep_date > date.today():
                    continue
                principal_paid = int(loan.principal_npr * random.uniform(0.05, 0.15))
                interest_paid = int(loan.principal_npr * (loan.annual_interest_rate / 100) / 12 * 3)
                total = principal_paid + interest_paid

                rep_entry = JournalEntry(
                    entry_date=rep_date,
                    reference=f"LREP-{loan.id}-{rep_date.strftime('%Y%m')}",
                    narration=f"Loan repayment to {loan.bank_name}",
                )
                rep_entry.lines = [
                    JournalLine(account_id=acc_map["2002"].id, debit_npr=principal_paid, credit_npr=0),
                    JournalLine(account_id=acc_map["2003"].id, debit_npr=interest_paid, credit_npr=0),
                    JournalLine(account_id=acc_map["1002"].id, debit_npr=0, credit_npr=total),
                ]
                db.add(rep_entry); db.flush()

                rep = LoanRepayment(
                    loan_id=loan.id,
                    payment_date=rep_date,
                    principal_paid_npr=principal_paid,
                    interest_paid_npr=interest_paid,
                    total_paid_npr=total,
                    journal_entry_id=rep_entry.id,
                )
                db.add(rep); rep_count += 1

        print(f"  Created {rep_count} loan repayments")

        db.commit()
        print("[OK] Seed complete!")

    except Exception as e:
        db.rollback()
        print(f"[FAIL] Seed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    init_db()
    seed()
