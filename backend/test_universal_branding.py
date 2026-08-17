import json
import urllib.request
from app.database import SessionLocal
from app.models import User, CompanySetting, Inventory
from app.services.auth import create_access_token, hash_password

BASE_URL = "http://127.0.0.1:8000"

def make_request(method: str, path: str, data: dict = None, headers: dict = None):
    url = f"{BASE_URL}{path}"
    req_headers = {"Content-Type": "application/json"}
    if headers:
        req_headers.update(headers)

    body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=body, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode("utf-8")
            status = response.status
            try:
                parsed = json.loads(res_body)
            except Exception:
                parsed = res_body
            return status, parsed
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            parsed = json.loads(err_body)
        except Exception:
            parsed = err_body
        return e.code, parsed

def run_tests():
    db = SessionLocal()

    print("[TEST 1] Ensuring admin user exists and generating token...")
    admin = db.query(User).filter(User.username == "admin").first()
    if not admin:
        admin = User(
            username="admin",
            password_hash=hash_password("admin123"),
            salt="randomsalt123",
            full_name="Administrator",
            role="ADMIN",
            staff_id="ADM-001",
            is_active=True
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)

    token = create_access_token(admin.id, admin.username, admin.role)
    headers = {"Authorization": f"Bearer {token}"}

    print("[TEST 2] Testing GET /api/company/profile...")
    status, profile = make_request("GET", "/api/company/profile")
    assert status == 200, f"GET /api/company/profile failed with status {status}: {profile}"
    assert "business_type" in profile, "Missing business_type in profile"
    assert "product_term" in profile, "Missing product_term in profile"
    assert "product_term_plural" in profile, "Missing product_term_plural in profile"
    print(f"-> Profile: company_name='{profile['company_name']}', business_type='{profile['business_type']}', product_term='{profile['product_term']}', product_term_plural='{profile['product_term_plural']}'")

    print("[TEST 3] Testing PUT /api/company/profile with custom free-text branding...")
    custom_branding = {
        "company_name": "Apex Electronics & Hardware Pvt. Ltd.",
        "tagline": "Premium Electronics, Computer Hardware & Industrial Tools",
        "business_type": "Consumer Electronics & Industrial Hardware Distribution",
        "product_term": "Equipment",
        "product_term_plural": "Equipments",
        "pan_vat_no": "601998877",
        "phone": "+977 01-4455667",
        "email": "contact@apexelectronics.np",
        "address": "New Road, Kathmandu, Nepal",
        "website": "www.apexelectronics.np",
        "terms_and_conditions": "1. 1-year replacement warranty on all electronics equipment.",
        "invoice_footer": "Apex Electronics - Thank you for choosing us!",
        "currency_symbol": "NPR",
    }
    status, res = make_request("PUT", "/api/company/profile", data=custom_branding, headers=headers)
    assert status == 200, f"PUT /api/company/profile failed with status {status}: {res}"
    updated_company = res["company"]
    assert updated_company["business_type"] == custom_branding["business_type"]
    assert updated_company["product_term"] == "Equipment"
    assert updated_company["product_term_plural"] == "Equipments"
    print("-> PUT /api/company/profile successful! Free-text business_type & product_term saved.")

    print("[TEST 4] Testing universal product creation POST /api/inventory/...")
    new_item_payload = {
        "sku": "ROUTER-WIFI6-AX3000",
        "name": "Gigabit Dual-Band Wi-Fi 6 Mesh Router",
        "category": "Networking & Telecom",
        "brand": "TP-Link",
        "unit_of_measure": "pcs",
        "specifications": "AX3000, 4x Gigabit LAN, OFDMA, 160MHz Channel",
        "import_cost_npr": 4500.0,
        "selling_price_npr": 7200.0,
        "stock_qty": 25,
        "reorder_level": 5,
        "hs_code": "8517.62"
    }
    # Clean up existing test item if exists
    existing = db.query(Inventory).filter(Inventory.sku == new_item_payload["sku"]).first()
    if existing:
        db.delete(existing)
        db.commit()

    status, created_item = make_request("POST", "/api/inventory/", data=new_item_payload, headers=headers)
    assert status in (200, 201), f"POST /api/inventory/ failed with status {status}: {created_item}"
    assert created_item["sku"] == new_item_payload["sku"]
    print(f"-> Created universal product: {created_item['name']}")

    print("[TEST 5] Testing GET /api/inventory/ lists universal product fields...")
    status, all_items = make_request("GET", "/api/inventory/", headers=headers)
    assert status == 200, f"GET /api/inventory/ failed with status {status}: {all_items}"
    found = next((i for i in all_items if i["sku"] == "ROUTER-WIFI6-AX3000"), None)
    assert found is not None, "Created universal item not found in inventory list"
    assert found["category"] == "Networking & Telecom"
    assert found["unit_of_measure"] == "pcs"
    assert "AX3000" in found["specifications"]
    print("-> GET /api/inventory/ verified with universal fields (category, unit_of_measure, specifications).")

    print("[TEST 6] Testing GET /api/inventory/export/stock-audit-csv for dynamic branding...")
    status, csv_text = make_request("GET", "/api/inventory/export/stock-audit-csv", headers=headers)
    assert status == 200, f"Export CSV failed with status {status}: {csv_text}"
    assert "EQUIPMENTS STOCK AUDIT" in csv_text or "EQUIPMENTS" in csv_text, "Dynamic plural term not in CSV header"
    assert "APEX ELECTRONICS" in csv_text, "Dynamic company name not in CSV header"
    assert "Networking & Telecom" in csv_text, "Universal category not in CSV rows"
    print("-> Stock Audit CSV correctly contains custom company name, 'EQUIPMENTS', and universal product columns!")

    print("\n[SUCCESS] ALL 6 UNIVERSAL PRODUCT & BRANDING TESTS PASSED PERFECTLY!")

if __name__ == "__main__":
    run_tests()
