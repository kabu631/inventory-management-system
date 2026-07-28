<div align="center">

# ⚡ ONIN Infosys ERP — Inventory Management System

### ONIN Infosys Pvt. Ltd. (https://onin.com.np/)

A full-stack ERP system for Laptops, PC Components, and Accessories trading, inventory management, and financial accounting.

[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Electron](https://img.shields.io/badge/Electron-31-47848F?style=for-the-badge&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![SQLite](https://img.shields.io/badge/SQLite-3-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

[![License](https://img.shields.io/badge/License-Proprietary-red?style=flat-square)](#)
[![Platform](https://img.shields.io/badge/Platform-Windows-0078D6?style=flat-square&logo=windows&logoColor=white)](#)
[![Currency](https://img.shields.io/badge/Currency-NPR_🇳🇵-blue?style=flat-square)](#)

---

</div>

## 🎯 About

**ONIN Infosys ERP** is a comprehensive enterprise resource planning system designed specifically for **ONIN Infosys Pvt. Ltd.** (Pako, New Road, Kathmandu, Nepal), a leading retailer & distributor of laptops, PC components, and IT accessories in Nepal. It covers the **entire business workflow** — from purchasing hardware from authorized suppliers, tracking device serial numbers and warranties, managing multi-warehouse stock, selling to retail/B2B customers, to maintaining full **double-entry accounting** with tax-ready exports for **IRD compliance**.

> 💡 Runs as a **desktop application** (Electron) with an embedded backend, or as a standalone **web application** with separate frontend and backend services.

---

## ✨ Features

<table>
<tr>
<td width="50%" valign="top">

### 📊 Dashboard & Analytics
- Real-time KPI cards (Revenue, Profit, Inventory Value, Loans)
- Monthly revenue trend charts
- ML-powered revenue forecasting (scikit-learn)
- PIN-protected financial privacy lock

### 📦 Inventory Management
- SKU-based laptop, PC component & accessory catalog (Apple, Dell, HP, ASUS, Lenovo, Intel, NVIDIA, Samsung, Corsair, Logitech, Razer)
- Import cost & selling price tracking (NPR)
- Real-time stock with reorder level alerts
- Bulk stock operations

### 🏭 Multi-Warehouse
- Multiple warehouse/depot locations (Pako New Road Store, Central Hub)
- Inter-warehouse stock transfers
- Per-warehouse stock visibility
- Full transfer audit trail

### 💻 Device Serial & Warranty Tracking
- Individual laptop & hardware serial registration
- Auto warranty expiry calculation
- Warranty claim lifecycle management
- Serial status tracking (IN_STOCK → SOLD → CLAIM → SCRAPPED)

</td>
<td width="50%" valign="top">

### 🚛 Suppliers & Purchase Orders
- Supplier directory with PAN/VAT numbers
- Multi-line purchase order creation
- PO lifecycle (DRAFT → SENT → RECEIVED → CANCELLED)
- Payment method tracking

### 📒 Double-Entry Accounting
- Full Chart of Accounts (5 account types)
- Journal entries with debit/credit balancing
- Transaction narration & references
- **Tax CSV export** for IRD audit compliance

### 🏦 Bank Loan Management
- Multi-loan tracking with interest rates
- Repayment scheduling & recording
- Auto-linked journal entries
- Loan lifecycle (active → closed)

### 💾 Auto Backup & Recovery
- **30-minute auto-backup** (background task)
- On-write backup on every DB mutation
- Google Drive sync (G:\My Drive)
- One-click database restore

</td>
</tr>
</table>

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      Electron Shell                          │
│                                                              │
│   ┌─────────────────────┐      ┌──────────────────────────┐ │
│   │  Next.js Frontend   │◄────►│  FastAPI Backend (.exe)   │ │
│   │  React 19 + TS      │      │  SQLAlchemy + SQLite      │ │
│   │  Port 3000          │      │  Port 8000                │ │
│   └─────────────────────┘      └────────────┬─────────────┘ │
│                                              │               │
│                                    ┌─────────▼──────────┐   │
│                                    │     erp.db          │   │
│                                    │   (SQLite + WAL)    │   │
│                                    └─────────┬──────────┘   │
│                                              │               │
│                              ┌───────────────┼───────────┐  │
│                              ▼                           ▼  │
│                       Local Backups            Google Drive  │
│                    erp_latest.db         G:\My Drive\...     │
└──────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
📦 inventory-management-system
├── 🐍 backend/                     # FastAPI REST API
│   ├── app/
│   │   ├── main.py                 # App entry, CORS, lifespan
│   │   ├── database.py             # SQLAlchemy engine & session
│   │   ├── models.py               # 13 ORM models
│   │   ├── seed.py                 # Sample data seeder
│   │   ├── routers/                # API route handlers
│   │   │   ├── inventory.py        #   └─ Inventory CRUD
│   │   │   ├── customers.py        #   └─ Customer mgmt
│   │   │   ├── suppliers.py        #   └─ Suppliers & POs
│   │   │   ├── warehouses.py       #   └─ Warehouses & transfers
│   │   │   ├── serials.py          #   └─ Serials & warranty
│   │   │   ├── journal.py          #   └─ Accounting journal
│   │   │   ├── loans.py            #   └─ Bank loans
│   │   │   ├── analytics.py        #   └─ KPIs & ML forecast
│   │   │   └── backup.py           #   └─ Backup & restore
│   │   └── services/
│   │       └── backup.py           # Backup engine
│   ├── requirements.txt
│   └── run.py
│
├── ⚛️  frontend/                    # Next.js 16 + React 19
│   ├── app/
│   │   ├── layout.tsx              # Root layout + sidebar
│   │   ├── page.tsx                # Dashboard
│   │   ├── globals.css             # Design tokens & styles
│   │   ├── inventory/page.tsx
│   │   ├── warehouses/page.tsx
│   │   ├── suppliers/page.tsx
│   │   ├── customers/page.tsx
│   │   ├── journal/page.tsx
│   │   ├── loans/page.tsx
│   │   ├── analytics/page.tsx
│   │   ├── warranty/page.tsx
│   │   ├── invoice/page.tsx
│   │   └── settings/page.tsx
│   ├── components/Sidebar.tsx
│   └── contexts/ThemeContext.tsx
│
├── 🖥️  desktop-app/                # Electron wrapper
│   ├── main.js
│   └── package.json
│
├── start-backend.bat               # Quick launchers (Windows)
├── start-frontend.bat
├── seed-database.bat
└── clear-database.bat
```

---

## 🚀 Getting Started

### Prerequisites

| Requirement | Version |
|---|---|
| ![Python](https://img.shields.io/badge/-Python-3776AB?style=flat-square&logo=python&logoColor=white) | 3.10+ |
| ![Node.js](https://img.shields.io/badge/-Node.js-339933?style=flat-square&logo=node.js&logoColor=white) | 18+ |
| ![Git](https://img.shields.io/badge/-Git-F05032?style=flat-square&logo=git&logoColor=white) | Latest |

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/kabu631/inventory-management-system.git
cd inventory-management-system
```

### 2️⃣ Backend Setup

```bash
# Create virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux

# Install dependencies
pip install -r backend/requirements.txt

# Start the API server
cd backend
python run.py
```

> 🟢 API running at **http://localhost:8000** — Swagger docs at **http://localhost:8000/docs**

### 3️⃣ Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

> 🟢 Frontend running at **http://localhost:3000**

### 4️⃣ Desktop App (Optional)

```bash
cd desktop-app
npm install
npm run dev           # Dev mode (connects to localhost)
```

### ⚡ Quick Start (Windows)

Double-click `run-app.bat` to launch both Backend and Frontend automatically, or run individual batch files:

```
run-app.bat            → 1-Click Launcher (Starts both Backend & Frontend)
start-backend.bat      → Starts FastAPI server (http://127.0.0.1:8000)
start-frontend.bat     → Starts Next.js dev server (http://localhost:3000)
seed-database.bat      → Seeds sample hardware catalog & 12-month transaction data
clear-database.bat     → Resets database and initializes clean Admin & Staff accounts
```

#### 🔑 System Default Logins

| Role | Username | Password | Access Privileges |
|---|---|---|---|
| 👑 **Admin** | `onininfosys` | `P@shupat1nath` | Full access to all modules, financial accounting, bank loans, analytics, settings, and user management. |
| 🧑‍💼 **Staff** | `staff` | `staff123` | Operational access to Inventory, Invoices, Warranty/Serials, Warehouses, Purchase Orders, and Customers. |

---

## 🔌 API Reference

<details>
<summary><strong>📦 Inventory</strong></summary>

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/inventory/` | List all items |
| `POST` | `/api/inventory/` | Create item |
| `PUT` | `/api/inventory/{id}` | Update item |
| `DELETE` | `/api/inventory/{id}` | Delete item |

</details>

<details>
<summary><strong>👥 Customers</strong></summary>

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/customers/` | List customers |
| `POST` | `/api/customers/` | Create customer |
| `PUT` | `/api/customers/{id}` | Update customer |
| `DELETE` | `/api/customers/{id}` | Delete customer |

</details>

<details>
<summary><strong>🚛 Suppliers & PO</strong></summary>

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/suppliers/` | List suppliers & POs |
| `POST` | `/api/suppliers/` | Create supplier |
| `POST` | `/api/suppliers/po` | Create purchase order |

</details>

<details>
<summary><strong>🏭 Warehouses</strong></summary>

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/warehouses/` | List warehouses |
| `POST` | `/api/warehouses/` | Create warehouse |
| `POST` | `/api/warehouses/transfer` | Stock transfer |

</details>

<details>
<summary><strong>🔋 Serials & Warranty</strong></summary>

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/serials/` | List serials |
| `POST` | `/api/serials/` | Register serial |
| `POST` | `/api/serials/warranty-claim` | File warranty claim |

</details>

<details>
<summary><strong>📒 Journal</strong></summary>

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/journal/` | List entries |
| `POST` | `/api/journal/` | Create entry |
| `GET` | `/api/journal/export/csv` | Export CSV (tax) |

</details>

<details>
<summary><strong>🏦 Loans</strong></summary>

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/loans/` | List loans |
| `POST` | `/api/loans/` | Create loan |
| `POST` | `/api/loans/{id}/repay` | Record repayment |

</details>

<details>
<summary><strong>📊 Analytics</strong></summary>

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/analytics/` | KPIs & monthly data |
| `GET` | `/api/analytics/forecast` | ML revenue forecast |

</details>

<details>
<summary><strong>💾 Backup</strong></summary>

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/backup/` | List backups |
| `POST` | `/api/backup/trigger` | Manual backup |
| `POST` | `/api/backup/restore` | Restore backup |

</details>

---

## 🗄️ Database

**SQLite 3** with **WAL mode** — 14 tables:

| Table | Purpose |
|---|---|
| `warehouses` | Warehouse locations |
| `suppliers` | Vendor directory |
| `customers` | Customer database (B2B/B2C) |
| `inventory` | Laptop, PC component & accessory catalog |
| `battery_serials` | Serial number tracking |
| `warranty_claims` | Warranty claim records |
| `stock_transfers` | Inter-warehouse transfers |
| `purchase_orders` | PO headers |
| `purchase_order_items` | PO line items |
| `account_heads` | Chart of accounts |
| `journal_entries` | Journal headers |
| `journal_lines` | Debit/credit lines |
| `bank_loans` | Loan records |
| `loan_repayments` | Repayment transactions |

---

## 🛡️ Backup Strategy

| Type | Frequency | Destination |
|---|---|---|
| ⏰ Scheduled | Every 30 minutes | Local + Google Drive |
| ✍️ On-write | Every DB mutation | Local + Google Drive |
| 🖱️ Manual | On demand | Local + Google Drive |

> Backup location: `G:\My Drive\ONIN_ERP_Backups\erp_latest.db`

---

<div align="center">

## 🛠️ Built With

[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Electron](https://img.shields.io/badge/Electron-47848F?style=for-the-badge&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![scikit--learn](https://img.shields.io/badge/scikit--learn-F7931E?style=for-the-badge&logo=scikit-learn&logoColor=white)](https://scikit-learn.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

---

**ONIN Infosys Pvt. Ltd.** © 2026

Built with ❤️ for ONIN Infosys (https://onin.com.np/) — Pako, New Road, Kathmandu

</div>
