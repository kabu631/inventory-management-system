"use client";
import { useEffect, useState, useCallback } from "react";
import { api, formatNPR } from "@/lib/api";
import { Truck, Plus, CheckCircle2, AlertCircle, ShoppingCart } from "lucide-react";

interface Supplier {
  id: number; name: string; contact_person: string; phone: string; email: string; address: string; pan_vat_no: string;
}
interface PurchaseOrder {
  id: number; po_number: string; po_date: string; supplier_name: string; status: string; total_amount_npr: number; payment_method: string; items_count: number;
}
interface InventorySKU {
  id: number; sku: string; name: string; import_cost_npr: number; stock_qty: number;
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [items, setItems] = useState<InventorySKU[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ text: "", type: "" });
  const [showAddSup, setShowAddSup] = useState(false);
  const [showPoModal, setShowPoModal] = useState(false);

  const [supForm, setSupForm] = useState({ name: "", contact_person: "", phone: "", email: "", address: "", pan_vat_no: "" });
  const [poForm, setPoForm] = useState({
    supplier_id: 0,
    po_date: new Date().toISOString().split("T")[0],
    payment_method: "BANK",
    notes: "",
    inventory_id: 0,
    quantity: 10,
    unit_cost_npr: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get<Supplier[]>("/api/suppliers/"),
      api.get<PurchaseOrder[]>("/api/suppliers/purchase-orders"),
      api.get<InventorySKU[]>("/api/inventory/"),
    ]).then(([s, p, i]) => {
      const safeS = Array.isArray(s) ? s : [];
      const safeP = Array.isArray(p) ? p : [];
      const safeI = Array.isArray(i) ? i : [];
      setSuppliers(safeS);
      setPos(safeP);
      setItems(safeI);
      if (safeS.length > 0) setPoForm(f => ({ ...f, supplier_id: safeS[0].id, inventory_id: safeI[0]?.id || 0 }));
    }).catch(e => {
      flash(e instanceof Error ? e.message : "Failed to load suppliers data", "error");
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (text: string, type: string) => { setMsg({ text, type }); setTimeout(() => setMsg({ text: "", type: "" }), 4000); };

  const handleAddSupplier = async () => {
    if (!supForm.name) return alert("Supplier name is required");
    setSubmitting(true);
    try {
      await api.post("/api/suppliers/", supForm);
      setShowAddSup(false);
      flash("Supplier profile created!", "success");
      load();
    } catch(e: unknown) { flash(e instanceof Error ? e.message : "Error", "error"); }
    finally { setSubmitting(false); }
  };

  const handleCreatePo = async () => {
    if (!poForm.supplier_id) return alert("Please select a supplier");
    if (!poForm.inventory_id) return alert("Please select a product SKU");
    if (poForm.quantity <= 0) return alert("Quantity must be at least 1");

    setSubmitting(true);
    try {
      const selectedSku = items.find(i => i.id === Number(poForm.inventory_id));
      const unitCost = poForm.unit_cost_npr ? Number(poForm.unit_cost_npr) : (selectedSku?.import_cost_npr || 0);

      const res = await api.post<{ status: string; message: string }>("/api/suppliers/purchase-orders", {
        supplier_id: Number(poForm.supplier_id),
        po_date: poForm.po_date,
        payment_method: poForm.payment_method,
        notes: poForm.notes,
        items: [
          {
            inventory_id: Number(poForm.inventory_id),
            quantity: Number(poForm.quantity),
            unit_cost_npr: unitCost,
          },
        ],
      });

      setShowPoModal(false);
      flash(res.message || "Purchase order received & stock updated!", "success");
      load();
    } catch(e: unknown) { flash(e instanceof Error ? e.message : "Error", "error"); }
    finally { setSubmitting(false); }
  };

  const selectedSku = items.find(i => i.id === Number(poForm.inventory_id));
  const calcUnitCost = poForm.unit_cost_npr ? Number(poForm.unit_cost_npr) : (selectedSku?.import_cost_npr || 0);
  const totalPoAmount = calcUnitCost * Number(poForm.quantity || 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Suppliers & Purchase Orders (PO)</h1>
          <p className="text-muted" style={{ fontSize: "0.875rem" }}>Vendor Directory, Bulk Stock Orders & Accounts Payable Management</p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button className="btn btn-ghost" onClick={() => setShowPoModal(true)} style={{ borderColor: "rgba(34,197,94,0.4)", color: "#22c55e" }}>
            <ShoppingCart size={16} /> New Purchase Order
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddSup(true)}>
            <Plus size={16} /> Add Supplier
          </button>
        </div>
      </div>

      {msg.text && (
        <div className={`alert ${msg.type === "success" ? "alert-success" : "alert-error"}`}>
          {msg.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}{msg.text}
        </div>
      )}

      {/* Add Supplier Form */}
      {showAddSup && (
        <div className="card" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
          <h2 style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "1rem" }}>Add Vendor / Supplier</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.75rem", marginBottom: "1rem" }}>
            <div>
              <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem" }}>Supplier Name *</label>
              <input type="text" className="input" placeholder="Neoteric Nepal / Nagmani International" value={supForm.name} onChange={e => setSupForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem" }}>Contact Person</label>
              <input type="text" className="input" placeholder="Sales Manager" value={supForm.contact_person} onChange={e => setSupForm(f => ({ ...f, contact_person: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem" }}>Phone Number</label>
              <input type="text" className="input" placeholder="+977 01-4400000" value={supForm.phone} onChange={e => setSupForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem" }}>Email Address</label>
              <input type="email" className="input" placeholder="sales@neoteric.com.np" value={supForm.email} onChange={e => setSupForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem" }}>PAN / VAT Number</label>
              <input type="text" className="input" placeholder="600123987" value={supForm.pan_vat_no} onChange={e => setSupForm(f => ({ ...f, pan_vat_no: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem" }}>Office Address</label>
              <input type="text" className="input" placeholder="Kathmandu, Nepal" value={supForm.address} onChange={e => setSupForm(f => ({ ...f, address: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
            <button className="btn btn-ghost" onClick={() => setShowAddSup(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAddSupplier} disabled={submitting}>Save Supplier</button>
          </div>
        </div>
      )}

      {/* New Purchase Order Modal */}
      {showPoModal && (
        <div className="modal-overlay">
          <div className="card" style={{ padding: "2rem", width: "540px", maxWidth: "90vw" }}>
            <h2 style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "1.25rem" }}>Create Purchase Order (PO)</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              <div>
                <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem" }}>Select Supplier *</label>
                {suppliers.length === 0 ? (
                  <p style={{ fontSize: "0.8rem", color: "#ef4444" }}>No suppliers found. Please add a supplier first.</p>
                ) : (
                  <select className="input" value={poForm.supplier_id} onChange={e => setPoForm(f => ({ ...f, supplier_id: Number(e.target.value) }))}>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.contact_person || "Vendor"})</option>)}
                  </select>
                )}
              </div>

              <div>
                <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem" }}>Select Product SKU *</label>
                <select className="input" value={poForm.inventory_id} onChange={e => setPoForm(f => ({ ...f, inventory_id: Number(e.target.value) }))}>
                  {items.map(i => <option key={i.id} value={i.id}>{i.sku} — {i.name} (Current Stock: {i.stock_qty})</option>)}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem" }}>Quantity to Order *</label>
                  <input type="number" className="input" min="1" value={poForm.quantity} onChange={e => setPoForm(f => ({ ...f, quantity: Number(e.target.value) }))} />
                </div>
                <div>
                  <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem" }}>Unit Import Cost (NPR)</label>
                  <input type="number" className="input" placeholder={selectedSku ? String(selectedSku.import_cost_npr) : "0"} value={poForm.unit_cost_npr} onChange={e => setPoForm(f => ({ ...f, unit_cost_npr: e.target.value }))} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem" }}>Payment Terms *</label>
                  <select className="input" value={poForm.payment_method} onChange={e => setPoForm(f => ({ ...f, payment_method: e.target.value }))}>
                    <option value="BANK">🏦 Bank Account (Bank Loan / Transfer)</option>
                    <option value="CASH">💵 Cash in Hand</option>
                    <option value="CREDIT">💳 Supplier Credit (Accounts Payable)</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem" }}>PO Date *</label>
                  <input type="date" className="input" value={poForm.po_date} onChange={e => setPoForm(f => ({ ...f, po_date: e.target.value }))} />
                </div>
              </div>

              <div style={{ padding: "0.875rem 1rem", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: "0.625rem" }}>
                <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Total PO Value</p>
                <p style={{ fontSize: "1.25rem", fontWeight: 700, color: "#22c55e" }}>{formatNPR(totalPoAmount)}</p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "1.25rem" }}>
              <button className="btn btn-ghost" onClick={() => setShowPoModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreatePo} disabled={submitting}>Issue PO & Receive Goods</button>
            </div>
          </div>
        </div>
      )}

      {/* Purchase Orders Table */}
      <h2 style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.875rem" }}>Purchase Orders (PO) History</h2>
      <div className="card" style={{ overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "3rem", display: "flex", justifyContent: "center" }}><div className="spinner" /></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>PO Number</th><th>Date</th><th>Supplier / Vendor</th><th>Status</th><th>Payment</th><th style={{ textAlign: "right" }}>Total Amount</th>
              </tr>
            </thead>
            <tbody>
              {pos.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text-faint)", padding: "2rem" }}>No purchase orders issued yet.</td></tr>
              ) : (
                pos.map(p => (
                  <tr key={p.id}>
                    <td><code style={{ fontSize: "0.75rem", color: "#818cf8" }}>{p.po_number}</code></td>
                    <td>{p.po_date}</td>
                    <td style={{ fontWeight: 500 }}>{p.supplier_name}</td>
                    <td><span className="badge badge-green">{p.status}</span></td>
                    <td className="text-muted">{p.payment_method}</td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: "#22c55e" }}>{formatNPR(p.total_amount_npr)}</td>
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
