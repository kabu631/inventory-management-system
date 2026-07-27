"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { ShieldCheck, Plus, CheckCircle2, AlertCircle, ShieldAlert, Barcode } from "lucide-react";

interface Serial {
  id: number; serial_number: string; sku: string; item_name: string; warehouse: string; purchase_date: string; warranty_months: number; warranty_expiry_date: string; status: string; customer_name: string; sale_invoice_ref: string; is_expired: boolean;
}
interface Claim {
  id: number; claim_date: string; serial_number: string; customer_name: string; issue_description: string; status: string; replacement_serial_number: string; notes: string;
}
interface InventorySKU {
  id: number; sku: string; name: string;
}

export default function WarrantyPage() {
  const [serials, setSerials] = useState<Serial[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [items, setItems] = useState<InventorySKU[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ text: "", type: "" });
  const [showRegModal, setShowRegModal] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);

  const [regForm, setRegForm] = useState({
    inventory_id: 0,
    serial_numbers_raw: "",
    purchase_date: new Date().toISOString().split("T")[0],
    warranty_months: 24,
  });
  const [claimForm, setClaimForm] = useState({
    serial_number: "",
    claim_date: new Date().toISOString().split("T")[0],
    issue_description: "",
    replacement_serial_number: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get<Serial[]>("/api/serials/"),
      api.get<Claim[]>("/api/serials/warranty-claims"),
      api.get<InventorySKU[]>("/api/inventory/"),
    ]).then(([s, c, i]) => {
      const safeS = Array.isArray(s) ? s : [];
      const safeC = Array.isArray(c) ? c : [];
      const safeI = Array.isArray(i) ? i : [];
      setSerials(safeS);
      setClaims(safeC);
      setItems(safeI);
      if (safeI.length > 0) setRegForm(f => ({ ...f, inventory_id: safeI[0].id }));
    }).catch(e => {
      flash(e instanceof Error ? e.message : "Failed to load warranty data", "error");
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (text: string, type: string) => { setMsg({ text, type }); setTimeout(() => setMsg({ text: "", type: "" }), 4000); };

  const handleRegisterSerials = async () => {
    if (!regForm.inventory_id) return alert("Select battery SKU");
    const sns = regForm.serial_numbers_raw.split("\n").map(s => s.trim()).filter(Boolean);
    if (sns.length === 0) return alert("Enter at least one serial number");

    setSubmitting(true);
    try {
      const res = await api.post<{ status: string; message: string }>("/api/serials/", {
        inventory_id: Number(regForm.inventory_id),
        serial_numbers: sns,
        purchase_date: regForm.purchase_date,
        warranty_months: Number(regForm.warranty_months),
      });
      setShowRegModal(false);
      flash(res.message || "Serials registered!", "success");
      load();
    } catch(e: unknown) { flash(e instanceof Error ? e.message : "Error", "error"); }
    finally { setSubmitting(false); }
  };

  const handleClaim = async () => {
    if (!claimForm.serial_number) return alert("Serial number required");
    if (!claimForm.issue_description) return alert("Provide issue description");

    setSubmitting(true);
    try {
      const res = await api.post<{ status: string; message: string }>("/api/serials/warranty-claims", claimForm);
      setShowClaimModal(false);
      flash(res.message || "Warranty claim submitted!", "success");
      load();
    } catch(e: unknown) { flash(e instanceof Error ? e.message : "Error", "error"); }
    finally { setSubmitting(false); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Battery Serial & Warranty Management</h1>
          <p className="text-muted" style={{ fontSize: "0.875rem" }}>Individual Battery Unit Tracking, Warranty Expiry & Defective Claim Processing</p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button className="btn btn-ghost" onClick={() => setShowClaimModal(true)} style={{ borderColor: "rgba(239,68,68,0.4)", color: "#ef4444" }}>
            <ShieldAlert size={16} /> Submit Warranty Claim
          </button>
          <button className="btn btn-primary" onClick={() => setShowRegModal(true)}>
            <Barcode size={16} /> Register Battery Serials
          </button>
        </div>
      </div>

      {msg.text && (
        <div className={`alert ${msg.type === "success" ? "alert-success" : "alert-error"}`}>
          {msg.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}{msg.text}
        </div>
      )}

      {/* Register Serials Modal */}
      {showRegModal && (
        <div className="modal-overlay">
          <div className="card" style={{ padding: "2rem", width: "500px", maxWidth: "90vw" }}>
            <h2 style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "1.25rem" }}>Register Battery Serial Numbers</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              <div>
                <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem" }}>Battery SKU *</label>
                <select className="input" value={regForm.inventory_id} onChange={e => setRegForm(f => ({ ...f, inventory_id: Number(e.target.value) }))}>
                  {items.map(i => <option key={i.id} value={i.id}>{i.sku} — {i.name}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem" }}>Serial Numbers (One per line) *</label>
                <textarea className="input" rows={4} placeholder="SN-LFP-2026-001&#10;SN-LFP-2026-002&#10;SN-LFP-2026-003" value={regForm.serial_numbers_raw} onChange={e => setRegForm(f => ({ ...f, serial_numbers_raw: e.target.value }))} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem" }}>Purchase Date *</label>
                  <input type="date" className="input" value={regForm.purchase_date} onChange={e => setRegForm(f => ({ ...f, purchase_date: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem" }}>Warranty Period (Months)</label>
                  <input type="number" className="input" value={regForm.warranty_months} onChange={e => setRegForm(f => ({ ...f, warranty_months: Number(e.target.value) }))} />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "1.25rem" }}>
              <button className="btn btn-ghost" onClick={() => setShowRegModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleRegisterSerials} disabled={submitting}>Register Serials</button>
            </div>
          </div>
        </div>
      )}

      {/* Claim Modal */}
      {showClaimModal && (
        <div className="modal-overlay">
          <div className="card" style={{ padding: "2rem", width: "500px", maxWidth: "90vw" }}>
            <h2 style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "1.25rem" }}>Process Battery Warranty Claim</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              <div>
                <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem" }}>Defective Serial Number *</label>
                <input type="text" className="input" placeholder="SN-LFP-2026-001" value={claimForm.serial_number} onChange={e => setClaimForm(f => ({ ...f, serial_number: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem" }}>Issue / Failure Description *</label>
                <input type="text" className="input" placeholder="BMS Cell Imbalance / Low Discharge Voltage" value={claimForm.issue_description} onChange={e => setClaimForm(f => ({ ...f, issue_description: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem" }}>Replacement Serial Number (Optional)</label>
                <input type="text" className="input" placeholder="SN-LFP-2026-099 (Leave blank if pending)" value={claimForm.replacement_serial_number} onChange={e => setClaimForm(f => ({ ...f, replacement_serial_number: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "1.25rem" }}>
              <button className="btn btn-ghost" onClick={() => setShowClaimModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleClaim} disabled={submitting}>Submit Claim</button>
            </div>
          </div>
        </div>
      )}

      {/* Serials Table */}
      <h2 style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.875rem" }}>Battery Serials Master Directory</h2>
      <div className="card" style={{ overflow: "hidden", marginBottom: "2rem" }}>
        {loading ? (
          <div style={{ padding: "3rem", display: "flex", justifyContent: "center" }}><div className="spinner" /></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Serial Number</th><th>Battery SKU</th><th>Location</th><th>Purchase Date</th><th>Warranty Expiry</th><th>Customer</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {serials.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--text-faint)", padding: "2rem" }}>No serial numbers registered yet.</td></tr>
              ) : (
                serials.map(s => (
                  <tr key={s.id}>
                    <td><code style={{ fontSize: "0.75rem", color: "#818cf8" }}>{s.serial_number}</code></td>
                    <td style={{ fontWeight: 500 }}>{s.sku} — {s.item_name}</td>
                    <td className="text-muted">{s.warehouse}</td>
                    <td>{s.purchase_date}</td>
                    <td style={{ color: s.is_expired ? "#ef4444" : "#22c55e", fontWeight: 600 }}>{s.warranty_expiry_date || "—"}</td>
                    <td>{s.customer_name}</td>
                    <td>
                      <span className={`badge ${s.status === "IN_STOCK" ? "badge-green" : (s.status === "SOLD" ? "badge-blue" : "badge-red")}`}>
                        {s.status}
                      </span>
                    </td>
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
