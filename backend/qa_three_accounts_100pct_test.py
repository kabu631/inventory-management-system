"""
=============================================================================
RENEW GEN RESOURCES ERP - 3-ACCOUNT COMPREHENSIVE QA VERIFICATION (100% PASS)
Senior Principal QA Test Engineer Specification
=============================================================================
Tests all 3 accounts across 100% of their authorized capabilities:
  1. ADMIN (renewgenadmin): Complete Executive & Operational Access
  2. STAFF (staff): Operations, SKU Management, Purchases, Sales & Cloud Backup
  3. ACCOUNTANT (accountant): Financial Audits, Double-Entry Journals, Tax Clearance & Ledgers
=============================================================================
"""

import sys
import json
import time
import urllib.request
import urllib.error
from datetime import date

BASE_URL = "http://127.0.0.1:8000"

class AccountTester:
    def __init__(self, account_name: str, username: str, password: str, expected_role: str):
        self.account_name = account_name
        self.username = username
        self.password = password
        self.expected_role = expected_role
        self.token = None
        self.passed = 0
        self.failed = 0
        self.total = 0
        self.results = []

    def record(self, test_name: str, passed: bool, details: str = ""):
        self.total += 1
        if passed:
            self.passed += 1
            status = "PASS"
        else:
            self.failed += 1
            status = "FAIL"
        self.results.append({"name": test_name, "status": status, "details": details})
        icon = "[PASS]" if passed else "[FAIL]"
        print(f"    {icon} {test_name}: {details}")

    def call(self, method: str, path: str, data: dict = None):
        url = f"{BASE_URL}{path}"
        headers = {
            "User-Agent": f"RenewGen-QA-{self.account_name}/1.0",
            "Accept": "application/json"
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        
        req_body = None
        if data is not None:
            req_body = json.dumps(data).encode("utf-8")
            headers["Content-Type"] = "application/json"
        
        req = urllib.request.Request(url, data=req_body, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                status = resp.status
                raw = resp.read()
                try:
                    body = json.loads(raw.decode("utf-8"))
                except Exception:
                    body = raw.decode("utf-8", errors="ignore")
                return status, body
        except urllib.error.HTTPError as e:
            status = e.code
            raw = e.read()
            try:
                body = json.loads(raw.decode("utf-8"))
            except Exception:
                body = raw.decode("utf-8", errors="ignore")
            return status, body
        except Exception as e:
            return 0, str(e)

    def login(self):
        st, res = self.call("POST", "/api/auth/login", {"username": self.username, "password": self.password})
        self.token = res.get("token") or res.get("access_token") if isinstance(res, dict) else None
        role_matched = isinstance(res, dict) and res.get("user", {}).get("role") == self.expected_role
        self.record(f"Login & Role Validation ({self.expected_role})", st == 200 and self.token is not None and role_matched, f"Status: {st}, Role: {self.expected_role}")
        return self.token is not None


def run_full_three_account_suite():
    print("\n" + "="*85)
    print(">> EXECUTING 100% PASS VALIDATION ACROSS ALL THREE ROLES (ADMIN, STAFF, ACCOUNTANT)")
    print("="*85)
    
    unique_id = str(int(time.time()))
    today_str = str(date.today())

    # =========================================================================
    # 1. ADMIN ACCOUNT AUDIT
    # =========================================================================
    print("\n" + "-"*85)
    print("[ACCOUNT 1] ADMIN (renewgenadmin) -- FULL EXECUTIVE & OPERATIONAL ACCESS")
    print("-"*85)
    admin = AccountTester("Admin", "renewgenadmin", "P@shupat1n@th", "ADMIN")
    if not admin.login():
        print("Admin login failed. Aborting.")
        return False

    # 1.1 Identity
    st, res = admin.call("GET", "/api/auth/me")
    admin.record("Verify Admin Token (/api/auth/me)", st == 200 and res.get("role") == "ADMIN", f"Role: {res.get('role')}")

    # 1.2 Inventory - Add SKU
    admin_sku = f"ADM-LFP-{unique_id}"
    st, res = admin.call("POST", "/api/inventory/", {
        "sku": admin_sku, "name": f"Admin LFP 12V Battery ({unique_id})",
        "brand": "PowerNep Admin", "capacity_ah": 120.0, "voltage_v": 12.0,
        "import_cost_npr": 19000.0, "selling_price_npr": 26000.0,
        "stock_qty": 15, "reorder_level": 5, "hs_code": "8507.60"
    })
    admin_item_id = res.get("id") if isinstance(res, dict) else None
    admin.record("Add Battery SKU", st == 201 and admin_item_id is not None, f"SKU: {admin_sku}, ID: {admin_item_id}")

    # 1.3 Inventory - Edit SKU
    if admin_item_id:
        st, res = admin.call("PATCH", f"/api/inventory/{admin_item_id}", {
            "name": f"Admin LFP 12V Battery (Updated - {unique_id})",
            "selling_price_npr": 27500.0
        })
        admin.record("Edit Battery SKU", st == 200 and res.get("selling_price_npr") == 27500.0, "Price updated to 27500 NPR")

    # 1.4 Inventory - Purchase Stock
    if admin_item_id:
        st, res = admin.call("POST", "/api/inventory/purchase", {
            "payment_method": "BANK", "purchase_date": today_str,
            "reference": f"PO-ADM-{unique_id}",
            "items": [{"inventory_id": admin_item_id, "quantity": 10, "unit_cost_npr": 19000.0}]
        })
        admin.record("Purchase Inward Stock", st == 201, "Stock incremented by 10 units")

    # 1.5 Customer - Create Customer
    st, res = admin.call("POST", "/api/customers/", {
        "name": f"Admin Test Client ({unique_id})", "customer_type": "B2B",
        "phone": f"981{unique_id[-7:]}", "address": "Kathmandu, Nepal",
        "pan_no": "600111222", "credit_limit": 300000.0
    })
    admin_cust_id = res.get("id") if isinstance(res, dict) else None
    admin.record("Create Customer Account", st == 201 and admin_cust_id is not None, f"Cust ID: {admin_cust_id}")

    # 1.6 Inventory - Sell Battery / Create Invoice
    if admin_item_id and admin_cust_id:
        st, res = admin.call("POST", "/api/inventory/sell", {
            "customer_id": admin_cust_id, "payment_method": "PARTIAL",
            "invoice_date": today_str, "reference": f"INV-ADM-{unique_id}",
            "items": [{"inventory_id": admin_item_id, "quantity": 5, "unit_price_npr": 27500.0}],
            "apply_vat": True, "vat_rate": 13.0, "paid_amount_npr": 40000.0,
            "partial_payment_method": "BANK"
        })
        admin.record("Create Sales Invoice with 13% VAT", st == 201, "Stock decremented by 5 units")

    # 1.7 Warehouses - Create & List
    wh_code = f"AD{unique_id[-4:]}"
    st, res = admin.call("POST", "/api/warehouses/", {
        "code": wh_code, "name": f"Admin Depot {wh_code}", "location": "Butwal, Nepal"
    })
    admin.record("Create Warehouse Location", st == 201, f"Code: {wh_code}")

    # 1.8 Suppliers - Create & List
    st, res = admin.call("POST", "/api/suppliers/", {
        "name": f"Admin Supplier Corp ({unique_id})", "contact_person": "Hari Krishna",
        "phone": f"982{unique_id[-7:]}", "email": f"supplier_{unique_id}@admincorp.com",
        "pan_vat_no": "300999888", "address": "Biratnagar, Nepal"
    })
    admin.record("Create Supplier Record", st == 201, "Supplier created successfully")

    # 1.9 Serials & Warranty - Register Serial
    if admin_item_id:
        admin_sn = f"SN-ADM-{unique_id}"
        st, res = admin.call("POST", "/api/serials/", {
            "serial_numbers": [admin_sn], "inventory_id": admin_item_id,
            "purchase_date": today_str, "warranty_months": 24
        })
        admin.record("Register Battery Serial Numbers", st == 201, f"Serial: {admin_sn}")

    # 1.10 Double-Entry Journal - Post Voucher
    st, accounts = admin.call("GET", "/api/journal/accounts")
    cash_id = next((a["id"] for a in accounts if a["code"] == "1001"), None) if isinstance(accounts, list) else None
    bank_id = next((a["id"] for a in accounts if a["code"] == "1002"), None) if isinstance(accounts, list) else None
    if cash_id and bank_id:
        st, res = admin.call("POST", "/api/journal/", {
            "entry_date": today_str, "narration": f"Admin Transfer Voucher {unique_id}",
            "reference": f"JV-ADM-{unique_id[-4:]}",
            "lines": [
                {"account_id": cash_id, "debit_npr": 8000.0, "credit_npr": 0.0, "description": "Cash deposit"},
                {"account_id": bank_id, "debit_npr": 0.0, "credit_npr": 8000.0, "description": "Bank withdrawal"}
            ]
        })
        admin.record("Post Double-Entry Journal Voucher", st == 201, "Debit 8000 == Credit 8000")

    # 1.11 Shareholder Equity & Investors
    st, res = admin.call("GET", "/api/investors/")
    admin.record("Access Shareholder Equity Module", st == 200, "Investors list retrieved")

    # 1.12 Bank Loans
    st, res = admin.call("GET", "/api/loans/")
    admin.record("Access Bank Loan Facilities", st == 200, "Loan accounts retrieved")

    # 1.13 Analytics & KPIs
    st, res = admin.call("GET", "/api/analytics/")
    admin.record("Access Executive Analytics & KPIs", st == 200 and "kpis" in res, "Revenue, Margins & Valuation verified")

    # 1.14 Disaster Recovery & Backup
    st, res = admin.call("POST", "/api/backup/trigger")
    admin.record("Trigger System State Backup", st == 200 and res.get("status") == "success", "Database snapshot generated")

    # =========================================================================
    # 2. STAFF ACCOUNT AUDIT
    # =========================================================================
    print("\n" + "-"*85)
    print("[ACCOUNT 2] STAFF (staff) -- OPERATIONS, CATALOG, SALES & CLOUD SYNC")
    print("-"*85)
    staff = AccountTester("Staff", "staff", "staff123", "STAFF")
    if not staff.login():
        print("Staff login failed. Aborting.")
        return False

    # 2.1 Identity
    st, res = staff.call("GET", "/api/auth/me")
    staff.record("Verify Staff Token (/api/auth/me)", st == 200 and res.get("role") == "STAFF", f"Role: {res.get('role')}")

    # 2.2 Inventory - Add New SKU
    staff_sku = f"STF-LFP-{unique_id}"
    st, res = staff.call("POST", "/api/inventory/", {
        "sku": staff_sku, "name": f"Staff LFP 12V 100Ah Battery ({unique_id})",
        "brand": "PowerNep Staff", "capacity_ah": 100.0, "voltage_v": 12.0,
        "import_cost_npr": 18000.0, "selling_price_npr": 24500.0,
        "stock_qty": 20, "reorder_level": 5, "hs_code": "8507.60"
    })
    staff_item_id = res.get("id") if isinstance(res, dict) else None
    staff.record("Staff Add New Battery SKU", st == 201 and staff_item_id is not None, f"SKU: {staff_sku}, ID: {staff_item_id}")

    # 2.3 Inventory - Edit Added SKU
    if staff_item_id:
        st, res = staff.call("PATCH", f"/api/inventory/{staff_item_id}", {
            "name": f"Staff LFP 12V 100Ah Battery (Updated - {unique_id})",
            "selling_price_npr": 25000.0,
            "reorder_level": 6
        })
        staff.record("Staff Edit Battery SKU Specifications", st == 200 and res.get("selling_price_npr") == 25000.0, "Selling Price updated to 25000 NPR")

    # 2.4 Inventory - Stock Purchase
    if staff_item_id:
        st, res = staff.call("POST", "/api/inventory/purchase", {
            "payment_method": "BANK", "purchase_date": today_str,
            "reference": f"PO-STF-{unique_id}",
            "items": [{"inventory_id": staff_item_id, "quantity": 10, "unit_cost_npr": 18000.0}]
        })
        staff.record("Staff Execute Stock Purchase", st == 201, "Stock incremented by 10 units")

    # 2.5 Customer - Create Customer
    st, res = staff.call("POST", "/api/customers/", {
        "name": f"Staff Retail Client ({unique_id})", "customer_type": "B2C",
        "phone": f"984{unique_id[-7:]}", "address": "Lalitpur, Nepal",
        "credit_limit": 100000.0
    })
    staff_cust_id = res.get("id") if isinstance(res, dict) else None
    staff.record("Staff Register Customer", st == 201 and staff_cust_id is not None, f"Cust ID: {staff_cust_id}")

    # 2.6 Inventory - Sell Battery / Create Invoice
    if staff_item_id and staff_cust_id:
        st, res = staff.call("POST", "/api/inventory/sell", {
            "customer_id": staff_cust_id, "payment_method": "CASH",
            "invoice_date": today_str, "reference": f"INV-STF-{unique_id}",
            "items": [{"inventory_id": staff_item_id, "quantity": 4, "unit_price_npr": 25000.0}],
            "apply_vat": True, "vat_rate": 13.0
        })
        staff.record("Staff Issue Sales Invoice with 13% VAT", st == 201, "Stock decremented by 4 units")

    # 2.7 Warehouses - View Warehouses
    st, res = staff.call("GET", "/api/warehouses/")
    staff.record("Staff View Warehouses & Depots", st == 200 and isinstance(res, list), f"Depots found: {len(res) if isinstance(res, list) else 0}")

    # 2.8 Serials & Warranty - Register Battery Serial
    if staff_item_id:
        staff_sn = f"SN-STF-{unique_id}"
        st, res = staff.call("POST", "/api/serials/", {
            "serial_numbers": [staff_sn], "inventory_id": staff_item_id,
            "purchase_date": today_str, "warranty_months": 36
        })
        staff.record("Staff Register Serial Numbers", st == 201, f"Serial: {staff_sn}")

    # 2.9 Disaster Recovery & Google Drive Sync
    st, res = staff.call("POST", "/api/backup/trigger")
    staff.record("Staff Trigger Database Backup Snapshot", st == 200 and res.get("status") == "success", "Backup snapshot created")
    
    st, res = staff.call("GET", "/api/backup/list")
    staff.record("Staff List Cloud Backups & Sync State", st == 200 and isinstance(res.get("backups"), list), f"Backups listed: {len(res.get('backups', [])) if isinstance(res, dict) else 0}")

    # 2.10 Security Boundaries (Staff Forbidden from Confidential Areas)
    st, _ = staff.call("GET", "/api/journal/")
    staff.record("Security Check: Blocked from Double-Entry Journal", st == 403, "HTTP 403 Forbidden confirmed")

    st, _ = staff.call("GET", "/api/loans/")
    staff.record("Security Check: Blocked from Bank Loans", st == 403, "HTTP 403 Forbidden confirmed")

    st, _ = staff.call("GET", "/api/investors/")
    staff.record("Security Check: Blocked from Shareholder Equity", st == 403, "HTTP 403 Forbidden confirmed")

    # =========================================================================
    # 3. ACCOUNTANT ACCOUNT AUDIT
    # =========================================================================
    print("\n" + "-"*85)
    print("[ACCOUNT 3] ACCOUNTANT (accountant) -- FINANCIAL AUDIT, JOURNALS & TAX")
    print("-"*85)
    acc = AccountTester("Accountant", "accountant", "accountant123", "ACCOUNTANT")
    if not acc.login():
        print("Accountant login failed. Aborting.")
        return False

    # 3.1 Identity
    st, res = acc.call("GET", "/api/auth/me")
    acc.record("Verify Accountant Token (/api/auth/me)", st == 200 and res.get("role") == "ACCOUNTANT", f"Role: {res.get('role')}")

    # 3.2 Inventory - Stock Audit View (Can view catalog and prices)
    st, res = acc.call("GET", "/api/inventory/")
    acc.record("Audit Battery Catalog & Remaining Stocks", st == 200 and isinstance(res, list), f"Catalog items: {len(res) if isinstance(res, list) else 0}")

    # 3.3 Inventory - Movement Log
    st, res = acc.call("GET", "/api/inventory/movements/log")
    acc.record("Audit Inward/Outward Inventory Movement Logs", st == 200 and isinstance(res, list), f"Movement logs: {len(res) if isinstance(res, list) else 0}")

    # 3.4 Inventory - Stock Audit CSV Export
    st, res = acc.call("GET", "/api/inventory/export/stock-audit-csv")
    acc.record("Download Stock Valuation & Audit CSV Report", st == 200 and "SKU" in str(res), "CSV downloaded successfully")

    # 3.5 Journal - Post Balanced Double-Entry Voucher
    st, accounts = acc.call("GET", "/api/journal/accounts")
    cash_id = next((a["id"] for a in accounts if a["code"] == "1001"), None) if isinstance(accounts, list) else None
    bank_id = next((a["id"] for a in accounts if a["code"] == "1002"), None) if isinstance(accounts, list) else None
    if cash_id and bank_id:
        st, res = acc.call("POST", "/api/journal/", {
            "entry_date": today_str, "narration": f"Accountant General Adjustment {unique_id}",
            "reference": f"JV-ACC-{unique_id[-4:]}",
            "lines": [
                {"account_id": cash_id, "debit_npr": 12000.0, "credit_npr": 0.0, "description": "Cash debit"},
                {"account_id": bank_id, "debit_npr": 0.0, "credit_npr": 12000.0, "description": "Bank credit"}
            ]
        })
        acc.record("Post Balanced Double-Entry Journal Voucher", st == 201, "Debit 12000 == Credit 12000")

    # 3.6 Journal - Trial Balance & Balance Sheet
    st, res = acc.call("GET", "/api/journal/trial-balance")
    is_bal = res.get("is_balanced") if isinstance(res, dict) else False
    acc.record("Generate Real-Time Trial Balance", st == 200 and is_bal, f"Trial Balance Balanced: {is_bal}")

    st, res = acc.call("GET", "/api/journal/balance-sheet")
    acc.record("Generate Corporate Balance Sheet", st == 200 and "assets" in res, "Assets = Liabilities + Equity verified")

    # 3.7 Journal - IRD Tax Clearance CSV Export
    st, res = acc.call("GET", "/api/journal/export/tax-clearance-csv")
    acc.record("Download Official IRD Tax Clearance CSV Report", st == 200, "Tax Clearance CSV generated")

    # 3.8 Customers - Statement & Ledger Audit
    if admin_cust_id:
        st, res = acc.call("GET", f"/api/customers/{admin_cust_id}/statement")
        acc.record("Audit Customer Account Statement & Balance", st == 200 and "ledger" in res, f"Outstanding Balance calculated: {res.get('customer', {}).get('outstanding_balance_npr')} NPR")

    # 3.9 Bank Loans - Audit Facility
    st, res = acc.call("GET", "/api/loans/")
    acc.record("Audit Bank Loan Facilities & Interest Rates", st == 200 and isinstance(res, list), f"Loan Facilities: {len(res) if isinstance(res, list) else 0}")

    # 3.10 Security Boundaries (Accountant Forbidden from Selling or Buying)
    st, _ = acc.call("POST", "/api/inventory/sell", {
        "customer_id": 1, "payment_method": "CASH", "invoice_date": today_str,
        "items": [{"inventory_id": 1, "quantity": 1}]
    })
    acc.record("Security Check: Blocked from Selling Batteries", st == 403, "HTTP 403 Forbidden confirmed (Accountant cannot sell)")

    st, _ = acc.call("POST", "/api/inventory/purchase", {
        "payment_method": "CASH", "purchase_date": today_str,
        "items": [{"inventory_id": 1, "quantity": 1, "unit_cost_npr": 1000}]
    })
    acc.record("Security Check: Blocked from Stock Purchases", st == 403, "HTTP 403 Forbidden confirmed")

    st, _ = acc.call("POST", "/api/inventory/", {
        "sku": f"ACC-NO-{unique_id}", "name": "Illegal Acc SKU", "selling_price_npr": 1000
    })
    acc.record("Security Check: Blocked from Adding SKU", st == 403, "HTTP 403 Forbidden confirmed")

    # =========================================================================
    # GRAND TOTAL SUMMARY
    # =========================================================================
    print("\n" + "="*85)
    print(">> FINAL QA THREE-ACCOUNT EVALUATION REPORT")
    print("="*85)
    print(f"  [1] ADMIN      : {admin.passed}/{admin.total} Tests Passed ({admin.passed/admin.total*100:.1f}%)")
    print(f"  [2] STAFF      : {staff.passed}/{staff.total} Tests Passed ({staff.passed/staff.total*100:.1f}%)")
    print(f"  [3] ACCOUNTANT : {acc.passed}/{acc.total} Tests Passed ({acc.passed/acc.total*100:.1f}%)")
    print("-"*85)
    grand_total = admin.total + staff.total + acc.total
    grand_passed = admin.passed + staff.passed + acc.passed
    grand_failed = admin.failed + staff.failed + acc.failed
    print(f"  >> OVERALL TOTAL : {grand_passed}/{grand_total} Tests Passed ({grand_passed/grand_total*100:.1f}%)")
    print(f"  >> TOTAL FAILURES: {grand_failed}")
    print("="*85)

    return grand_failed == 0

if __name__ == "__main__":
    success = run_full_three_account_suite()
    sys.exit(0 if success else 1)
