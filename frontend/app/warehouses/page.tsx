"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Building2, Plus, ArrowRightLeft, CheckCircle2, AlertCircle, MapPin, Package } from "lucide-react";

interface Warehouse {
  id: number; code: string; name: string; location: string; is_primary: boolean;
}
interface Transfer {
  id: number; transfer_date: string; reference: string; from_warehouse: string; to_warehouse: string; sku: string; item_name: string; quantity: number; notes: string;
}
interface InventorySKU {
  id: number; sku: string; name: string; stock_qty: number;
}

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [items, setItems] = useState<InventorySKU[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ text: "", type: "" });
  const [showAddWh, setShowAddWh] = useState(false);
  const [showTrfModal, setShowTrfModal] = useState(false);

  const [whForm, setWhForm] = useState({ code: "", name: "", location: "", is_primary: false });
  const [trfForm, setTrfForm] = useState({
    transfer_date: new Date().toISOString().split("T")[0],
    from_warehouse_id: 0,
    to_warehouse_id: 0,
    inventory_id: 0,
    quantity: 1,
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get<Warehouse[]>("/api/warehouses/"),
      api.get<Transfer[]>("/api/warehouses/transfers"),
      api.get<InventorySKU[]>("/api/inventory/"),
    ]).then(([w, t, i]) => {
      const safeW = Array.isArray(w) ? w : [];
      const safeT = Array.isArray(t) ? t : [];
      const safeI = Array.isArray(i) ? i : [];
      setWarehouses(safeW);
      setTransfers(safeT);
      setItems(safeI);
      if (safeW.length >= 2) {
        setTrfForm(f => ({ ...f, from_warehouse_id: safeW[0].id, to_warehouse_id: safeW[1].id, inventory_id: safeI[0]?.id || 0 }));
      }
    }).catch(e => {
      flash(e instanceof Error ? e.message : "Failed to load warehouses data", "error");
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (text: string, type: string) => { setMsg({ text, type }); setTimeout(() => setMsg({ text: "", type: "" }), 4000); };

  const handleAddWh = async () => {
    if (!whForm.code || !whForm.name) return alert("Warehouse code and name are required");
    setSubmitting(true);
    try {
      await api.post("/api/warehouses/", whForm);
      setShowAddWh(false);
      flash("New warehouse location added!", "success");
      load();
    } catch(e: unknown) { flash(e instanceof Error ? e.message : "Error", "error"); }
    finally { setSubmitting(false); }
  };

  const handleCreateTransfer = async () => {
    if (!trfForm.from_warehouse_id || !trfForm.to_warehouse_id) return alert("Select source and destination warehouses");
    if (trfForm.from_warehouse_id === trfForm.to_warehouse_id) return alert("Source and destination cannot be identical");
    if (!trfForm.inventory_id) return alert("Select product SKU to transfer");
    if (trfForm.quantity <= 0) return alert("Quantity must be at least 1");

    setSubmitting(true);
    try {
      const res = await api.post<{ status: string; message: string }>("/api/warehouses/transfers", trfForm);
      setShowTrfModal(false);
      flash(res.message || "Stock transferred between warehouses!", "success");
      load();
    } catch(e: unknown) { flash(e instanceof Error ? e.message : "Error", "error"); }
    finally { setSubmitting(false); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Multi-Warehouse & Stock Transfers</h1>
          <p className="text-muted" style={{ fontSize: "0.875rem" }}>Corporate Location Tracking, Central Depots & Inter-Warehouse Stock Movements</p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button className="btn btn-ghost" onClick={() => setShowTrfModal(true)} style={{ borderColor: "rgba(99,102,241,0.4)", color: "#818cf8" }}>
            <ArrowRightLeft size={16} /> New Stock Transfer
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddWh(true)}>
            <Plus size={16} /> Add Location
          </button>
        </div>
      </div>

      {msg.text && (
        <div className={`alert ${msg.type === "success" ? "alert-success" : "alert-error"}`}>
          {msg.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}{msg.text}
        </div>
      )}

      {/* Warehouse Location Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
        {warehouses.map(w => (
          <div key={w.id} className="kpi-card glow-indigo">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Building2 size={18} color="#818cf8" />
                  <h3 style={{ fontWeight: 700, color: "var(--text-primary)" }}>{w.name}</h3>
                </div>
                <p className="text-muted" style={{ fontSize: "0.78rem", marginTop: "4px" }}>
                  <MapPin size={12} style={{ display: "inline", marginRight: "3px" }} />
                  {w.location || "Main Hub"}
                </p>
              </div>
              <span className={`badge ${w.is_primary ? "badge-green" : "badge-amber"}`}>
                {w.code} {w.is_primary ? "(Primary)" : ""}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Add Warehouse Form */}
      {showAddWh && (
        <div className="card" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
          <h2 style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "1rem" }}>Add New Warehouse Location</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 2fr", gap: "0.75rem", marginBottom: "1rem" }}>
            <div>
              <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem" }}>Code *</label>
              <input type="text" className="input" placeholder="e.g. BRT-WH-02" value={whForm.code} onChange={e => setWhForm(f => ({ ...f, code: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem" }}>Warehouse Name *</label>
              <input type="text" className="input" placeholder="e.g. Biratnagar Regional Depot" value={whForm.name} onChange={e => setWhForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem" }}>Location / Address</label>
              <input type="text" className="input" placeholder="e.g. Biratnagar Industrial Area" value={whForm.location} onChange={e => setWhForm(f => ({ ...f, location: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
            <button className="btn btn-ghost" onClick={() => setShowAddWh(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAddWh} disabled={submitting}>Save Location</button>
          </div>
        </div>
      )}

      {/* Stock Transfer Modal */}
      {showTrfModal && (
        <div className="modal-overlay">
          <div className="card" style={{ padding: "2rem", width: "500px", maxWidth: "90vw" }}>
            <h2 style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "1.25rem" }}>Inter-Warehouse Stock Transfer</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem" }}>From Warehouse (Source)</label>
                  <select className="input" value={trfForm.from_warehouse_id} onChange={e => setTrfForm(f => ({ ...f, from_warehouse_id: Number(e.target.value) }))}>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem" }}>To Warehouse (Destination)</label>
                  <select className="input" value={trfForm.to_warehouse_id} onChange={e => setTrfForm(f => ({ ...f, to_warehouse_id: Number(e.target.value) }))}>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem" }}>Select Product SKU *</label>
                <select className="input" value={trfForm.inventory_id} onChange={e => setTrfForm(f => ({ ...f, inventory_id: Number(e.target.value) }))}>
                  {items.map(i => <option key={i.id} value={i.id}>{i.sku} — {i.name} (Stock: {i.stock_qty})</option>)}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem" }}>Transfer Qty *</label>
                  <input type="number" className="input" min="1" value={trfForm.quantity} onChange={e => setTrfForm(f => ({ ...f, quantity: Number(e.target.value) }))} />
                </div>
                <div>
                  <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem" }}>Transfer Date *</label>
                  <input type="date" className="input" value={trfForm.transfer_date} onChange={e => setTrfForm(f => ({ ...f, transfer_date: e.target.value }))} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem" }}>Notes / Vehicle Ref</label>
                <input type="text" className="input" placeholder="Dispatched via Truck #Ba 2 Pa 4021" value={trfForm.notes} onChange={e => setTrfForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "1.25rem" }}>
              <button className="btn btn-ghost" onClick={() => setShowTrfModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateTransfer} disabled={submitting}>Confirm Transfer</button>
            </div>
          </div>
        </div>
      )}

      {/* Transfers History Table */}
      <h2 style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.875rem" }}>Inter-Warehouse Movement History</h2>
      <div className="card" style={{ overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "3rem", display: "flex", justifyContent: "center" }}><div className="spinner" /></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th><th>Ref</th><th>From (Source)</th><th>To (Destination)</th><th>SKU / Product</th><th style={{ textAlign: "center" }}>Quantity</th><th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {transfers.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--text-faint)", padding: "2rem" }}>No stock transfers recorded yet.</td></tr>
              ) : (
                transfers.map(t => (
                  <tr key={t.id}>
                    <td>{t.transfer_date}</td>
                    <td><code style={{ fontSize: "0.75rem", color: "#818cf8" }}>{t.reference}</code></td>
                    <td>{t.from_warehouse}</td>
                    <td style={{ color: "#22c55e", fontWeight: 500 }}>{t.to_warehouse}</td>
                    <td style={{ fontWeight: 500 }}>{t.sku} — {t.item_name}</td>
                    <td style={{ textAlign: "center", fontWeight: 700, color: "#818cf8" }}>{t.quantity}</td>
                    <td className="text-muted">{t.notes || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
