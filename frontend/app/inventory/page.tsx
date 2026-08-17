"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { api, formatNPR } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { AlertTriangle, Plus, Search, TrendingUp, Package, ShoppingBag, ArrowDownLeft, X, CheckCircle2, AlertCircle, Lock, Unlock, Eye, EyeOff, Pencil } from "lucide-react";

const INVENTORY_PIN = process.env.NEXT_PUBLIC_DASHBOARD_PIN ?? "1234";

interface Item {
  id: number;
  sku: string;
  name: string;
  category?: string;
  brand?: string;
  unit_of_measure?: string;
  specifications?: string;
  capacity_ah?: number;
  voltage_v?: number;
  import_cost_npr: number;
  selling_price_npr: number;
  stock_qty: number;
  reorder_level: number;
  hs_code?: string;
  inventory_value_npr: number;
  low_stock: boolean;
}

interface Customer {
  id: number; name: string; customer_type: string; phone: string;
}

interface BankLoan {
  id: number;
  bank_name: string;
  loan_account_no: string;
  principal_npr: number;
  purpose: string;
  is_closed: boolean;
}

interface InvestorRecord {
  id: number;
  name: string;
  total_invested_npr?: number;
  invested_amount_npr?: number;
}

export default function InventoryPage() {
  const { user } = useAuth();
  const { company } = useCompany();
  const prodTerm = company?.product_term || "Product";
  const prodTermPlural = company?.product_term_plural || "Products";

  const isAdmin = user?.role === "ADMIN";
  const isAccountant = user?.role === "ACCOUNTANT";
  const isStaff = user?.role === "STAFF";
  const canSell = isAdmin || isStaff; // Accountant cannot sell
  const canPurchase = isAdmin || isStaff; // Staff can purchase stock
  const canAddSku = isAdmin || isStaff; // Staff can add new SKU

  // Privacy lock state
  const [unlocked, setUnlocked] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [showPin, setShowPin] = useState(false);
  const pinRef = useRef<HTMLInputElement>(null);

  // Auto-focus pin input when modal opens
  useEffect(() => {
    if (showPinModal) {
      setTimeout(() => pinRef.current?.focus(), 80);
    }
  }, [showPinModal]);

  function openLockModal() {
    if (unlocked) {
      setUnlocked(false);
    } else {
      setPin("");
      setPinError("");
      setShowPin(false);
      setShowPinModal(true);
    }
  }

  function handlePinSubmit() {
    if (pin === INVENTORY_PIN) {
      setUnlocked(true);
      setShowPinModal(false);
      setPin("");
      setPinError("");
    } else {
      setPinError("Incorrect password. Try again.");
      setPin("");
      pinRef.current?.focus();
    }
  }

  const mask = (val: string) => (unlocked ? val : "••••••");
  const blurStyle = {
    filter: unlocked ? "none" : "blur(6px)",
    userSelect: (unlocked ? "auto" : "none") as React.CSSProperties["userSelect"],
    transition: "filter 0.3s ease",
  };

  const [items, setItems] = useState<Item[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loans, setLoans] = useState<BankLoan[]>([]);
  const [investors, setInvestors] = useState<InvestorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [msg, setMsg] = useState({ text: "", type: "" });

  // Purchase funding source states
  const [fundingSource, setFundingSource] = useState<string>("INVESTOR");
  const [selectedLoanId, setSelectedLoanId] = useState<number | null>(null);

  // Add SKU form
  const [form, setForm] = useState({
    sku: "", name: "", category: "", brand: "", unit_of_measure: "pcs", specifications: "",
    capacity_ah: "", voltage_v: "",
    import_cost_npr: "", selling_price_npr: "", stock_qty: "", reorder_level: "5", hs_code: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Edit SKU form state
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editForm, setEditForm] = useState({
    name: "", category: "", brand: "", unit_of_measure: "pcs", specifications: "",
    capacity_ah: "", voltage_v: "",
    import_cost_npr: "", selling_price_npr: "", stock_qty: "", reorder_level: "5", hs_code: "",
  });
  const [editError, setEditError] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  function handleOpenEditModal(item: Item) {
    setEditingItem(item);
    setEditForm({
      name: item.name,
      category: item.category || "",
      brand: item.brand || "",
      unit_of_measure: item.unit_of_measure || "pcs",
      specifications: item.specifications || "",
      capacity_ah: String(item.capacity_ah ?? ""),
      voltage_v: String(item.voltage_v ?? ""),
      import_cost_npr: String(item.import_cost_npr ?? ""),
      selling_price_npr: String(item.selling_price_npr ?? ""),
      stock_qty: String(item.stock_qty ?? 0),
      reorder_level: String(item.reorder_level ?? 5),
      hs_code: item.hs_code || "",
    });
    setEditError("");
  }

  async function handleSaveEditSku() {
    if (!editingItem) return;
    if (!editForm.name.trim()) {
      setEditError(`${prodTerm} Name is required`);
      return;
    }
    setEditSubmitting(true);
    setEditError("");
    try {
      await api.patch(`/api/inventory/${editingItem.id}`, {
        name: editForm.name.trim(),
        category: editForm.category.trim() || null,
        brand: editForm.brand.trim() || null,
        unit_of_measure: editForm.unit_of_measure.trim() || "pcs",
        specifications: editForm.specifications.trim() || null,
        capacity_ah: editForm.capacity_ah ? Number(editForm.capacity_ah) : null,
        voltage_v: editForm.voltage_v ? Number(editForm.voltage_v) : null,
        import_cost_npr: editForm.import_cost_npr ? Number(editForm.import_cost_npr) : undefined,
        selling_price_npr: editForm.selling_price_npr ? Number(editForm.selling_price_npr) : undefined,
        stock_qty: editForm.stock_qty ? Number(editForm.stock_qty) : undefined,
        reorder_level: editForm.reorder_level ? Number(editForm.reorder_level) : 5,
        hs_code: editForm.hs_code || null,
      });
      flashMsg(`SKU '${editingItem.sku}' updated successfully!`, "success");
      setEditingItem(null);
      load();
    } catch (e: unknown) {
      setEditError(e instanceof Error ? e.message : "Failed to update SKU");
    } finally {
      setEditSubmitting(false);
    }
  }

  // Sales Invoice form
  const [saleForm, setSaleForm] = useState({
    customer_id: 0,
    inventory_id: 0,
    quantity: 1,
    unit_price_npr: "",
    discount_pct: "0",
    payment_method: "CREDIT",
    invoice_date: new Date().toISOString().split("T")[0],
    paid_amount_npr: "",
    partial_payment_method: "BANK",
  });
  const [saleSubmitting, setSaleSubmitting] = useState(false);

  // Customer options & VAT state
  const [customerMode, setCustomerMode] = useState<"existing" | "new">("existing");
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    customer_type: "B2C",
    credit_limit: "0",
    pan_no: "",
  });
  const [applyVat, setApplyVat] = useState(false);

  // Purchase Stock form (Buying inventory using Bank Loan / Bank / Cash)
  const [purchaseForm, setPurchaseForm] = useState({
    inventory_id: 0,
    quantity: 10,
    unit_cost_npr: "",
    payment_method: "BANK",
    purchase_date: new Date().toISOString().split("T")[0],
  });
  const [purchaseSubmitting, setPurchaseSubmitting] = useState(false);

  // Inventory Movements Modal State
  const [showMovementsModal, setShowMovementsModal] = useState(false);
  const [movements, setMovements] = useState<any[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get<Item[]>("/api/inventory/"),
      api.get<Customer[]>("/api/customers/"),
      api.get<BankLoan[]>("/api/loans/").catch(() => []),
      api.get<any>("/api/investors/").catch(() => ({ investors: [] })),
    ]).then(([i, c, l, invRes]) => {
      setItems(Array.isArray(i) ? i : []);
      setCustomers(Array.isArray(c) ? c : []);
      setLoans(Array.isArray(l) ? l : []);
      const invList = Array.isArray(invRes) ? invRes : (Array.isArray(invRes?.investors) ? invRes.investors : []);
      setInvestors(invList);
    }).catch(err => {
      console.warn("Failed to load inventory:", err);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const flashMsg = (text: string, type: "success" | "error") => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: "", type: "" }), 5000);
  };

  const safeItems     = Array.isArray(items) ? items : [];
  const totalValue    = safeItems.reduce((s, i) => s + (Number(i.inventory_value_npr) || 0), 0);
  const lowStockCount = safeItems.filter(i => i.low_stock).length;
  const totalUnits    = safeItems.reduce((s, i) => s + (Number(i.stock_qty) || 0), 0);

  const filtered = safeItems.filter(i =>
    i.sku?.toLowerCase().includes(search.toLowerCase()) ||
    i.name?.toLowerCase().includes(search.toLowerCase()) ||
    i.brand?.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddSku = async () => {
    setError(""); setSubmitting(true);
    try {
      await api.post("/api/inventory/", {
        sku: form.sku.trim(),
        name: form.name.trim(),
        category: form.category.trim() || null,
        brand: form.brand.trim() || null,
        unit_of_measure: form.unit_of_measure.trim() || "pcs",
        specifications: form.specifications.trim() || null,
        capacity_ah: form.capacity_ah ? Number(form.capacity_ah) : null,
        voltage_v: form.voltage_v ? Number(form.voltage_v) : null,
        import_cost_npr: Number(form.import_cost_npr) || 0,
        selling_price_npr: Number(form.selling_price_npr) || 0,
        stock_qty: Number(form.stock_qty) || 0,
        reorder_level: Number(form.reorder_level) || 5,
        hs_code: form.hs_code.trim() || null,
      });
      setShowForm(false);
      setForm({ sku:"", name:"", category:"", brand:"", unit_of_measure:"pcs", specifications:"", capacity_ah:"", voltage_v:"", import_cost_npr:"", selling_price_npr:"", stock_qty:"", reorder_level:"5", hs_code:"" });
      flashMsg(`New ${prodTerm} SKU added successfully!`, "success");
      load();
    } catch(e: unknown) { setError(e instanceof Error ? e.message : "Failed to add item"); }
    finally { setSubmitting(false); }
  };

  const handleOpenSaleModal = (skuId?: number) => {
    const defaultSku = skuId ? items.find(i => i.id === skuId) : (items[0] || null);
    setSaleForm({
      customer_id: customers[0]?.id || 0,
      inventory_id: defaultSku?.id || 0,
      quantity: 1,
      unit_price_npr: defaultSku ? String(defaultSku.selling_price_npr) : "",
      discount_pct: "0",
      payment_method: "CREDIT",
      invoice_date: new Date().toISOString().split("T")[0],
      paid_amount_npr: "",
      partial_payment_method: "BANK",
    });
    setCustomerMode("existing");
    setNewCustomer({ name: "", phone: "", email: "", address: "", customer_type: "B2C", credit_limit: "0", pan_no: "" });
    setApplyVat(false);
    setShowSaleModal(true);
  };

  const handleOpenPurchaseModal = (skuId?: number) => {
    const defaultSku = skuId ? items.find(i => i.id === skuId) : (items[0] || null);
    const activeLoan = loans.find(l => !l.is_closed);
    setPurchaseForm({
      inventory_id: defaultSku?.id || 0,
      quantity: 10,
      unit_cost_npr: defaultSku ? String(defaultSku.import_cost_npr) : "",
      payment_method: activeLoan ? "LOAN" : "INVESTOR",
      purchase_date: new Date().toISOString().split("T")[0],
    });
    if (activeLoan) {
      setFundingSource(`LOAN_${activeLoan.id}`);
      setSelectedLoanId(activeLoan.id);
    } else {
      setFundingSource("INVESTOR");
      setSelectedLoanId(null);
    }
    setShowPurchaseModal(true);
  };

  const handleSelectFundingSource = (val: string) => {
    setFundingSource(val);
    if (val.startsWith("LOAN_")) {
      setSelectedLoanId(Number(val.replace("LOAN_", "")));
    } else {
      setSelectedLoanId(null);
    }
  };

  const handleSelectSkuInSale = (skuId: number) => {
    const selected = items.find(i => i.id === skuId);
    setSaleForm(f => ({
      ...f,
      inventory_id: skuId,
      unit_price_npr: selected ? String(selected.selling_price_npr) : f.unit_price_npr,
    }));
  };

  const handleSelectSkuInPurchase = (skuId: number) => {
    const selected = items.find(i => i.id === skuId);
    setPurchaseForm(f => ({
      ...f,
      inventory_id: skuId,
      unit_cost_npr: selected ? String(selected.import_cost_npr) : f.unit_cost_npr,
    }));
  };

  const handlePostSale = async () => {
    if (!saleForm.inventory_id) return alert("Please select a battery SKU.");
    if (saleForm.quantity <= 0) return alert("Quantity must be greater than 0.");

    setSaleSubmitting(true);
    try {
      let targetCustomerId = Number(saleForm.customer_id);

      if (customerMode === "new") {
        if (!newCustomer.name.trim()) {
          setSaleSubmitting(false);
          return alert("Please enter the name of the new customer.");
        }
        const createdCust = await api.post<Customer>("/api/customers/", {
          name: newCustomer.name.trim(),
          phone: newCustomer.phone.trim() || undefined,
          email: newCustomer.email.trim() || undefined,
          address: newCustomer.address.trim() || undefined,
          customer_type: newCustomer.customer_type,
          credit_limit: Number(newCustomer.credit_limit || 0),
          pan_no: newCustomer.pan_no.trim() || undefined,
        });
        targetCustomerId = createdCust.id;
      } else {
        if (!targetCustomerId) {
          setSaleSubmitting(false);
          return alert("Please select an existing customer.");
        }
      }

      const selectedSku = items.find(i => i.id === Number(saleForm.inventory_id));
      const enteredPaid = saleForm.paid_amount_npr !== "" ? Number(saleForm.paid_amount_npr || 0) : undefined;
      const effectiveMethod = (enteredPaid !== undefined && enteredPaid > 0 && enteredPaid < totalSaleAmount) ? "PARTIAL" : saleForm.payment_method;

      const res = await api.post<{ status: string; message: string }>(
        "/api/inventory/sell",
        {
          customer_id: targetCustomerId,
          payment_method: effectiveMethod,
          invoice_date: saleForm.invoice_date,
          apply_vat: applyVat,
          paid_amount_npr: enteredPaid,
          partial_payment_method: saleForm.partial_payment_method,
          items: [
            {
              inventory_id: Number(saleForm.inventory_id),
              quantity: Number(saleForm.quantity),
              unit_price_npr: saleForm.unit_price_npr ? Number(saleForm.unit_price_npr) : selectedSku?.selling_price_npr,
              discount_pct: Number(saleForm.discount_pct || 0),
            },
          ],
        }
      );
      setShowSaleModal(false);
      flashMsg(res.message || "Sale processed, stock updated & auto-backed up to Google Drive!", "success");
      load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to process sale");
    } finally {
      setSaleSubmitting(false);
    }
  };

  const handlePostPurchase = async () => {
    if (!purchaseForm.inventory_id) return alert("Please select a battery SKU.");
    if (purchaseForm.quantity <= 0) return alert("Quantity must be greater than 0.");

    let payMethod = "INVESTOR";
    let loanId: number | null = null;
    if (fundingSource.startsWith("LOAN_")) {
      payMethod = "LOAN";
      loanId = Number(fundingSource.replace("LOAN_", ""));
    } else {
      payMethod = fundingSource;
    }

    setPurchaseSubmitting(true);
    try {
      const selectedSku = items.find(i => i.id === Number(purchaseForm.inventory_id));
      const res = await api.post<{ status: string; message: string }>(
        "/api/inventory/purchase",
        {
          payment_method: payMethod,
          purchase_date: purchaseForm.purchase_date,
          loan_id: loanId,
          items: [
            {
              inventory_id: Number(purchaseForm.inventory_id),
              quantity: Number(purchaseForm.quantity),
              unit_cost_npr: purchaseForm.unit_cost_npr ? Number(purchaseForm.unit_cost_npr) : selectedSku?.import_cost_npr,
            },
          ],
        }
      );
      setShowPurchaseModal(false);
      flashMsg(res.message || "Stock purchased & increased, journal posted & backed up!", "success");
      load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Failed to process purchase");
    } finally {
      setPurchaseSubmitting(false);
    }
  };

  const selectedSkuForSale = items.find(i => i.id === Number(saleForm.inventory_id));
  const calcSaleUnitPrice = saleForm.unit_price_npr ? Number(saleForm.unit_price_npr) : (selectedSkuForSale?.selling_price_npr || 0);
  const saleGrossSubtotal = calcSaleUnitPrice * Number(saleForm.quantity || 0);
  const saleDiscountPct = Number(saleForm.discount_pct || 0);
  const saleDiscountAmount = Math.round(saleGrossSubtotal * (saleDiscountPct / 100.0));
  const saleSubtotal = saleGrossSubtotal - saleDiscountAmount;
  const saleVatAmount = applyVat ? Math.round(saleSubtotal * 0.13) : 0;
  const totalSaleAmount = saleSubtotal + saleVatAmount;
  const unitPriceWithVat = applyVat ? Math.round(calcSaleUnitPrice * 1.13) : calcSaleUnitPrice;

  const selectedSkuForPurchase = items.find(i => i.id === Number(purchaseForm.inventory_id));
  const calcPurchaseUnitCost = purchaseForm.unit_cost_npr ? Number(purchaseForm.unit_cost_npr) : (selectedSkuForPurchase?.import_cost_npr || 0);
  const totalPurchaseAmount = calcPurchaseUnitCost * Number(purchaseForm.quantity || 0);

  const totalInvestorCapital = Array.isArray(investors)
    ? investors.reduce((sum, inv) => sum + (inv.total_invested_npr || inv.invested_amount_npr || 0), 0)
    : 0;
  const totalBankLoanCapital = Array.isArray(loans)
    ? loans.filter(l => !l.is_closed).reduce((sum, l) => sum + (l.principal_npr || 0), 0)
    : 0;

  const selectedLoan = selectedLoanId ? loans.find(l => l.id === selectedLoanId) : null;
  const selectedFundingAvailable = fundingSource === "INVESTOR"
    ? totalInvestorCapital
    : selectedLoan
    ? selectedLoan.principal_npr
    : fundingSource === "CASH"
    ? totalInvestorCapital
    : 999999999;

  const remainingSelectedLoan = selectedLoan
    ? selectedLoan.principal_npr - totalPurchaseAmount
    : totalBankLoanCapital;

  const remainingInvestorCapital = fundingSource === "INVESTOR"
    ? totalInvestorCapital - totalPurchaseAmount
    : totalInvestorCapital;

  const isInsufficientFunding = totalPurchaseAmount > selectedFundingAvailable && selectedFundingAvailable > 0;

  const margin = (item: Item) =>
    item.selling_price_npr > 0
      ? (((item.selling_price_npr - item.import_cost_npr) / item.selling_price_npr) * 100).toFixed(1)
      : "0.0";

  const FIELDS: [string, string, string, string][] = [
    ["sku", "SKU Code *", "e.g. SKU-1001", "text"],
    ["name", `${prodTerm} Name *`, `${prodTerm} Title or Description`, "text"],
    ["category", "Category", "e.g. Electronics, Tools, Apparel, Energy", "text"],
    ["brand", "Brand / Maker", "e.g. Brand Name", "text"],
    ["unit_of_measure", "Unit of Measure", "pcs, kg, box, sets, meters", "text"],
    ["specifications", "Specifications / Variant", "Size, Color, Model, Rating or Specs", "text"],
    ["hs_code", "HS Code (Tax Audit)", "e.g. 8507.60", "text"],
    ...(canAddSku ? [["import_cost_npr", "Import Cost NPR", "18000", "number"] as [string, string, string, string]] : []),
    ["selling_price_npr", "Selling Price NPR", "24000", "number"],
    ["stock_qty", "Initial Stock Qty", "0", "number"],
    ["reorder_level", "Reorder Level", "5", "number"],
  ];

  return (
    <div>
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="page-title">{isAdmin ? `${prodTermPlural} & Stock Management` : isAccountant ? "Stock Audit & Price Directory" : `${prodTerm} Catalog & Sales Portal`}</h1>
          <p className="text-muted" style={{ fontSize: "0.875rem", marginTop: "0.25rem" }}>
            {isAdmin ? `Manage ${prodTermPlural.toLowerCase()} catalog, purchase inventory, and track stock valuation.` : isAccountant ? `Audit remaining ${prodTermPlural.toLowerCase()} stock & customer selling prices` : `Check ${prodTerm.toLowerCase()} prices & issue customer invoices`}
          </p>
        </div>
        <div className="page-actions">
          {isAdmin && (
            <button
              id="inventory-privacy-toggle"
              onClick={openLockModal}
              title={unlocked ? "Click to lock financial costs & margins" : "Click to reveal import costs & margins"}
              style={{
                display: "flex", alignItems: "center", gap: "0.4rem",
                padding: "0.45rem 0.85rem",
                borderRadius: "0.5rem",
                border: `1px solid ${unlocked ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}`,
                background: unlocked ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                color: unlocked ? "#22c55e" : "#ef4444",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "0.8125rem",
                transition: "all 0.2s ease",
              }}
            >
              {unlocked ? <Unlock size={14} /> : <Lock size={14} />}
              {unlocked ? "Lock Financials" : "Unlock Financials"}
            </button>
          )}
          {canPurchase && (
            <button className="btn btn-ghost" onClick={() => handleOpenPurchaseModal()} id="buy-stock-btn" style={{ borderColor: "rgba(34,197,94,0.4)", color: "#22c55e" }}>
              <ArrowDownLeft size={15} /> Purchase Stock
            </button>
          )}
          <button
            className="btn btn-ghost"
            onClick={() => {
              setShowMovementsModal(true);
              setMovementsLoading(true);
              api.get<any[]>("/api/inventory/movements/log")
                .then(setMovements)
                .catch(() => setMovements([]))
                .finally(() => setMovementsLoading(false));
            }}
            id="movement-log-btn"
            style={{ borderColor: "rgba(129,140,248,0.4)", color: "#818cf8" }}
          >
            📋 Movement Log
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => window.open("http://127.0.0.1:8000/api/inventory/export/stock-audit-csv", "_blank")}
            style={{ borderColor: "rgba(34,197,94,0.4)", color: "#22c55e" }}
            id="download-stock-audit-csv-btn"
            title="Download full remaining stock audit & valuation CSV report for tax auditors"
          >
            📥 Stock Audit CSV
          </button>
          {canSell && (
            <button className="btn btn-primary" onClick={() => handleOpenSaleModal()} id="new-sale-btn" style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", border: "none" }}>
              <ShoppingBag size={15} /> Create Invoice / Sell
            </button>
          )}
          {canAddSku && (
            <button className="btn btn-primary" onClick={() => setShowForm(true)} id="add-sku-btn">
              <Plus size={15} /> Add SKU
            </button>
          )}
        </div>
      </div>

      {msg.text && (
        <div className={`alert ${msg.type === "success" ? "alert-success" : "alert-error"}`}>
          {msg.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {msg.text}
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        {[
          isAdmin
            ? { label: "Total Inventory Value", value: mask(formatNPR(totalValue)), isFinancial: true, color: "#6366f1", icon: Package }
            : { label: "Total Catalog Items",   value: `${items.length} ${prodTermPlural}`, isFinancial: false, color: "#6366f1", icon: Package },
          { label: "Total Units in Stock",  value: `${totalUnits.toLocaleString()} units`, isFinancial: false, color: "#22c55e", icon: TrendingUp },
          { label: "Low Stock Items",       value: `${lowStockCount} SKUs`, isFinancial: false, color: lowStockCount > 0 ? "#ef4444" : "#22c55e", icon: AlertTriangle },
        ].map(k => (
          <div key={k.label} className="kpi-card" style={{ position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>{k.label}</p>
                <p style={{
                  fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)", marginTop: "0.375rem",
                  ...(k.isFinancial ? blurStyle : {}),
                }}>{k.value}</p>
              </div>
              <k.icon size={20} color={k.color} style={{ opacity: 0.7 }} />
            </div>

            {/* Lock overlay click hint if financial and locked */}
            {isAdmin && k.isFinancial && !unlocked && (
              <button
                onClick={openLockModal}
                style={{
                  position: "absolute", inset: 0,
                  background: "transparent",
                  border: "none", cursor: "pointer",
                  borderRadius: "inherit",
                }}
                title="Click to unlock import costs & margins"
              />
            )}
          </div>
        ))}
      </div>

      {/* Add SKU Form */}
      {showForm && (
        <div className="card" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
          <h2 style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "1rem" }}>Add {prodTerm} SKU</h2>
          {error && <div className="alert alert-error" style={{ marginBottom: "0.75rem" }}>{error}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.75rem", marginBottom: "1rem" }}>
            {FIELDS.map(([key, label, placeholder, type]) => (
              <div key={key}>
                <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem" }}>{label}</label>
                <input type={type} className="input" placeholder={placeholder}
                  value={form[key as keyof typeof form]}
                  onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} id={`inv-${key}`} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
            <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAddSku} disabled={submitting} id="save-sku-btn">
              {submitting ? "Saving..." : "Save SKU"}
            </button>
          </div>
        </div>
      )}

      {/* Edit SKU Modal */}
      {editingItem && (
        <div className="modal-overlay" onClick={() => setEditingItem(null)}>
          <div
            className="card"
            style={{ width: "640px", maxWidth: "92vw", padding: "1.75rem", maxHeight: "calc(100vh - 3rem)", overflowY: "auto", margin: "auto" }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.75rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div style={{ padding: "0.4rem", borderRadius: "0.5rem", background: "rgba(96,165,250,0.15)", color: "#60a5fa" }}>
                  <Pencil size={18} />
                </div>
                <div>
                  <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                    Edit {prodTerm}: <span style={{ color: "#818cf8" }}>{editingItem.sku}</span>
                  </h2>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: 0 }}>Update specifications, category, stock count, and selling price</p>
                </div>
              </div>
              <button onClick={() => setEditingItem(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={18} /></button>
            </div>

            {editError && <div className="alert alert-error" style={{ marginBottom: "1rem" }}>{editError}</div>}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem", marginBottom: "1.25rem" }}>
              <div>
                <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem", fontWeight: 600 }}>{prodTerm} Name *</label>
                <input
                  type="text" className="input" placeholder={`${prodTerm} Name`}
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  id="edit-sku-name"
                />
              </div>

              <div>
                <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem", fontWeight: 600 }}>Category</label>
                <input
                  type="text" className="input" placeholder="e.g. Electronics / Energy / Tools"
                  value={editForm.category}
                  onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                  id="edit-sku-category"
                />
              </div>

              <div>
                <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem", fontWeight: 600 }}>Brand / Maker</label>
                <input
                  type="text" className="input" placeholder="e.g. OEM / Brand"
                  value={editForm.brand}
                  onChange={e => setEditForm(f => ({ ...f, brand: e.target.value }))}
                  id="edit-sku-brand"
                />
              </div>

              <div>
                <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem", fontWeight: 600 }}>Unit of Measure (UOM)</label>
                <input
                  type="text" className="input" placeholder="pcs, kg, box, sets"
                  value={editForm.unit_of_measure}
                  onChange={e => setEditForm(f => ({ ...f, unit_of_measure: e.target.value }))}
                  id="edit-sku-uom"
                />
              </div>

              <div style={{ gridColumn: "span 2" }}>
                <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem", fontWeight: 600 }}>Specifications / Technical Details</label>
                <input
                  type="text" className="input" placeholder="Size, Model, Specs, Rating, Variant"
                  value={editForm.specifications}
                  onChange={e => setEditForm(f => ({ ...f, specifications: e.target.value }))}
                  id="edit-sku-specs"
                />
              </div>

              <div>
                <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem", fontWeight: 600 }}>HS Code (Tax Audit)</label>
                <input
                  type="text" className="input" placeholder="e.g. 8507.60"
                  value={editForm.hs_code}
                  onChange={e => setEditForm(f => ({ ...f, hs_code: e.target.value }))}
                  id="edit-sku-hs"
                />
              </div>

              <div>
                <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem", fontWeight: 600 }}>Selling Price (NPR)</label>
                <input
                  type="number" className="input" placeholder="e.g. 24000"
                  value={editForm.selling_price_npr}
                  onChange={e => setEditForm(f => ({ ...f, selling_price_npr: e.target.value }))}
                  id="edit-sku-price"
                />
              </div>

              {canAddSku && (
                <div>
                  <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem", fontWeight: 600 }}>Import Cost (NPR)</label>
                  <input
                    type="number" className="input" placeholder="e.g. 18000"
                    value={editForm.import_cost_npr}
                    onChange={e => setEditForm(f => ({ ...f, import_cost_npr: e.target.value }))}
                    id="edit-sku-cost"
                  />
                </div>
              )}

              <div>
                <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem", fontWeight: 600 }}>Current Stock Qty</label>
                <input
                  type="number" className="input" placeholder="0"
                  value={editForm.stock_qty}
                  onChange={e => setEditForm(f => ({ ...f, stock_qty: e.target.value }))}
                  id="edit-sku-stock"
                />
              </div>

              <div>
                <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem", fontWeight: 600 }}>Reorder Alert Level</label>
                <input
                  type="number" className="input" placeholder="5"
                  value={editForm.reorder_level}
                  onChange={e => setEditForm(f => ({ ...f, reorder_level: e.target.value }))}
                  id="edit-sku-reorder"
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
              <button className="btn btn-ghost" onClick={() => setEditingItem(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveEditSku} disabled={editSubmitting} id="update-sku-btn">
                {editSubmitting ? "Saving Changes..." : `Update ${prodTerm} Details`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Purchase Stock Modal (Using Bank Loan / Bank Funds) */}
      {showPurchaseModal && (
        <div className="modal-overlay">
          <div className="card" style={{ width: "540px", maxWidth: "90vw", display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 3rem)", margin: "auto" }}>
            {/* Sticky Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.5rem 2rem 1rem", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <ArrowDownLeft size={20} color="#22c55e" />
                <h2 style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "1.1rem" }}>
                  Purchase Stock (Bank Loan / Bank Funds)
                </h2>
              </div>
              <button onClick={() => setShowPurchaseModal(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={18} /></button>
            </div>

            {/* Scrollable Body */}
            <div style={{ overflowY: "auto", padding: "1.5rem 2rem", flex: 1, display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* Top Funding Capital & Loan Overview Bar */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", padding: "0.75rem 1rem", background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "0.625rem" }}>
                <div>
                  <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.04em" }}>💼 Investor Equity Capital</span>
                  <p style={{ fontSize: "1.1rem", fontWeight: 800, color: "#10b981", margin: 0 }}>{formatNPR(totalInvestorCapital)}</p>
                </div>
                <div>
                  <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.04em" }}>🏦 Active Bank Loan Funds</span>
                  <p style={{ fontSize: "1.1rem", fontWeight: 800, color: "#3b82f6", margin: 0 }}>{formatNPR(totalBankLoanCapital)}</p>
                </div>
              </div>

              {/* Product selection */}
              <div>
                <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem", fontWeight: 600 }}>
                  Select {prodTerm} to Buy *
                </label>
                <select
                  className="input"
                  value={purchaseForm.inventory_id}
                  onChange={e => handleSelectSkuInPurchase(Number(e.target.value))}
                  id="purchase-sku-select"
                >
                  <option value={0}>— Select SKU —</option>
                  {items.map(i => (
                    <option key={i.id} value={i.id}>
                      {i.sku} — {i.name} (Current Stock: {i.stock_qty}) — Cost: Rs. {i.import_cost_npr.toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity & Unit Import Cost */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem", fontWeight: 600 }}>
                    Quantity to Purchase *
                  </label>
                  <input
                    type="number" className="input" min="1"
                    value={purchaseForm.quantity}
                    onChange={e => setPurchaseForm(f => ({ ...f, quantity: Number(e.target.value) }))}
                    id="purchase-qty-input"
                  />
                </div>

                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem", fontWeight: 600 }}>
                    Unit Import Cost (NPR)
                  </label>
                  <input
                    type="number" className="input"
                    placeholder={selectedSkuForPurchase ? String(selectedSkuForPurchase.import_cost_npr) : "0"}
                    value={purchaseForm.unit_cost_npr}
                    onChange={e => setPurchaseForm(f => ({ ...f, unit_cost_npr: e.target.value }))}
                    id="purchase-cost-input"
                  />
                </div>
              </div>

              {/* Funding Source Selection & Purchase Date */}
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem", fontWeight: 600 }}>
                    Funding Source / Capital Account *
                  </label>
                  <select
                    className="input"
                    value={fundingSource}
                    onChange={e => handleSelectFundingSource(e.target.value)}
                    id="purchase-funding-select"
                  >
                    <option value="INVESTOR">💼 Investor Equity Capital (Available: {formatNPR(totalInvestorCapital)})</option>
                    {loans.filter(l => !l.is_closed).map(loan => (
                      <option key={loan.id} value={`LOAN_${loan.id}`}>
                        🏦 Bank Loan: {loan.bank_name} ({loan.loan_account_no}) — {formatNPR(loan.principal_npr)}
                      </option>
                    ))}
                    <option value="CASH">💵 Cash in Hand</option>
                    <option value="SUPPLIER_CREDIT">💳 Supplier Credit (Accounts Payable)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem", fontWeight: 600 }}>
                    Purchase Date *
                  </label>
                  <input
                    type="date" className="input"
                    value={purchaseForm.purchase_date}
                    onChange={e => setPurchaseForm(f => ({ ...f, purchase_date: e.target.value }))}
                    id="purchase-date-input"
                  />
                </div>
              </div>

              {/* Dynamic Purchase Summary Box & Individual Remaining Balances */}
              <div style={{ padding: "0.875rem 1rem", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: "0.625rem", marginTop: "0.25rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                  <div>
                    <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Total Purchase Cost</p>
                    <p style={{ fontSize: "1.3rem", fontWeight: 800, color: "#22c55e", lineHeight: 1.1 }}>{formatNPR(totalPurchaseAmount)}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Selected Funding Balance</p>
                    <p style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.1 }}>{formatNPR(selectedFundingAvailable)}</p>
                  </div>
                </div>

                {/* Remaining Balances Breakdown after purchase */}
                <div style={{ borderTop: "1px dashed rgba(255,255,255,0.15)", paddingTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.76rem" }}>
                  {selectedLoan && (
                    <div style={{ display: "flex", justifyContent: "space-between", color: remainingSelectedLoan < 0 ? "#ef4444" : "#3b82f6", fontWeight: 600 }}>
                      <span>Remaining Bank Loan ({selectedLoan.bank_name}) After Purchase:</span>
                      <span>{formatNPR(remainingSelectedLoan)}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", color: remainingInvestorCapital < 0 ? "#ef4444" : "#10b981", fontWeight: 600 }}>
                    <span>Remaining Investor Equity Capital After Purchase:</span>
                    <span>{formatNPR(remainingInvestorCapital)}</span>
                  </div>
                </div>

                {isInsufficientFunding && (
                  <div style={{ marginTop: "0.5rem", padding: "0.4rem 0.6rem", background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: "0.375rem", color: "#ef4444", fontSize: "0.72rem", fontWeight: 700 }}>
                    ⚠️ Warning: Purchase amount ({formatNPR(totalPurchaseAmount)}) exceeds selected available funding balance ({formatNPR(selectedFundingAvailable)}).
                  </div>
                )}
              </div>
            </div>

            {/* Sticky Footer */}
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", padding: "1rem 2rem 1.5rem", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
              <button className="btn btn-ghost" onClick={() => setShowPurchaseModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handlePostPurchase} disabled={purchaseSubmitting} id="confirm-purchase-btn">
                {purchaseSubmitting ? "Processing..." : "Confirm Purchase & Increase Stock"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Sale Modal */}
      {showSaleModal && (
        <div className="modal-overlay">
          <div className="card" style={{ width: "540px", maxWidth: "90vw", display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 3rem)", margin: "auto" }}>
            {/* Sticky Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.5rem 2rem 1rem", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <ShoppingBag size={20} color="#818cf8" />
                <h2 style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "1.1rem" }}>
                  Sell {prodTerm} / Customer Invoice
                </h2>
              </div>
              <button onClick={() => setShowSaleModal(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={18} /></button>
            </div>

            {/* Scrollable Body */}
            <div style={{ overflowY: "auto", padding: "1.5rem 2rem", flex: 1, display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* Customer selection (Existing vs New Customer) */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>
                    Select Customer *
                  </label>
                  <div style={{ display: "inline-flex", background: "rgba(255,255,255,0.06)", border: "1px solid var(--border-color)", borderRadius: "0.5rem", padding: "2px" }}>
                    <button
                      type="button"
                      onClick={() => setCustomerMode("existing")}
                      style={{
                        padding: "0.2rem 0.6rem", fontSize: "0.72rem", fontWeight: 600, borderRadius: "0.375rem", border: "none", cursor: "pointer",
                        background: customerMode === "existing" ? "#818cf8" : "transparent",
                        color: customerMode === "existing" ? "#fff" : "var(--text-muted)",
                        transition: "all 0.2s"
                      }}
                      id="existing-customer-btn"
                    >
                      Existing Customer
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomerMode("new")}
                      style={{
                        padding: "0.2rem 0.6rem", fontSize: "0.72rem", fontWeight: 600, borderRadius: "0.375rem", border: "none", cursor: "pointer",
                        background: customerMode === "new" ? "#818cf8" : "transparent",
                        color: customerMode === "new" ? "#fff" : "var(--text-muted)",
                        transition: "all 0.2s"
                      }}
                      id="new-customer-btn"
                    >
                      + New Customer
                    </button>
                  </div>
                </div>

                {customerMode === "existing" ? (
                  customers.length === 0 ? (
                    <div style={{ fontSize: "0.8rem", color: "#ef4444" }}>
                      No customers found. Switch to "+ New Customer" to add one!
                    </div>
                  ) : (
                    <select
                      className="input"
                      value={saleForm.customer_id}
                      onChange={e => setSaleForm(f => ({ ...f, customer_id: Number(e.target.value) }))}
                      id="sale-cust-select"
                    >
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.customer_type}) — {c.phone || "No phone"}
                        </option>
                      ))}
                    </select>
                  )
                ) : (
                  <div style={{ padding: "0.875rem", border: "1px solid rgba(129,140,248,0.35)", borderRadius: "0.625rem", background: "rgba(129,140,248,0.05)", display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#818cf8", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      ✨ Add New Customer (Saved directly to Customers Table)
                    </div>
                    <div>
                      <label style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block", marginBottom: "0.2rem" }}>Customer / Business Name *</label>
                      <input
                        type="text" className="input" placeholder="e.g. Kathmandu Solar House or Ram Thapa"
                        value={newCustomer.name}
                        onChange={e => setNewCustomer(c => ({ ...c, name: e.target.value }))}
                        id="new-cust-name-input"
                      />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                      <div>
                        <label style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block", marginBottom: "0.2rem" }}>Phone Number</label>
                        <input
                          type="text" className="input" placeholder="e.g. 9841000000"
                          value={newCustomer.phone}
                          onChange={e => setNewCustomer(c => ({ ...c, phone: e.target.value }))}
                          id="new-cust-phone-input"
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block", marginBottom: "0.2rem" }}>Customer Type</label>
                        <select
                          className="input"
                          value={newCustomer.customer_type}
                          onChange={e => setNewCustomer(c => ({ ...c, customer_type: e.target.value }))}
                          id="new-cust-type-select"
                        >
                          <option value="B2C">B2C (Individual Consumer)</option>
                          <option value="B2B">B2B (Business / Corporate)</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                      <div>
                        <label style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block", marginBottom: "0.2rem" }}>Address</label>
                        <input
                          type="text" className="input" placeholder="Balaju, Kathmandu"
                          value={newCustomer.address}
                          onChange={e => setNewCustomer(c => ({ ...c, address: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block", marginBottom: "0.2rem" }}>Credit Limit (NPR)</label>
                        <input
                          type="number" className="input" placeholder="0"
                          value={newCustomer.credit_limit}
                          onChange={e => setNewCustomer(c => ({ ...c, credit_limit: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block", marginBottom: "0.2rem" }}>PAN Number</label>
                        <input
                          type="text" className="input" placeholder="610XXXXXX"
                          value={newCustomer.pan_no}
                          onChange={e => setNewCustomer(c => ({ ...c, pan_no: e.target.value }))}
                          id="new-cust-pan-input"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem", fontWeight: 600 }}>
                  Select {prodTerm} *
                </label>
                <select
                  className="input"
                  value={saleForm.inventory_id}
                  onChange={e => handleSelectSkuInSale(Number(e.target.value))}
                  id="sale-sku-select"
                >
                  <option value={0}>— Select SKU —</option>
                  {items.map(i => (
                    <option key={i.id} value={i.id} disabled={i.stock_qty <= 0}>
                      {i.sku} — {i.name} (In Stock: {i.stock_qty}) — Rs. {i.selling_price_npr.toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem", fontWeight: 600 }}>
                    Quantity to Sell *
                  </label>
                  <input
                    type="number" className="input" min="1"
                    max={selectedSkuForSale?.stock_qty || 999}
                    value={saleForm.quantity}
                    onChange={e => setSaleForm(f => ({ ...f, quantity: Number(e.target.value) }))}
                    id="sale-qty-input"
                  />
                  {selectedSkuForSale && (
                    <p style={{ fontSize: "0.68rem", color: selectedSkuForSale.stock_qty > 0 ? "var(--text-muted)" : "#ef4444", marginTop: "3px" }}>
                      Available: {selectedSkuForSale.stock_qty} units
                    </p>
                  )}
                </div>

                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem", fontWeight: 600 }}>
                    Unit Price (Excl. VAT)
                  </label>
                  <input
                    type="number" className="input"
                    placeholder={selectedSkuForSale ? String(selectedSkuForSale.selling_price_npr) : "0"}
                    value={saleForm.unit_price_npr}
                    onChange={e => setSaleForm(f => ({ ...f, unit_price_npr: e.target.value }))}
                    id="sale-price-input"
                  />
                </div>

                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem", fontWeight: 600 }}>
                    Discount %
                  </label>
                  <input
                    type="number" className="input" min="0" max="100" placeholder="0"
                    value={saleForm.discount_pct}
                    onChange={e => setSaleForm(f => ({ ...f, discount_pct: e.target.value }))}
                    id="sale-discount-input"
                  />
                </div>
              </div>

              {/* 13% VAT Checkbox Option */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.6rem 0.875rem", background: applyVat ? "rgba(129,140,248,0.1)" : "rgba(255,255,255,0.03)", border: "1px dashed rgba(129,140,248,0.4)", borderRadius: "0.5rem" }}>
                <label htmlFor="apply-vat-checkbox" style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", color: "var(--text-primary)" }}>
                  <input
                    type="checkbox"
                    id="apply-vat-checkbox"
                    checked={applyVat}
                    onChange={e => setApplyVat(e.target.checked)}
                    style={{ width: "16px", height: "16px", cursor: "pointer", accentColor: "#818cf8" }}
                  />
                  Apply 13% VAT (Taxable Bill)
                </label>
                <span style={{ fontSize: "0.72rem", color: applyVat ? "#818cf8" : "var(--text-muted)", fontWeight: 600 }}>
                  {applyVat ? "13% VAT Included" : "Non-VAT / Tax Exempt"}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem", fontWeight: 600 }}>
                    Payment Terms *
                  </label>
                  <select
                    className="input"
                    value={saleForm.payment_method}
                    onChange={e => {
                      const val = e.target.value;
                      setSaleForm(f => ({
                        ...f,
                        payment_method: val,
                        paid_amount_npr: val === "CREDIT" ? "0" : val === "PARTIAL" ? f.paid_amount_npr : ""
                      }));
                    }}
                    id="sale-payment-select"
                  >
                    <option value="CREDIT">💳 CREDIT (Full Amount Saved to Customer Due)</option>
                    <option value="PARTIAL">⚡ PARTIAL PAYMENT (Down Payment + Remaining Credit)</option>
                    <option value="CASH">💵 CASH (Full Immediate Cash in Hand)</option>
                    <option value="BANK">🏦 BANK (Full Direct Bank Deposit)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem", fontWeight: 600 }}>
                    Invoice Date *
                  </label>
                  <input
                    type="date" className="input"
                    value={saleForm.invoice_date}
                    onChange={e => setSaleForm(f => ({ ...f, invoice_date: e.target.value }))}
                    id="sale-date-input"
                  />
                </div>
              </div>

              {/* Upfront Down Payment & Split Section (ALWAYS VISIBLE & INTUITIVE) */}
              <div style={{ padding: "0.875rem 1rem", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: "0.625rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#22c55e", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    ⚡ Partial Down Payment &amp; Upfront Collection
                  </div>
                  <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 600 }}>
                    {saleForm.payment_method === "PARTIAL" || (Number(saleForm.paid_amount_npr || 0) > 0 && Number(saleForm.paid_amount_npr || 0) < totalSaleAmount)
                      ? "⚡ Partial Split Active"
                      : "Settlement Mode"}
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "0.75rem" }}>
                  <div>
                    <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>
                      Amount Paid Upfront by Customer (NPR)
                    </label>
                    <input
                      type="number"
                      className="input"
                      placeholder="e.g. 20000 (Enter amount paid now)"
                      value={saleForm.paid_amount_npr}
                      onChange={e => {
                        const val = e.target.value;
                        setSaleForm(f => ({
                          ...f,
                          paid_amount_npr: val,
                          payment_method: (Number(val) > 0 && Number(val) < totalSaleAmount) ? "PARTIAL" : f.payment_method
                        }));
                      }}
                      id="sale-paid-amount-input"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>
                      Upfront Account
                    </label>
                    <select
                      className="input"
                      value={saleForm.partial_payment_method}
                      onChange={e => setSaleForm(f => ({ ...f, partial_payment_method: e.target.value }))}
                      id="sale-partial-method-select"
                    >
                      <option value="BANK">🏦 Bank Deposit</option>
                      <option value="CASH">💵 Cash in Hand</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Enhanced Total Box with Live Partial Payment Breakdown */}
              <div style={{ padding: "0.875rem 1rem", background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: "0.625rem", marginTop: "0.25rem" }}>
                {(() => {
                  let paidVal = 0;
                  if (saleForm.paid_amount_npr !== "") {
                    paidVal = Math.min(Math.max(0, Number(saleForm.paid_amount_npr || 0)), totalSaleAmount);
                  } else if (saleForm.payment_method === "CASH" || saleForm.payment_method === "BANK") {
                    paidVal = totalSaleAmount;
                  } else {
                    paidVal = 0;
                  }

                  const remainingDueVal = totalSaleAmount - paidVal;
                  const isPartialActive = paidVal > 0 && remainingDueVal > 0;

                  return (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", flex: 1 }}>
                        <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.04em", margin: 0 }}>
                          Total Invoice Calculation
                        </p>
                        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                          Gross Subtotal: <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{formatNPR(saleGrossSubtotal)}</span>
                        </div>
                        {saleDiscountAmount > 0 && (
                          <div style={{ fontSize: "0.78rem", color: "#22c55e", fontWeight: 600 }}>
                            - Discount ({saleDiscountPct}%): <span>-{formatNPR(saleDiscountAmount)}</span>
                          </div>
                        )}
                        {applyVat && (
                          <div style={{ fontSize: "0.78rem", color: "#818cf8", fontWeight: 500 }}>
                            + 13% VAT: <span style={{ fontWeight: 700 }}>{formatNPR(saleVatAmount)}</span>
                          </div>
                        )}
                        <div style={{ marginTop: "0.25rem" }}>
                          <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase", margin: 0 }}>GRAND TOTAL BILL</p>
                          <p style={{ fontSize: "1.3rem", fontWeight: 800, color: "#818cf8", margin: 0, lineHeight: 1.1 }}>{formatNPR(totalSaleAmount)}</p>
                        </div>

                        {/* Partial Payment Summary Cards */}
                        {isPartialActive && (
                          <div style={{ marginTop: "0.5rem", padding: "0.6rem 0.75rem", background: "rgba(255,255,255,0.04)", borderRadius: "0.5rem", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "0.3rem", fontSize: "0.78rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", color: "#22c55e", fontWeight: 700 }}>
                              <span>💵 Received Upfront ({saleForm.partial_payment_method}):</span>
                              <span>{formatNPR(paidVal)}</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", color: "#f59e0b", fontWeight: 700 }}>
                              <span>💳 Remaining Customer Due (Accounts Receivable):</span>
                              <span>{formatNPR(remainingDueVal)}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div style={{ textAlign: "right", fontSize: "0.72rem", color: "var(--text-muted)", marginLeft: "1rem" }}>
                        <div style={{ fontWeight: 600, marginBottom: "0.2rem" }}>Automated Ledger Actions:</div>
                        <div style={{ color: "#22c55e", fontWeight: 500 }}>✓ Decrements Stock by {saleForm.quantity}</div>
                        {isPartialActive ? (
                          <>
                            <div style={{ color: "#22c55e", fontWeight: 500 }}>✓ Debits {saleForm.partial_payment_method}: {formatNPR(paidVal)}</div>
                            <div style={{ color: "#f59e0b", fontWeight: 500 }}>✓ Debits Customer AR: {formatNPR(remainingDueVal)}</div>
                          </>
                        ) : (
                          <div style={{ color: "#22c55e", fontWeight: 500 }}>✓ Auto-posts Journal Entry</div>
                        )}
                        {applyVat && <div style={{ color: "#22c55e", fontWeight: 500 }}>✓ Credits 13% VAT Payable</div>}
                        <div style={{ color: "#22c55e", fontWeight: 500 }}>✓ Auto-syncs to Google Drive</div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Sticky Footer */}
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", padding: "1rem 2rem 1.5rem", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
              <button className="btn btn-ghost" onClick={() => setShowSaleModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handlePostSale} disabled={saleSubmitting} id="confirm-sale-btn">
                {saleSubmitting ? "Posting Sale..." : "Post Sale & Deduct Stock"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div style={{ position: "relative", marginBottom: "1.25rem" }}>
        <Search size={15} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
        <input type="text" className="input" style={{ paddingLeft: "2.25rem" }}
          placeholder="Search SKU, name, or brand..." value={search} onChange={e => setSearch(e.target.value)} id="inv-search" />
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "3rem", display: "flex", justifyContent: "center" }}><div className="spinner" /></div>
        ) : (
          <div style={{ overflowX: "auto", width: "100%" }}>
            <table className="data-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>HS Code</th>
                <th>{prodTerm} Name</th>
                <th>Category</th>
                <th>Brand</th>
                <th>Unit</th>
                <th>Specifications</th>
                {isAdmin && <th style={{ textAlign: "right" }}>Import Cost</th>}
                <th style={{ textAlign: "right" }}>Selling Price</th>
                {isAdmin && <th style={{ textAlign: "right" }}>Margin</th>}
                <th style={{ textAlign: "center" }}>Stock</th>
                {isAdmin && <th style={{ textAlign: "right" }}>Value</th>}
                <th>Status</th>
                <th style={{ textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <tr key={item.id}>
                  <td><code style={{ fontSize: "0.75rem", color: "#818cf8" }}>{item.sku}</code></td>
                  <td><code style={{ fontSize: "0.75rem", color: "#22c55e" }}>{item.hs_code || "—"}</code></td>
                  <td style={{ fontWeight: 600 }}>{item.name}</td>
                  <td><span style={{ fontSize: "0.72rem", background: "rgba(99,102,241,0.1)", color: "#818cf8", padding: "2px 6px", borderRadius: "4px", fontWeight: 600 }}>{item.category || "General"}</span></td>
                  <td className="text-muted">{item.brand || "—"}</td>
                  <td><span style={{ fontSize: "0.72rem", color: "var(--text-muted)", background: "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: "4px" }}>{item.unit_of_measure || "pcs"}</span></td>
                  <td className="text-faint" style={{ fontSize: "0.8rem" }}>{item.specifications || ((item.voltage_v || item.capacity_ah) ? `${item.voltage_v || 0}V / ${item.capacity_ah || 0}Ah` : "—")}</td>
                  {isAdmin && (
                    <td style={{ textAlign: "right", ...blurStyle }} className="text-muted">
                      {mask(formatNPR(item.import_cost_npr))}
                    </td>
                  )}
                  <td style={{ textAlign: "right", fontWeight: 700, color: "var(--text-primary)" }}>{formatNPR(item.selling_price_npr)}</td>
                  {isAdmin && (
                    <td style={{ textAlign: "right", color: "#22c55e", fontWeight: 600, ...blurStyle }}>
                      {mask(`${margin(item)}%`)}
                    </td>
                  )}
                  <td style={{ textAlign: "center", fontWeight: 700, color: item.low_stock ? "#ef4444" : "var(--text-primary)" }}>
                    {item.stock_qty}
                  </td>
                  {isAdmin && (
                    <td style={{ textAlign: "right", color: "#818cf8", fontWeight: 600, ...blurStyle }}>
                      {mask(formatNPR(item.inventory_value_npr))}
                    </td>
                  )}
                  <td>
                    {item.low_stock
                      ? <span className="badge badge-red"><AlertTriangle size={10} style={{ marginRight: 3 }} />Low</span>
                      : <span className="badge badge-green">OK</span>
                    }
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <div style={{ display: "flex", gap: "0.375rem", justifyContent: "center" }}>
                      {canPurchase && (
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: "0.72rem", padding: "0.25rem 0.5rem", color: "#22c55e", borderColor: "rgba(34,197,94,0.3)" }}
                          onClick={() => handleOpenPurchaseModal(item.id)}
                          id={`buy-btn-${item.id}`}
                        >
                          <ArrowDownLeft size={12} style={{ marginRight: 3 }} /> Buy
                        </button>
                      )}
                      {canSell && (
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: "0.72rem", padding: "0.25rem 0.5rem", color: "#818cf8", borderColor: "rgba(99,102,241,0.3)" }}
                          onClick={() => handleOpenSaleModal(item.id)}
                          disabled={item.stock_qty <= 0}
                          id={`sell-btn-${item.id}`}
                        >
                          <ShoppingBag size={12} style={{ marginRight: 3 }} /> Sell
                        </button>
                      )}
                      {canAddSku && (
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: "0.72rem", padding: "0.25rem 0.5rem", color: "#60a5fa", borderColor: "rgba(96,165,250,0.3)" }}
                          onClick={() => handleOpenEditModal(item)}
                          id={`edit-btn-${item.id}`}
                          title="Edit SKU specifications, pricing or details"
                        >
                          <Pencil size={12} style={{ marginRight: 3 }} /> Edit
                        </button>
                      )}
                      {isAccountant && (
                        <span className="badge badge-amber" style={{ fontSize: "0.7rem" }}>AUDIT READ-ONLY</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* PIN Unlock Modal */}
      {showPinModal && (
        <div className="modal-overlay" onClick={() => setShowPinModal(false)}>
          <div
            className="card"
            style={{
              width: "380px", maxWidth: "90vw", padding: "2rem",
              display: "flex", flexDirection: "column", alignItems: "center", gap: "1.25rem",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "56px", height: "56px", borderRadius: "50%", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)" }}>
              <Lock size={24} color="#ef4444" />
            </div>
            <div style={{ textAlign: "center" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                Unlock Cost &amp; Profit Margins
              </h3>
              <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.375rem" }}>
                Enter admin password to reveal import cost &amp; margin percentages
              </p>
            </div>

            <div style={{ width: "100%", position: "relative" }}>
              <input
                ref={pinRef}
                type={showPin ? "text" : "password"}
                className="input"
                style={{ width: "100%", textAlign: "center", fontSize: "1.1rem", letterSpacing: "0.15em", paddingRight: "2.5rem" }}
                placeholder="Enter password"
                value={pin}
                onChange={(e) => { setPin(e.target.value); setPinError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") handlePinSubmit(); }}
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {pinError && (
              <p style={{ color: "#ef4444", fontSize: "0.78rem", fontWeight: 600, margin: 0 }}>{pinError}</p>
            )}

            <div style={{ display: "flex", gap: "0.75rem", width: "100%" }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowPinModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handlePinSubmit}>
                <Unlock size={14} /> Unlock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inventory Movement Log Modal */}
      {showMovementsModal && (
        <div className="modal-overlay" onClick={() => setShowMovementsModal(false)}>
          <div
            className="card"
            style={{ width: "880px", maxWidth: "95vw", display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 3rem)", margin: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.25rem 1.75rem", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                📋 Inventory Movement Audit Log (Stock IN / Stock OUT)
              </h2>
              <button onClick={() => setShowMovementsModal(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ overflowY: "auto", padding: "1.25rem 1.75rem", flex: 1 }}>
              {movementsLoading ? (
                <div style={{ padding: "3rem", textAlign: "center" }}><div className="spinner" /></div>
              ) : movements.length === 0 ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                  No stock movements recorded yet.
                </div>
              ) : (
                <table className="data-table" style={{ fontSize: "0.8rem" }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Ref #</th>
                      <th>Type</th>
                      <th>SKU</th>
                      <th>Product Name</th>
                      <th style={{ textAlign: "center" }}>Qty</th>
                      <th style={{ textAlign: "right" }}>Amount (NPR)</th>
                      <th>Narration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((m: any, idx: number) => (
                      <tr key={idx}>
                        <td style={{ whiteSpace: "nowrap" }} className="text-muted">{m.date}</td>
                        <td><code style={{ fontSize: "0.75rem", color: "#818cf8" }}>{m.reference}</code></td>
                        <td>
                          <span className={`badge ${m.movement_type === "IN" ? "badge-green" : "badge-amber"}`}>
                            {m.movement_type === "IN" ? "⬆ STOCK IN" : "⬇ STOCK OUT"}
                          </span>
                        </td>
                        <td><code style={{ fontSize: "0.75rem" }}>{m.sku}</code></td>
                        <td style={{ fontWeight: 500 }}>{m.item_name}</td>
                        <td style={{ textAlign: "center", fontWeight: 700, color: m.movement_type === "IN" ? "#22c55e" : "#f59e0b" }}>
                          {m.quantity ? `${m.movement_type === "IN" ? "+" : "-"}${m.quantity}` : "—"}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 600 }}>{formatNPR(m.amount_npr)}</td>
                        <td style={{ fontSize: "0.75rem", color: "var(--text-muted)", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {m.narration}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", padding: "1rem 1.75rem", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
              <button className="btn btn-ghost" onClick={() => setShowMovementsModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
