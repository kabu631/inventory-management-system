"""
Seed script: generates 12 months of realistic data for ONIN Infosys ERP.
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
    JournalLine, BankLoan, LoanRepayment, User,
)
from app.services.auth import hash_password

random.seed(42)

# ---------------------------------------------------------------------------
# Reference data — ONIN Infosys (Laptops, PC Components & Accessories)
# ---------------------------------------------------------------------------
BATTERY_SKUS = [
    {"sku": "MAC-M3P-14",   "name": 'MacBook Pro 14" M3 Pro 18GB/512GB', "brand": "Apple",     "capacity_ah": 18, "voltage_v": 14, "import_cost_npr": 265000, "selling_price_npr": 295000, "warranty_months": 12},
    {"sku": "DELL-XPS-15",  "name": "Dell XPS 15 9530 i7-13700H 16GB/1TB RTX 4060", "brand": "Dell", "capacity_ah": 16, "voltage_v": 15, "import_cost_npr": 245000, "selling_price_npr": 275000, "warranty_months": 12},
    {"sku": "HP-VIC-15",    "name": "HP Victus 15 Ryzen 5 7535HS 16GB/512GB RTX 2050", "brand": "HP", "capacity_ah": 16, "voltage_v": 15, "import_cost_npr": 82000, "selling_price_npr": 94000, "warranty_months": 12},
    {"sku": "ASUS-ROG-G16", "name": "ASUS ROG Strix G16 i7-13650HX 16GB/1TB RTX 4060", "brand": "ASUS", "capacity_ah": 16, "voltage_v": 16, "import_cost_npr": 210000, "selling_price_npr": 235000, "warranty_months": 24},
    {"sku": "LEN-LEG-5P",   "name": "Lenovo Legion 5 Pro Ryzen 7 7745HX 16GB/1TB RTX 4070", "brand": "Lenovo", "capacity_ah": 16, "voltage_v": 16, "import_cost_npr": 220000, "selling_price_npr": 248000, "warranty_months": 24},
    {"sku": "ACER-HEL-16",  "name": "Acer Predator Helios 16 i7-13700HX 16GB/1TB RTX 4070", "brand": "Acer", "capacity_ah": 16, "voltage_v": 16, "import_cost_npr": 215000, "selling_price_npr": 240000, "warranty_months": 12},
    {"sku": "CPU-INTEL-I9", "name": "Intel Core i9-14900K Desktop Processor", "brand": "Intel", "capacity_ah": 0, "voltage_v": 0, "import_cost_npr": 75000, "selling_price_npr": 86000, "warranty_months": 36},
    {"sku": "GPU-RTX-4080S","name": "NVIDIA GeForce RTX 4080 Super 16GB Graphics Card", "brand": "NVIDIA", "capacity_ah": 16, "voltage_v": 0, "import_cost_npr": 155000, "selling_price_npr": 175000, "warranty_months": 36},
    {"sku": "SSD-SAM-990",  "name": "Samsung 990 PRO 2TB PCIe 4.0 NVMe SSD", "brand": "Samsung", "capacity_ah": 0, "voltage_v": 0, "import_cost_npr": 24000, "selling_price_npr": 29500, "warranty_months": 60},
    {"sku": "RAM-COR-32G",  "name": "Corsair Vengeance 32GB (2x16GB) DDR5 6000MHz RAM", "brand": "Corsair", "capacity_ah": 32, "voltage_v": 0, "import_cost_npr": 16500, "selling_price_npr": 20500, "warranty_months": 36},
    {"sku": "MON-ASUS-27",  "name": 'ASUS TUF Gaming 27" 180Hz IPS Gaming Monitor', "brand": "ASUS", "capacity_ah": 0, "voltage_v": 27, "import_cost_npr": 28000, "selling_price_npr": 34500, "warranty_months": 24},
    {"sku": "MS-LOGI-MX3S", "name": "Logitech MX Master 3S Wireless Performance Mouse", "brand": "Logitech", "capacity_ah": 0, "voltage_v": 0, "import_cost_npr": 12500, "selling_price_npr": 15500, "warranty_months": 12},
    {"sku": "KB-RAZ-BLK4",  "name": "Razer BlackWidow V4 RGB Mechanical Keyboard", "brand": "Razer", "capacity_ah": 0, "voltage_v": 0, "import_cost_npr": 19000, "selling_price_npr": 23500, "warranty_months": 12},
    {"sku": "HS-STEEL-N7",  "name": "SteelSeries Arctis Nova 7 Wireless Gaming Headset", "brand": "SteelSeries", "capacity_ah": 0, "voltage_v": 0, "import_cost_npr": 22000, "selling_price_npr": 27000, "warranty_months": 12},
]

CUSTOMER_NAMES_B2B = [
    "WorldLink Communications Pvt. Ltd.", "Nepal Telecom (NTC)", "InfoTech Solutions Nepal",
    "TechHub Nepal Pvt. Ltd.", "Kathmandu IT Systems", "Everest Cybernetics",
    "Pokhara Digital Media", "Lalitpur Software Labs", "Bhaktapur Tech Center",
    "Birgunj Enterprise IT", "Butwal Infotech House",
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
    {"bank_name": "Nepal Bank Limited",         "loan_account_no": "NBL-2024-001", "principal_npr": 2000000, "annual_interest_rate": 10.0, "disbursement_date": date(2024, 1, 15), "due_date": date(2026, 1, 15), "purpose": "Working capital for laptop & component import"},
    {"bank_name": "Rastriya Banijya Bank",      "loan_account_no": "RBB-2024-042", "principal_npr": 3500000, "annual_interest_rate": 10.0, "disbursement_date": date(2024, 3, 1),  "due_date": date(2026, 3, 1),  "purpose": "Pako, New Road flagship store expansion"},
    {"bank_name": "Nabil Bank",                 "loan_account_no": "NABIL-24-789", "principal_npr": 1500000, "annual_interest_rate": 10.0, "disbursement_date": date(2024, 6, 10), "due_date": date(2025, 12, 10),"purpose": "Gaming PC inventory stock financing"},
    {"bank_name": "NIC Asia Bank",              "loan_account_no": "NICA-2024-33",  "principal_npr": 5000000, "annual_interest_rate": 10.0, "disbursement_date": date(2024, 7, 20), "due_date": date(2027, 7, 20), "purpose": "Corporate IT hardware import line"},
    {"bank_name": "Himalayan Bank",             "loan_account_no": "HBL-2025-007", "principal_npr": 2500000, "annual_interest_rate": 10.0, "disbursement_date": date(2025, 1, 5),  "due_date": date(2027, 1, 5),  "purpose": "Apple & ASUS bulk inventory import"},
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

        # 0. User Accounts (Admin & Staff)
        if db.query(User).count() == 0:
            admin_user = User(
                username="onininfosys",
                email="admin@onin.com.np",
                full_name="System Administrator",
                hashed_password=hash_password("P@shupat1nath"),
                role="ADMIN",
                is_active=True,
            )
            staff_user = User(
                username="staff",
                email="staff@onin.com.np",
                full_name="Onin Staff Member",
                hashed_password=hash_password("staff123"),
                role="STAFF",
                is_active=True,
            )
            db.add(admin_user)
            db.add(staff_user)
            db.flush()
            print("  Created default user accounts (onininfosys / P@shupat1nath, staff / staff123)")
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
                    narration=f"Import of {qty}x {sku_obj.name} from Authorized Distributor",
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
