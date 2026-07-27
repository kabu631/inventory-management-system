"use client";
import { useEffect, useState, useCallback } from "react";
import { api, formatNPR, formatDate } from "@/lib/api";
import { Users, Search, Plus, FileText, X, ArrowRight, UserCheck, CreditCard } from "lucide-react";
import Link from "next/link";

interface Customer {
  id: number; name: string; phone: string; email: string; address?: string;
  customer_type: "B2B" | "B2C"; credit_limit: number;
  outstanding_balance_npr: number;
}

interface LedgerRow {
  line_id: number;
  entry_id: number;
  entry_date: string;
  reference: string;
  narration: string;
  debit_npr: number;
  credit_npr: number;
  balance_npr: number;
}

interface CustomerLedgerData {
  customer: {
    id: number; name: string; phone: string; email: string; address: string;
    customer_type: string; credit_limit: number;
    outstanding_balance_npr: number;
    total_billed_npr: number;
    total_paid_npr: number;
    total_transactions: number;
  };
  ledger: LedgerRow[];
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"ALL" | "B2B" | "B2C">("ALL");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name:"", phone:"", email:"", address:"", customer_type:"B2C", credit_limit:"0" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Customer Ledger Modal State
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [ledgerData, setLedgerData] = useState<CustomerLedgerData | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get<Customer[]>("/api/customers/")
      .then(setCustomers)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openLedgerModal = (customer: Customer) => {
    setSelectedCustomer(customer);
    setLedgerLoading(true);
    setLedgerData(null);
    api.get<CustomerLedgerData>(`/api/customers/${customer.id}/ledger`)
      .then(setLedgerData)
      .catch((e) => console.error("Failed to load customer ledger:", e))
      .finally(() => setLedgerLoading(false));
  };

  const closeLedgerModal = () => {
    setSelectedCustomer(null);
    setLedgerData(null);
  };

  const b2b = customers.filter(c => c.customer_type === "B2B");
  const b2c = customers.filter(c => c.customer_type === "B2C");
  const totalReceivable = customers.reduce((s, c) => s + c.outstanding_balance_npr, 0);

  const filtered = customers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone && c.phone.includes(search)) || (c.email && c.email.toLowerCase().includes(search.toLowerCase()));
    const matchesFilter = filter === "ALL" || c.customer_type === filter;
    return matchesSearch && matchesFilter;
  });

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      return setError("Customer name is required.");
    }
    setError(""); setSubmitting(true);
    try {
      await api.post("/api/customers/", { ...form, credit_limit: Number(form.credit_limit) });
      setShowForm(false);
      setForm({ name:"", phone:"", email:"", address:"", customer_type:"B2C", credit_limit:"0" });
      load();
    } catch(e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to add customer");
    } finally {
      setSubmitting(false);
    }
  };

  const FIELDS: [string, string, string][] = [
    ["name","Full Name *","Ram Bahadur Thapa"],
    ["phone","Phone","9841XXXXXX"],
    ["email","Email","ram@example.com"],
    ["address","Address","Kathmandu, Nepal"],
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="text-muted" style={{ fontSize: "0.875rem" }}>B2B &amp; B2C customer ledgers and transaction history</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)} id="add-customer-btn">
          <Plus size={16} /> Add Customer
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
        {[
          { label: "Total Receivable",            value: formatNPR(totalReceivable) },
          { label: `B2B Customers (${b2b.length})`, value: `${b2b.length} businesses` },
          { label: `B2C Customers (${b2c.length})`, value: `${b2c.length} individuals` },
        ].map(k => (
          <div key={k.label} className="kpi-card">
            <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>{k.label}</p>
            <p style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)", marginTop: "0.375rem" }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="card" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
          <h2 style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "1rem" }}>Add Customer</h2>
          {error && <div className="alert alert-error">{error}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.75rem", marginBottom: "1rem" }}>
            {FIELDS.map(([k, l, p]) => (
              <div key={k}>
                <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem" }}>{l}</label>
                <input type="text" className="input" placeholder={p}
                  value={form[k as keyof typeof form]}
                  onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} id={`cust-${k}`} />
              </div>
            ))}
            <div>
              <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem" }}>Type</label>
              <select className="input" value={form.customer_type} onChange={e => setForm(f => ({ ...f, customer_type: e.target.value }))} id="cust-type">
                <option value="B2C">B2C (Individual)</option>
                <option value="B2B">B2B (Business)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem" }}>Credit Limit (NPR)</label>
              <input type="number" className="input" placeholder="0"
                value={form.credit_limit} onChange={e => setForm(f => ({ ...f, credit_limit: e.target.value }))} id="cust-credit" />
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
            <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting} id="save-customer-btn">
              {submitting ? "Saving..." : "Save Customer"}
            </button>
          </div>
        </div>
      )}

      {/* Filters + Search */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={15} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input type="text" className="input" style={{ paddingLeft: "2.25rem" }}
            placeholder="Search by name, phone, email..." value={search} onChange={e => setSearch(e.target.value)} id="cust-search" />
        </div>
        {(["ALL", "B2B", "B2C"] as const).map(f => (
          <button key={f} className={`btn ${filter === f ? "btn-primary" : "btn-ghost"}`}
            style={{ minWidth: "4rem" }} onClick={() => setFilter(f)} id={`filter-${f}`}>{f}</button>
        ))}
      </div>

      {/* Customer Table */}
      <div className="card" style={{ overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "3rem", display: "flex", justifyContent: "center" }}><div className="spinner" /></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer Name</th>
                <th>Type</th>
                <th>Phone / Contact</th>
                <th style={{ textAlign: "right" }}>Credit Limit</th>
                <th style={{ textAlign: "right" }}>Outstanding Balance</th>
                <th style={{ textAlign: "center" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
                    No customers found. Click <strong>+ Add Customer</strong> to create one.
                  </td>
                </tr>
              ) : (
                filtered.map(c => (
                  <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => openLedgerModal(c)}>
                    <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "rgba(99,102,241,0.15)", color: "#818cf8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 700 }}>
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        {c.name}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${c.customer_type === "B2B" ? "badge-blue" : "badge-indigo"}`}>
                        {c.customer_type}
                      </span>
                    </td>
                    <td className="text-muted">{c.phone || "—"}</td>
                    <td style={{ textAlign: "right" }} className="text-muted">
                      {c.credit_limit > 0 ? formatNPR(c.credit_limit) : "—"}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: c.outstanding_balance_npr > 0 ? "#f59e0b" : "#22c55e" }}>
                      {formatNPR(c.outstanding_balance_npr)}
                    </td>
                    <td style={{ textAlign: "center" }} onClick={e => e.stopPropagation()}>
                      <button
                        className="btn btn-ghost"
                        onClick={() => openLedgerModal(c)}
                        style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
                        title="View complete transaction history for this customer"
                      >
                        View History →
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ── CUSTOMER TRANSACTION HISTORY & LEDGER MODAL ── */}
      {selectedCustomer && (
        <div className="modal-overlay" onClick={closeLedgerModal}>
          <div
            className="card"
            onClick={e => e.stopPropagation()}
            style={{
              width: "840px", maxWidth: "95vw",
              display: "flex", flexDirection: "column",
              maxHeight: "calc(100vh - 3rem)", margin: "auto",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1.25rem 1.75rem", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "0.5rem", background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <UserCheck size={20} color="#818cf8" />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
                      {selectedCustomer.name}
                    </h2>
                    <span className={`badge ${selectedCustomer.customer_type === "B2B" ? "badge-blue" : "badge-indigo"}`}>
                      {selectedCustomer.customer_type}
                    </span>
                  </div>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>
                    Phone: {selectedCustomer.phone || "N/A"} · Address: {selectedCustomer.address || "Nepal"}
                  </p>
                </div>
              </div>
              <button onClick={closeLedgerModal} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Modal Content */}
            <div style={{ overflowY: "auto", padding: "1.5rem 1.75rem", flex: 1 }}>
              {ledgerLoading ? (
                <div style={{ padding: "3rem", textAlign: "center" }}><div className="spinner" /></div>
              ) : ledgerData ? (
                <div>
                  {/* KPI Summary Banner */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
                    <div style={{ padding: "0.875rem 1rem", background: "var(--bg-card-child)", borderRadius: "0.625rem", border: "1px solid var(--border)" }}>
                      <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Total Billed</p>
                      <p style={{ fontSize: "1.2rem", fontWeight: 700, color: "#818cf8", marginTop: "2px" }}>
                        {formatNPR(ledgerData.customer.total_billed_npr)}
                      </p>
                    </div>
                    <div style={{ padding: "0.875rem 1rem", background: "var(--bg-card-child)", borderRadius: "0.625rem", border: "1px solid var(--border)" }}>
                      <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Total Received / Paid</p>
                      <p style={{ fontSize: "1.2rem", fontWeight: 700, color: "#22c55e", marginTop: "2px" }}>
                        {formatNPR(ledgerData.customer.total_paid_npr)}
                      </p>
                    </div>
                    <div style={{ padding: "0.875rem 1rem", background: "rgba(245,158,11,0.08)", borderRadius: "0.625rem", border: "1px solid rgba(245,158,11,0.25)" }}>
                      <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Outstanding Balance Due</p>
                      <p style={{ fontSize: "1.2rem", fontWeight: 700, color: ledgerData.customer.outstanding_balance_npr > 0 ? "#f59e0b" : "#22c55e", marginTop: "2px" }}>
                        {formatNPR(ledgerData.customer.outstanding_balance_npr)}
                      </p>
                    </div>
                  </div>

                  {/* Transaction Ledger Table */}
                  <h3 style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.75rem" }}>
                    Lifetime Transaction Ledger ({ledgerData.ledger.length} entries)
                  </h3>

                  {ledgerData.ledger.length === 0 ? (
                    <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem", background: "var(--bg-card-child)", borderRadius: "0.5rem", border: "1px solid var(--border)" }}>
                      No transaction records found for this customer yet.
                    </div>
                  ) : (
                    <div style={{ border: "1px solid var(--border)", borderRadius: "0.5rem", overflow: "hidden" }}>
                      <table className="data-table" style={{ fontSize: "0.8rem" }}>
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Reference / Invoice #</th>
                            <th>Description</th>
                            <th style={{ textAlign: "right" }}>Billed (Debit)</th>
                            <th style={{ textAlign: "right" }}>Paid (Credit)</th>
                            <th style={{ textAlign: "right" }}>Balance Due</th>
                            <th style={{ textAlign: "center" }}>Bill</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ledgerData.ledger.map((row) => (
                            <tr key={row.line_id}>
                              <td style={{ fontWeight: 500 }}>{row.entry_date}</td>
                              <td>
                                <span style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#818cf8", background: "rgba(99,102,241,0.1)", padding: "1px 6px", borderRadius: "4px" }}>
                                  {row.reference}
                                </span>
                              </td>
                              <td style={{ color: "var(--text-secondary)" }}>{row.narration}</td>
                              <td style={{ textAlign: "right", color: row.debit_npr > 0 ? "#818cf8" : "var(--text-muted)", fontWeight: row.debit_npr > 0 ? 600 : 400 }}>
                                {row.debit_npr > 0 ? formatNPR(row.debit_npr) : "—"}
                              </td>
                              <td style={{ textAlign: "right", color: row.credit_npr > 0 ? "#22c55e" : "var(--text-muted)", fontWeight: row.credit_npr > 0 ? 600 : 400 }}>
                                {row.credit_npr > 0 ? formatNPR(row.credit_npr) : "—"}
                              </td>
                              <td style={{ textAlign: "right", fontWeight: 700, color: row.balance_npr > 0 ? "#f59e0b" : "#22c55e" }}>
                                {formatNPR(row.balance_npr)}
                              </td>
                              <td style={{ textAlign: "center" }}>
                                <Link
                                  href={`/invoice?id=${row.entry_id}`}
                                  target="_blank"
                                  className="btn btn-ghost"
                                  style={{ padding: "2px 6px", fontSize: "0.7rem" }}
                                  title="View/Print Tax Invoice"
                                >
                                  Invoice 📄
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ color: "#ef4444", textAlign: "center" }}>Failed to load ledger data.</div>
              )}
            </div>

            {/* Footer */}
            <div style={{ display: "flex", justifyContent: "flex-end", padding: "1rem 1.75rem", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
              <button className="btn btn-ghost" onClick={closeLedgerModal}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
