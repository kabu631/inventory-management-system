<![CDATA[# ⚡ Battery ERP — Inventory Management System

> **Renew Gen Resources Nepal Pvt. Ltd.**
> A full-stack Enterprise Resource Planning (ERP) system purpose-built for lithium-ion battery trading, inventory management, and financial accounting — tailored for the Nepali market (NPR currency).

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
  - [Desktop App (Electron)](#desktop-app-electron)
- [API Endpoints](#api-endpoints)
- [Database Schema](#database-schema)
- [Backup & Recovery](#backup--recovery)
- [Screenshots](#screenshots)
- [License](#license)

---

## Overview

Battery ERP is a comprehensive inventory and supply chain management system designed for battery distributors and traders in Nepal. It covers the complete business workflow — from purchasing batteries from suppliers, tracking serial numbers and warranties, managing multi-warehouse stock, selling to customers (B2B & B2C), to maintaining full double-entry accounting journals with tax-ready CSV exports for IRD (Inland Revenue Department) compliance.

The system runs as a **desktop application** (Electron) with an embedded backend, or can be deployed as a standalone **web application** with separate frontend and backend services.

---

## Features

### 📊 Dashboard & Analytics
- **KPI Cards** — Total Revenue, Gross Profit, Inventory Value, Active Loans
- **Revenue Trend Charts** — Monthly sales performance visualization
- **Recent Transactions Feed** — Latest double-entry journal postings
- **ML-Powered Forecasting** — Linear regression revenue predictions for the next 3 months
- **Financial Privacy Lock** — PIN-protected toggle to blur/reveal sensitive financial data

### 📦 Inventory & Stock Management
- Full SKU-based battery inventory (brand, capacity Ah, voltage V)
- Import cost and selling price tracking (NPR)
- Real-time stock quantity with reorder level alerts
- Bulk stock operations (purchase, sell, adjust)

### 🏭 Multi-Warehouse Management
- Create and manage multiple warehouse/depot locations
- **Inter-warehouse stock transfers** with full audit trail
- Per-warehouse stock visibility
- Primary warehouse designation

### 🔋 Serial Number & Warranty Tracking
- Individual battery serial number registration
- Warranty period tracking per serial (configurable months)
- Warranty expiry date auto-calculation
- **Warranty Claims** — Register, track, and resolve (PENDING → REPLACED / REJECTED)
- Serial lifecycle: `IN_STOCK` → `SOLD` → `WARRANTY_CLAIM` → `SCRAPPED`

### 🚛 Supplier & Purchase Order Management
- Supplier/vendor directory with contact details and PAN/VAT numbers
- Purchase Order (PO) creation with multi-line items
- PO lifecycle: `DRAFT` → `SENT` → `RECEIVED` → `CANCELLED`
- Payment method tracking (Bank, Cash, Credit)

### 👥 Customer Management
- Customer database with B2B and B2C classification
- Credit limit management
- Customer-linked journal entries and transaction history

### 📒 Double-Entry Accounting (Journal)
- Full **Chart of Accounts** (Asset, Liability, Equity, Income, Expense)
- Double-entry journal entries with debit/credit balancing
- Transaction narration and reference tracking
- **Tax CSV Export** — IRD-compliant journal export for tax audits

### 🏦 Bank Loan Management
- Track multiple bank loans with principal and interest rates
- Loan repayment scheduling and recording
- Interest calculation (simple interest)
- Auto-linking repayments to journal entries
- Loan lifecycle management (active → closed)

### 💾 Backup & Recovery
- **Auto-backup every 30 minutes** to local storage and Google Drive
- **On-write backup** — database backed up on every write operation
- Single-file overwrite strategy (`erp_latest.db`)
- One-click database restore from any backup
- Google Drive sync (`G:\My Drive\BatteryERP_Backups\`)

### 🎨 UI/UX
- Modern dark/light theme with smooth transitions
- Glassmorphism sidebar with company branding
- Responsive grid layouts
- Micro-animations and hover effects
- Lucide React icon system

---

## Tech Stack

| Layer        | Technology                                                     |
| ------------ | -------------------------------------------------------------- |
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Recharts    |
| **Backend**  | FastAPI 0.111, Python 3.x, SQLAlchemy 2.0, Uvicorn            |
| **Database** | SQLite 3 (WAL mode, single-file)                              |
| **Desktop**  | Electron 31 (with embedded backend .exe via PyInstaller)       |
| **ML/AI**    | scikit-learn (Linear Regression), pandas (data processing)     |
| **Icons**    | Lucide React                                                   |

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Electron Shell                         │
│  ┌────────────────────┐    ┌──────────────────────────┐  │
│  │   Next.js Frontend │◄──►│   FastAPI Backend (.exe) │  │
│  │   (React 19 + TS)  │    │   SQLAlchemy + SQLite    │  │
│  │   Port: 3000       │    │   Port: 8000             │  │
│  └────────────────────┘    └──────────┬───────────────┘  │
│                                       │                   │
│                              ┌────────▼────────┐         │
│                              │   erp.db         │         │
│                              │   (SQLite WAL)   │         │
│                              └────────┬────────┘         │
│                                       │                   │
│                     ┌─────────────────┼──────────────┐   │
│                     ▼                                ▼   │
│              Local Backups              Google Drive      │
│           backups/erp_latest.db    G:\My Drive\...\.db   │
└──────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
erp/
├── backend/                     # FastAPI backend
│   ├── app/
│   │   ├── main.py              # FastAPI app, lifespan, CORS, router registration
│   │   ├── database.py          # SQLAlchemy engine, session, SQLite config
│   │   ├── models.py            # All ORM models (13 tables)
│   │   ├── seed.py              # Initial data seeding
│   │   ├── clear_db.py          # Database reset utility
│   │   ├── routers/
│   │   │   ├── inventory.py     # Inventory CRUD + stock operations
│   │   │   ├── customers.py     # Customer management
│   │   │   ├── suppliers.py     # Suppliers & Purchase Orders
│   │   │   ├── warehouses.py    # Warehouse & stock transfers
│   │   │   ├── serials.py       # Battery serial & warranty tracking
│   │   │   ├── journal.py       # Double-entry journal & tax export
│   │   │   ├── loans.py         # Bank loan management
│   │   │   ├── analytics.py     # KPIs, monthly trends, ML forecast
│   │   │   └── backup.py        # Backup & restore endpoints
│   │   └── services/
│   │       └── backup.py        # Backup engine (local + Google Drive)
│   ├── requirements.txt         # Python dependencies
│   ├── run.py                   # Uvicorn startup script
│   └── build_backend.py         # PyInstaller build script for .exe
│
├── frontend/                    # Next.js frontend
│   ├── app/
│   │   ├── layout.tsx           # Root layout with sidebar & theme
│   │   ├── page.tsx             # Dashboard (KPIs, charts, quick actions)
│   │   ├── globals.css          # Global styles & design tokens
│   │   ├── inventory/page.tsx   # Inventory management page
│   │   ├── warehouses/page.tsx  # Warehouse management page
│   │   ├── suppliers/page.tsx   # Supplier & PO page
│   │   ├── customers/page.tsx   # Customer management page
│   │   ├── journal/page.tsx     # Journal & tax export page
│   │   ├── loans/page.tsx       # Bank loan page
│   │   ├── analytics/page.tsx   # Analytics & forecasting page
│   │   ├── warranty/page.tsx    # Serial & warranty page
│   │   ├── invoice/page.tsx     # Invoice generation page
│   │   └── settings/page.tsx    # Data & backup settings
│   ├── components/
│   │   └── Sidebar.tsx          # Navigation sidebar
│   ├── contexts/
│   │   └── ThemeContext.tsx      # Dark/light theme context
│   └── package.json
│
├── desktop-app/                 # Electron desktop wrapper
│   ├── main.js                  # Electron main process
│   ├── package.json
│   └── resources/
│       └── backend.exe          # Bundled FastAPI backend
│
├── start-backend.bat            # Quick-start backend (Windows)
├── start-frontend.bat           # Quick-start frontend (Windows)
├── seed-database.bat            # Seed database with sample data
├── clear-database.bat           # Reset database
├── pyproject.toml               # Python project config
└── .gitignore
```

---

## Getting Started

### Prerequisites

- **Python 3.10+** — [Download](https://www.python.org/downloads/)
- **Node.js 18+** — [Download](https://nodejs.org/)
- **Git** — [Download](https://git-scm.com/)

### Backend Setup

```bash
# Clone the repository
git clone https://github.com/kabu631/inventory-management-system.git
cd inventory-management-system

# Create and activate a virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

# Install Python dependencies
pip install -r backend/requirements.txt

# Start the backend server
cd backend
python run.py
```

The API server will start at **http://localhost:8000**. Visit **http://localhost:8000/docs** for the interactive Swagger documentation.

### Frontend Setup

```bash
# Open a new terminal
cd frontend

# Install Node.js dependencies
npm install

# Start the development server
npm run dev
```

The frontend will be available at **http://localhost:3000**.

### Desktop App (Electron)

```bash
# Build the backend executable first (optional, for packaging)
cd backend
python build_backend.py

# Run the Electron app in dev mode
cd ../desktop-app
npm install
npm run dev
```

> **Note:** In dev mode, the Electron app connects to the Next.js dev server (`localhost:3000`) and expects the backend to be running separately on `localhost:8000`.

### Quick Start (Windows)

Use the provided batch files for convenience:

```bash
start-backend.bat      # Starts the FastAPI backend
start-frontend.bat     # Starts the Next.js frontend
seed-database.bat      # Seeds the database with sample data
clear-database.bat     # Resets the database
```

---

## API Endpoints

| Method   | Endpoint                     | Description                          |
| -------- | ---------------------------- | ------------------------------------ |
| `GET`    | `/api/health`                | Health check & service status        |
| **Inventory** |                         |                                      |
| `GET`    | `/api/inventory/`            | List all inventory items             |
| `POST`   | `/api/inventory/`            | Create new inventory item            |
| `PUT`    | `/api/inventory/{id}`        | Update inventory item                |
| `DELETE` | `/api/inventory/{id}`        | Delete inventory item                |
| **Customers** |                         |                                      |
| `GET`    | `/api/customers/`            | List all customers                   |
| `POST`   | `/api/customers/`            | Create new customer                  |
| `PUT`    | `/api/customers/{id}`        | Update customer                      |
| `DELETE` | `/api/customers/{id}`        | Delete customer                      |
| **Suppliers** |                         |                                      |
| `GET`    | `/api/suppliers/`            | List suppliers & purchase orders     |
| `POST`   | `/api/suppliers/`            | Create supplier                      |
| `POST`   | `/api/suppliers/po`          | Create purchase order                |
| **Warehouses** |                        |                                      |
| `GET`    | `/api/warehouses/`           | List all warehouses                  |
| `POST`   | `/api/warehouses/`           | Create warehouse                     |
| `POST`   | `/api/warehouses/transfer`   | Inter-warehouse stock transfer       |
| **Serials & Warranty** |                |                                      |
| `GET`    | `/api/serials/`              | List battery serials                 |
| `POST`   | `/api/serials/`              | Register new serial                  |
| `POST`   | `/api/serials/warranty-claim`| File warranty claim                  |
| **Journal** |                           |                                      |
| `GET`    | `/api/journal/`              | List journal entries                 |
| `POST`   | `/api/journal/`              | Create journal entry                 |
| `GET`    | `/api/journal/export/csv`    | Export journal as CSV (tax)          |
| **Loans** |                             |                                      |
| `GET`    | `/api/loans/`                | List bank loans                      |
| `POST`   | `/api/loans/`                | Create bank loan                     |
| `POST`   | `/api/loans/{id}/repay`      | Record loan repayment                |
| **Analytics** |                         |                                      |
| `GET`    | `/api/analytics/`            | KPIs & monthly breakdown            |
| `GET`    | `/api/analytics/forecast`    | ML revenue forecast (3 months)       |
| **Backup** |                            |                                      |
| `GET`    | `/api/backup/`               | List available backups               |
| `POST`   | `/api/backup/trigger`        | Trigger manual backup                |
| `POST`   | `/api/backup/restore`        | Restore from backup file             |

---

## Database Schema

The system uses **SQLite 3** with **WAL (Write-Ahead Logging)** mode for optimal performance. The database contains **13 tables**:

| Table                  | Description                                    |
| ---------------------- | ---------------------------------------------- |
| `warehouses`           | Warehouse/depot locations                      |
| `suppliers`            | Supplier/vendor directory                      |
| `customers`            | Customer database (B2B/B2C)                    |
| `inventory`            | Battery SKU catalog with pricing               |
| `battery_serials`      | Individual serial number tracking              |
| `warranty_claims`      | Warranty claim records                         |
| `stock_transfers`      | Inter-warehouse transfer log                   |
| `purchase_orders`      | Purchase order headers                         |
| `purchase_order_items` | Purchase order line items                      |
| `account_heads`        | Chart of accounts (5 types)                    |
| `journal_entries`      | Double-entry journal headers                   |
| `journal_lines`        | Journal debit/credit lines                     |
| `bank_loans`           | Bank loan records                              |
| `loan_repayments`      | Loan repayment transactions                    |

---

## Backup & Recovery

The system implements a **multi-destination backup strategy**:

1. **Automatic Backups** — Every 30 minutes via background task
2. **On-Write Backups** — Triggered on every database write operation
3. **Manual Backups** — Via the Settings page or API endpoint
4. **Google Drive Sync** — Auto-syncs to `G:\My Drive\BatteryERP_Backups\` (if Google Drive desktop is installed)

**Restore:** Navigate to **Settings → Data & Backup** or call `POST /api/backup/restore` with the backup file path.

---

## License

This project is proprietary software developed for **Renew Gen Resources Nepal Pvt. Ltd.**

---

<p align="center">
  Built with ❤️ for the Nepali battery trading industry
</p>
]]>
