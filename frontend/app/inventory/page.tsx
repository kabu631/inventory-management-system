"use client";
import { useEffect, useState, useCallback } from "react";
import { api, formatNPR } from "@/lib/api";
import { AlertTriangle, Plus, Search, TrendingUp, Package, ShoppingBag, ArrowDownLeft, X, CheckCircle2, AlertCircle } from "lucide-react";

interface Item {
  id: number; sku: string; name: string; brand: string;
  capacity_ah: number; voltage_v: number;
  import_cost_npr: number; selling_price_npr: number;
  stock_qty: number; reorder_level: number;
  inventory_value_npr: number; low_stock: boolean;
}

interface Customer {
  id: number; name: string; customer_type: string; phone: string;
}

export default function InventoryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [msg, setMsg] = useState({ text: "", type: "" });

  // Add SKU form
  const [form, setForm] = useState({
    sku: "", name: "", brand: "", capacity_ah: "", voltage_v: "",
    import_cost_npr: "", selling_price_npr: "", stock_qty: "", reorder_level: "5",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Sales Invoice form
  const [saleForm, setSaleForm] = useState({
    customer_id: 0,
    inventory_id: 0,
    quantity: 1,
    unit_price_npr: "",
    payment_method: "CREDIT",
    invoice_date: new Date().toISOString().split("T")[0],
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

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get<Item[]>("/api/inventory/"),
      api.get<Customer[]>("/api/customers/"),
    ]).then(([i, c]) => {
      setItems(i);
      setCustomers(c);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const flashMsg = (text: string, type: "success" | "error") => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: "", type: "" }), 5000);
  };

  const totalValue    = items.reduce((s, i) => s + i.inventory_value_npr, 0);
  const lowStockCount = items.filter(i => i.low_stock).length;
  const totalUnits    = items.reduce((s, i) => s + i.stock_qty, 0);

  const filtered = items.filter(i =>
    i.sku.toLowerCase().includes(search.toLowerCase()) ||
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.brand?.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddSku = async () => {
    setError(""); setSubmitting(true);
    try {
      await api.post("/api/inventory/", {
        ...form,
        capacity_ah: Number(form.capacity_ah), voltage_v: Number(form.voltage_v),
        import_cost_npr: Number(form.import_cost_npr), selling_price_npr: Number(form.selling_price_npr),
        stock_qty: Number(form.stock_qty), reorder_level: Number(form.reorder_level),
      });
      setShowForm(false);
      setForm({ sku:"",name:"",brand:"",capacity_ah:"",voltage_v:"",import_cost_npr:"",selling_price_npr:"",stock_qty:"",reorder_level:"5" });
      flashMsg("New battery SKU added successfully!", "success");
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
      payment_method: "CREDIT",
      invoice_date: new Date().toISOString().split("T")[0],
    });
    setCustomerMode("existing");
    setNewCustomer({ name: "", phone: "", email: "", address: "", customer_type: "B2C", credit_limit: "0" });
    setApplyVat(false);
    setShowSaleModal(true);
  };

  const handleOpenPurchaseModal = (skuId?: number) => {
    const defaultSku = skuId ? items.find(i => i.id === skuId) : (items[0] || null);
    setPurchaseForm({
      inventory_id: defaultSku?.id || 0,
      quantity: 10,
      unit_cost_npr: defaultSku ? String(defaultSku.import_cost_npr) : "",
      payment_method: "BANK",
      purchase_date: new Date().toISOString().split("T")[0],
    });
    setShowPurchaseModal(true);
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
        });
        targetCustomerId = createdCust.id;
      } else {
        if (!targetCustomerId) {
          setSaleSubmitting(false);
          return alert("Please select an existing customer.");
        }
      }

      const selectedSku = items.find(i => i.id === Number(saleForm.inventory_id));
      const res = await api.post<{ status: string; message: string }>(
        "/api/inventory/sell",
        {
          customer_id: targetCustomerId,
          payment_method: saleForm.payment_method,
          invoice_date: saleForm.invoice_date,
          apply_vat: applyVat,
          items: [
            {
              inventory_id: Number(saleForm.inventory_id),
              quantity: Number(saleForm.quantity),
              unit_price_npr: saleForm.unit_price_npr ? Number(saleForm.unit_price_npr) : selectedSku?.selling_price_npr,
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

    setPurchaseSubmitting(true);
    try {
      const selectedSku = items.find(i => i.id === Number(purchaseForm.inventory_id));
      const res = await api.post<{ status: string; message: string }>(
        "/api/inventory/purchase",
        {
          payment_method: purchaseForm.payment_method,
          purchase_date: purchaseForm.purchase_date,
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
  const saleSubtotal = calcSaleUnitPrice * Number(saleForm.quantity || 0);
  const saleVatAmount = applyVat ? Math.round(saleSubtotal * 0.13) : 0;
  const totalSaleAmount = saleSubtotal + saleVatAmount;
  const unitPriceWithVat = applyVat ? Math.round(calcSaleUnitPrice * 1.13) : calcSaleUnitPrice;

  const selectedSkuForPurchase = items.find(i => i.id === Number(purchaseForm.inventory_id));
  const calcPurchaseUnitCost = purchaseForm.unit_cost_npr ? Number(purchaseForm.unit_cost_npr) : (selectedSkuForPurchase?.import_cost_npr || 0);
  const totalPurchaseAmount = calcPurchaseUnitCost * Number(purchaseForm.quantity || 0);

  const margin = (item: Item) =>
    item.selling_price_npr > 0
      ? (((item.selling_price_npr - item.import_cost_npr) / item.selling_price_npr) * 100).toFixed(1)
      : "0.0";

  const FIELDS: [string, string, string, string][] = [
    ["sku","SKU *","LFP-12-100","text"], ["name","Name *","LFP 12V 100Ah Battery","text"],
    ["brand","Brand","PowerNep","text"], ["capacity_ah","Capacity (Ah)","100","number"],
    ["voltage_v","Voltage (V)","12","number"], ["import_cost_npr","Import Cost NPR","18000","number"],
    ["selling_price_npr","Selling Price NPR","24000","number"], ["stock_qty","Stock Qty","0","number"],
    ["reorder_level","Reorder Level","5","number"],
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory & Stock Management</h1>
          <p className="text-muted" style={{ fontSize: "0.875rem" }}>
            Purchase Inventory using Bank Loan Funds & Sell Battery Stock
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button className="btn btn-ghost" onClick={() => handleOpenPurchaseModal()} id="buy-stock-btn" style={{ borderColor: "rgba(34,197,94,0.4)", color: "#22c55e" }}>
            <ArrowDownLeft size={16} /> Purchase Stock (Bank Loan Funds)
          </button>
          <button className="btn btn-ghost" onClick={() => handleOpenSaleModal()} id="new-sale-btn" style={{ borderColor: "rgba(99,102,241,0.4)", color: "#818cf8" }}>
            <ShoppingBag size={16} /> Sell Battery / Invoice
          </button>
          <button className="btn btn-primary" onClick={() => setShowForm(true)} id="add-sku-btn">
            <Plus size={16} /> Add SKU
          </button>
        </div>
      </div>

      {msg.text && (
        <div className={`alert ${msg.type === "success" ? "alert-success" : "alert-error"}`}>
          {msg.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {msg.text}
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
        {[
          { label: "Total Inventory Value", value: formatNPR(totalValue),                        color: "#6366f1", icon: Package },
          { label: "Total Units in Stock",  value: `${totalUnits.toLocaleString()} units`,        color: "#22c55e", icon: TrendingUp },
          { label: "Low Stock Items",       value: `${lowStockCount} SKUs`,                       color: lowStockCount > 0 ? "#ef4444" : "#22c55e", icon: AlertTriangle },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>{k.label}</p>
                <p style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)", marginTop: "0.375rem" }}>{k.value}</p>
              </div>
              <k.icon size={20} color={k.color} style={{ opacity: 0.7 }} />
            </div>
          </div>
        ))}
      </div>

      {/* Add SKU Form */}
      {showForm && (
        <div className="card" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
          <h2 style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "1rem" }}>Add Battery SKU</h2>
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
              {/* Product selection */}
              <div>
                <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem", fontWeight: 600 }}>
                  Select Battery Product to Buy *
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

              {/* Payment Source & Date */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem", fontWeight: 600 }}>
                    Payment Source *
                  </label>
                  <select
                    className="input"
                    value={purchaseForm.payment_method}
                    onChange={e => setPurchaseForm(f => ({ ...f, payment_method: e.target.value }))}
                    id="purchase-payment-select"
                  >
                    <option value="BANK">🏦 Bank Account (Paid from Bank Loan Funds)</option>
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

              {/* Purchase Summary Box */}
              <div style={{ padding: "0.875rem 1rem", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: "0.625rem", marginTop: "0.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Total Purchase Cost</p>
                    <p style={{ fontSize: "1.25rem", fontWeight: 700, color: "#22c55e" }}>{formatNPR(totalPurchaseAmount)}</p>
                  </div>
                  <div style={{ textAlign: "right", fontSize: "0.72rem", color: "var(--text-muted)" }}>
                    <div>Automated Connections:</div>
                    <div style={{ color: "#22c55e", fontWeight: 500 }}>✓ Increases Stock Qty by +{purchaseForm.quantity}</div>
                    <div style={{ color: "#22c55e", fontWeight: 500 }}>✓ Debits Stock Asset (1004)</div>
                    <div style={{ color: "#22c55e", fontWeight: 500 }}>✓ Credits Bank Loan Funds (1002)</div>
                  </div>
                </div>
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
                  Sell Battery / Product Invoice
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
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                      <div>
                        <label style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block", marginBottom: "0.2rem" }}>Email / Address</label>
                        <input
                          type="text" className="input" placeholder="e.g. Balaju, Kathmandu"
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
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem", fontWeight: 600 }}>
                  Select Battery Product *
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

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
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
                      Available stock: {selectedSkuForSale.stock_qty} units
                    </p>
                  )}
                </div>

                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem", fontWeight: 600 }}>
                    Unit Selling Price (Excl. VAT)
                  </label>
                  <input
                    type="number" className="input"
                    placeholder={selectedSkuForSale ? String(selectedSkuForSale.selling_price_npr) : "0"}
                    value={saleForm.unit_price_npr}
                    onChange={e => setSaleForm(f => ({ ...f, unit_price_npr: e.target.value }))}
                    id="sale-price-input"
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
                    onChange={e => setSaleForm(f => ({ ...f, payment_method: e.target.value }))}
                    id="sale-payment-select"
                  >
                    <option value="CREDIT">💳 CREDIT (Add to Customer Receivable)</option>
                    <option value="CASH">💵 CASH (Immediate Cash in Hand)</option>
                    <option value="BANK">🏦 BANK (Direct Bank Transfer)</option>
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

              {/* Enhanced Total Box with VAT Breakdown */}
              <div style={{ padding: "0.875rem 1rem", background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: "0.625rem", marginTop: "0.25rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                    <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.04em" }}>
                      Total Invoice Calculation
                    </p>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                      Subtotal ({saleForm.quantity} x {formatNPR(calcSaleUnitPrice)}): <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{formatNPR(saleSubtotal)}</span>
                    </div>
                    {applyVat && (
                      <div style={{ fontSize: "0.78rem", color: "#818cf8", fontWeight: 500 }}>
                        + 13% VAT: <span style={{ fontWeight: 700 }}>{formatNPR(saleVatAmount)}</span>
                        <span style={{ fontSize: "0.7rem", opacity: 0.8, marginLeft: "4px" }}>({formatNPR(unitPriceWithVat)} / unit incl. VAT)</span>
                      </div>
                    )}
                    <div style={{ marginTop: "0.35rem" }}>
                      <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase" }}>TOTAL AMOUNT</p>
                      <p style={{ fontSize: "1.35rem", fontWeight: 800, color: "#818cf8", lineHeight: 1.1 }}>{formatNPR(totalSaleAmount)}</p>
                    </div>
                  </div>

                  <div style={{ textAlign: "right", fontSize: "0.72rem", color: "var(--text-muted)" }}>
                    <div style={{ fontWeight: 600, marginBottom: "0.2rem" }}>Automated Actions:</div>
                    <div style={{ color: "#22c55e", fontWeight: 500 }}>✓ Decrements Stock by {saleForm.quantity}</div>
                    <div style={{ color: "#22c55e", fontWeight: 500 }}>✓ Auto-posts Journal Entry</div>
                    {applyVat && <div style={{ color: "#22c55e", fontWeight: 500 }}>✓ Credits 13% VAT Payable</div>}
                    <div style={{ color: "#22c55e", fontWeight: 500 }}>✓ Auto-syncs to Google Drive</div>
                  </div>
                </div>
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
          <table className="data-table">
            <thead>
              <tr>
                <th>SKU</th><th>Name</th><th>Brand</th><th>Spec</th>
                <th style={{ textAlign: "right" }}>Import Cost</th>
                <th style={{ textAlign: "right" }}>Sell Price</th>
                <th style={{ textAlign: "right" }}>Margin</th>
                <th style={{ textAlign: "center" }}>Stock</th>
                <th style={{ textAlign: "right" }}>Value</th>
                <th>Status</th>
                <th style={{ textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <tr key={item.id}>
                  <td><code style={{ fontSize: "0.75rem", color: "#818cf8" }}>{item.sku}</code></td>
                  <td style={{ fontWeight: 500 }}>{item.name}</td>
                  <td className="text-muted">{item.brand}</td>
                  <td className="text-faint" style={{ fontSize: "0.8rem" }}>{item.voltage_v}V / {item.capacity_ah}Ah</td>
                  <td style={{ textAlign: "right" }} className="text-muted">{formatNPR(item.import_cost_npr)}</td>
                  <td style={{ textAlign: "right" }}>{formatNPR(item.selling_price_npr)}</td>
                  <td style={{ textAlign: "right", color: "#22c55e", fontWeight: 600 }}>{margin(item)}%</td>
                  <td style={{ textAlign: "center", fontWeight: 700, color: item.low_stock ? "#ef4444" : "var(--text-primary)" }}>
                    {item.stock_qty}
                  </td>
                  <td style={{ textAlign: "right", color: "#818cf8", fontWeight: 600 }}>{formatNPR(item.inventory_value_npr)}</td>
                  <td>
                    {item.low_stock
                      ? <span className="badge badge-red"><AlertTriangle size={10} style={{ marginRight: 3 }} />Low</span>
                      : <span className="badge badge-green">OK</span>
                    }
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <div style={{ display: "flex", gap: "0.375rem", justifyContent: "center" }}>
                      <button
                        className="btn btn-ghost"
                        style={{ fontSize: "0.72rem", padding: "0.25rem 0.5rem", color: "#22c55e", borderColor: "rgba(34,197,94,0.3)" }}
                        onClick={() => handleOpenPurchaseModal(item.id)}
                        id={`buy-btn-${item.id}`}
                      >
                        <ArrowDownLeft size={12} style={{ marginRight: 3 }} /> Buy
                      </button>
                      <button
                        className="btn btn-ghost"
                        style={{ fontSize: "0.72rem", padding: "0.25rem 0.5rem", color: "#818cf8", borderColor: "rgba(99,102,241,0.3)" }}
                        onClick={() => handleOpenSaleModal(item.id)}
                        disabled={item.stock_qty <= 0}
                        id={`sell-btn-${item.id}`}
                      >
                        <ShoppingBag size={12} style={{ marginRight: 3 }} /> Sell
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
