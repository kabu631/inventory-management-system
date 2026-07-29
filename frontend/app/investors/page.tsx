"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { api, formatNPR, formatDate } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import {
  Users, Plus, Search, CheckCircle2, AlertCircle, ShieldAlert,
  TrendingUp, Landmark, Calendar, DollarSign, ChevronDown, ChevronUp, X, CreditCard,
  Lock, Unlock, Eye, EyeOff
} from "lucide-react";

// Password — same PIN as dashboard
const INVESTOR_PIN = process.env.NEXT_PUBLIC_DASHBOARD_PIN ?? "1234";

interface Investment {
  id: number;
  amount_npr: number;
  investment_date: string;
  payment_method: string;
  reference: string;
  notes: string;
}

interface Investor {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  total_invested_npr: number;
  investment_count: number;
  last_investment_date: string;
  created_at: string;
  investments: Investment[];
}

interface InvestorsSummary {
  total_capital_npr: number;
  total_investors: number;
  avg_investment_npr: number;
}

interface InvestorsApiResponse {
  summary: InvestorsSummary;
  investors: Investor[];
}

export default function InvestorsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [summary, setSummary] = useState<InvestorsSummary | null>(null);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Privacy lock state
  const [unlocked, setUnlocked] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [showPin, setShowPin] = useState(false);
  const pinRef = useRef<HTMLInputElement>(null);

  // Modals
  const [showAddInvestorModal, setShowAddInvestorModal] = useState(false);
  const [showAddInvestModal, setShowAddInvestModal] = useState(false);
  const [selectedInvestorId, setSelectedInvestorId] = useState<number>(0);

  // Alerts
  const [msg, setMsg] = useState({ text: "", type: "" });
  const [submitting, setSubmitting] = useState(false);

  // Add Investor Form
  const [investorForm, setInvestorForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
  });

  // Add Investment Form
  const [investForm, setInvestForm] = useState({
    amount_npr: "",
    investment_date: new Date().toISOString().split("T")[0],
    payment_method: "BANK",
    reference: "",
    notes: "",
  });

  const loadData = useCallback(() => {
    setLoading(true);
    api.get<InvestorsApiResponse>("/api/investors/")
      .then((res) => {
        setSummary(res.summary);
        setInvestors(res.investors);
        if (res.investors.length > 0 && selectedInvestorId === 0) {
          setSelectedInvestorId(res.investors[0].id);
        }
      })
      .catch((err) => {
        setMsg({ text: `Failed to load investors: ${err.message}`, type: "error" });
      })
      .finally(() => setLoading(false));
  }, [selectedInvestorId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-focus pin input when modal opens
  useEffect(() => {
    if (showPinModal) {
      setTimeout(() => pinRef.current?.focus(), 80);
    }
  }, [showPinModal]);

  // Privacy toggle
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
    if (pin === INVESTOR_PIN) {
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

  // Mask helper
  const mask = (val: string) => unlocked ? val : "••••••";

  // Handle Add Investor Submit
  const handleAddInvestorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!investorForm.name.trim()) return;
    setSubmitting(true);
    setMsg({ text: "", type: "" });

    try {
      await api.post("/api/investors/", {
        name: investorForm.name.trim(),
        phone: investorForm.phone || null,
        email: investorForm.email || null,
        address: investorForm.address || null,
        notes: investorForm.notes || null,
      });

      setMsg({ text: `Investor '${investorForm.name}' registered successfully!`, type: "success" });
      setInvestorForm({ name: "", phone: "", email: "", address: "", notes: "" });
      setShowAddInvestorModal(false);
      loadData();
    } catch (err: unknown) {
      const e = err as Error;
      setMsg({ text: e.message || "Failed to register investor", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Add Investment Submit
  const handleAddInvestmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvestorId || !investForm.amount_npr) return;
    setSubmitting(true);
    setMsg({ text: "", type: "" });

    try {
      await api.post(`/api/investors/${selectedInvestorId}/invest`, {
        amount_npr: parseFloat(investForm.amount_npr),
        investment_date: investForm.investment_date,
        payment_method: investForm.payment_method,
        reference: investForm.reference || null,
        notes: investForm.notes || null,
      });

      setMsg({ text: "Investment capital injection recorded successfully!", type: "success" });
      setInvestForm({
        amount_npr: "",
        investment_date: new Date().toISOString().split("T")[0],
        payment_method: "BANK",
        reference: "",
        notes: "",
      });
      setShowAddInvestModal(false);
      loadData();
    } catch (err: unknown) {
      const e = err as Error;
      setMsg({ text: e.message || "Failed to record investment", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // RBAC protection check
  if (user && !isAdmin) {
    return (
      <div style={{ padding: "4rem", textAlign: "center" }}>
        <div style={{ display: "inline-flex", padding: "1rem", borderRadius: "50%", background: "rgba(239, 68, 68, 0.1)", marginBottom: "1rem" }}>
          <ShieldAlert size={36} color="#ef4444" />
        </div>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)" }}>Admin &amp; Investor Access Required</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "0.5rem", maxWidth: "420px", margin: "0.5rem auto 1.5rem" }}>
          Investor equity capital details and shareholder records are restricted strictly to company administrators and investors.
        </p>
        <Link href="/inventory" className="btn btn-primary">Go to Product Sales &amp; Catalog</Link>
      </div>
    );
  }

  const filteredInvestors = investors.filter((inv) =>
    inv.name.toLowerCase().includes(search.toLowerCase()) ||
    inv.email.toLowerCase().includes(search.toLowerCase()) ||
    inv.phone.includes(search)
  );

  // Shared blur style for financial values
  const blurStyle = {
    filter: unlocked ? "none" : "blur(7px)",
    userSelect: (unlocked ? "auto" : "none") as React.CSSProperties["userSelect"],
    transition: "filter 0.3s ease",
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Company Investors &amp; Capital Records</h1>
          <p className="text-muted" style={{ fontSize: "0.875rem", marginTop: "0.25rem" }}>
            Track Investor Capital Contributions &amp; Flexible Funding Records
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          {/* Privacy toggle */}
          <button
            id="investor-privacy-toggle"
            onClick={openLockModal}
            title={unlocked ? "Click to lock investor financials" : "Click to reveal investor financials"}
            style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              padding: "0.5rem 1rem",
              borderRadius: "0.625rem",
              border: `1px solid ${unlocked ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}`,
              background: unlocked ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
              color: unlocked ? "#22c55e" : "#ef4444",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.8rem",
              transition: "all 0.2s ease",
            }}
          >
            {unlocked ? <Unlock size={15} /> : <Lock size={15} />}
            {unlocked ? "Lock Financials" : "Unlock Financials"}
          </button>

          <button
            className="btn btn-ghost"
            onClick={() => setShowAddInvestModal(true)}
            style={{ borderColor: "rgba(34,197,94,0.4)", color: "#22c55e" }}
          >
            <DollarSign size={16} /> Record Capital Investment
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddInvestorModal(true)}>
            <Plus size={16} /> Add Investor
          </button>
        </div>
      </div>

      {/* Alert Msg */}
      {msg.text && (
        <div className={`alert ${msg.type === "success" ? "alert-success" : "alert-error"}`} style={{ marginBottom: "1.5rem" }}>
          {msg.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {msg.text}
        </div>
      )}

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1.25rem", marginBottom: "1.75rem" }}>
        {[
          { label: "Total Capital Invested", value: mask(summary ? formatNPR(summary.total_capital_npr) : "Rs. 0"), color: "#6366f1", icon: TrendingUp },
          { label: "Total Investors", value: `${summary?.total_investors || 0} Investors`, color: "#22c55e", icon: Users },
          { label: "Avg Investment / Investor", value: mask(summary ? formatNPR(summary.avg_investment_npr) : "Rs. 0"), color: "#3b82f6", icon: Landmark },
        ].map((k) => (
          <div key={k.label} className="kpi-card glow-indigo" style={{ position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>{k.label}</p>
                <p style={{
                  fontSize: "1.35rem", fontWeight: 700, color: "var(--text-primary)", marginTop: "0.375rem",
                  ...blurStyle,
                }}>{k.value}</p>
              </div>
              <div style={{ padding: "0.5rem", borderRadius: "0.5rem", background: `${k.color}18`, border: `1px solid ${k.color}30` }}>
                <k.icon size={20} color={k.color} />
              </div>
            </div>

            {/* Lock overlay hint */}
            {!unlocked && (
              <button
                onClick={openLockModal}
                style={{
                  position: "absolute", inset: 0,
                  background: "transparent",
                  border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  borderRadius: "inherit",
                }}
                title="Click to unlock investor financials"
              />
            )}
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: "1.25rem" }}>
        <Search size={15} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
        <input
          type="text"
          className="input"
          style={{ paddingLeft: "2.25rem" }}
          placeholder="Search investor by name, email, or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Investors Directory Table */}
      <div className="card" style={{ overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "3rem", display: "flex", justifyContent: "center" }}><div className="spinner" /></div>
        ) : filteredInvestors.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
            No investors found matching your search.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Investor Name</th>
                <th>Contact Details</th>
                <th style={{ textAlign: "right" }}>Total Invested (NPR)</th>
                <th style={{ textAlign: "center" }}>Investment Rounds</th>
                <th>Last Investment Date</th>
                <th style={{ textAlign: "center" }}>History</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvestors.map((inv) => {
                const isExpanded = expandedId === inv.id;
                return (
                  <tr key={inv.id} style={{ cursor: "pointer" }} onClick={() => setExpandedId(isExpanded ? null : inv.id)}>
                    <td>
                      <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{inv.name}</div>
                      {inv.notes && <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{inv.notes}</div>}
                    </td>
                    <td>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{inv.phone}</div>
                      {inv.email && <div style={{ fontSize: "0.75rem", color: "#818cf8" }}>{inv.email}</div>}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: "#22c55e", fontSize: "0.95rem", ...blurStyle }}>
                      {mask(formatNPR(inv.total_invested_npr))}
                    </td>
                    <td style={{ textAlign: "center", fontWeight: 600 }}>
                      <span className="badge badge-indigo">{inv.investment_count} Investments</span>
                    </td>
                    <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      {inv.last_investment_date ? formatDate(inv.last_investment_date) : "N/A"}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button
                        className="btn btn-ghost"
                        style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem", color: "#818cf8" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedId(isExpanded ? null : inv.id);
                        }}
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Expanded Investment Records Ledger */}
      {expandedId !== null && (
        <div className="card" style={{ marginTop: "1.5rem", padding: "1.5rem" }}>
          {(() => {
            const currentInv = investors.find((i) => i.id === expandedId);
            if (!currentInv) return null;
            return (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <div>
                    <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>
                      💼 Investment Records — {currentInv.name}
                    </h3>
                    <p style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                      Total Invested: <strong style={{ color: "#22c55e", ...blurStyle }}>{mask(formatNPR(currentInv.total_invested_npr))}</strong> ({currentInv.investment_count} contributions)
                    </p>
                  </div>
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      setSelectedInvestorId(currentInv.id);
                      setShowAddInvestModal(true);
                    }}
                    style={{ borderColor: "rgba(34,197,94,0.4)", color: "#22c55e" }}
                  >
                    <Plus size={14} /> Add Capital Contribution
                  </button>
                </div>

                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Method</th>
                      <th>Reference / Txn ID</th>
                      <th style={{ textAlign: "right" }}>Amount (NPR)</th>
                      <th>Notes / Purpose</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentInv.investments.map((rec) => (
                      <tr key={rec.id}>
                        <td><Calendar size={13} style={{ marginRight: 4, display: "inline" }} />{formatDate(rec.investment_date)}</td>
                        <td><span className="badge badge-indigo">{rec.payment_method}</span></td>
                        <td><code style={{ fontSize: "0.75rem", color: "#818cf8" }}>{rec.reference || `REC-${rec.id}`}</code></td>
                        <td style={{ textAlign: "right", fontWeight: 700, color: "#22c55e", ...blurStyle }}>{mask(formatNPR(rec.amount_npr))}</td>
                        <td style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>{rec.notes || "Capital Contribution"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      )}

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
                Unlock Investor Financials
              </h3>
              <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.375rem" }}>
                Enter admin password to reveal capital records
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

      {/* Modal 1: Add New Investor */}
      {showAddInvestorModal && (
        <div className="modal-overlay" onClick={() => setShowAddInvestorModal(false)}>
          <div className="modal" style={{ maxWidth: "500px" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.75rem" }}>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Register New Investor</h2>
              <button className="btn btn-ghost" onClick={() => setShowAddInvestorModal(false)} style={{ padding: "0.25rem" }}><X size={18} /></button>
            </div>
            <form onSubmit={handleAddInvestorSubmit}>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: "0.82rem", marginBottom: "0.35rem", display: "block" }}>Investor Full Name *</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Ramesh Kumar Adhikari"
                    value={investorForm.name}
                    onChange={(e) => setInvestorForm({ ...investorForm, name: e.target.value })}
                    required
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: "0.82rem", marginBottom: "0.35rem", display: "block" }}>Phone Number</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="9851000000"
                      value={investorForm.phone}
                      onChange={(e) => setInvestorForm({ ...investorForm, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: "0.82rem", marginBottom: "0.35rem", display: "block" }}>Email Address</label>
                    <input
                      type="email"
                      className="input"
                      placeholder="investor@renewgen.com"
                      value={investorForm.email}
                      onChange={(e) => setInvestorForm({ ...investorForm, email: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: "0.82rem", marginBottom: "0.35rem", display: "block" }}>Address / Location</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Kathmandu, Nepal"
                    value={investorForm.address}
                    onChange={(e) => setInvestorForm({ ...investorForm, address: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: "0.82rem", marginBottom: "0.35rem", display: "block" }}>Investor Notes / Designation</label>
                  <textarea
                    className="input"
                    style={{ height: "65px", resize: "none" }}
                    placeholder="Founding Partner, Angel Investor, Financial Backer..."
                    value={investorForm.notes}
                    onChange={(e) => setInvestorForm({ ...investorForm, notes: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1.5rem", paddingTop: "0.75rem", borderTop: "1px solid var(--border)" }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowAddInvestorModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? "Registering..." : "Register Investor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Record Capital Investment */}
      {showAddInvestModal && (
        <div className="modal-overlay" onClick={() => setShowAddInvestModal(false)}>
          <div className="modal" style={{ maxWidth: "520px" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.75rem" }}>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Record Capital Investment Contribution</h2>
              <button className="btn btn-ghost" onClick={() => setShowAddInvestModal(false)} style={{ padding: "0.25rem" }}><X size={18} /></button>
            </div>
            <form onSubmit={handleAddInvestmentSubmit}>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: "0.82rem", marginBottom: "0.35rem", display: "block" }}>Select Investor *</label>
                  <select
                    className="input"
                    value={selectedInvestorId}
                    onChange={(e) => setSelectedInvestorId(Number(e.target.value))}
                    required
                  >
                    {investors.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: "0.82rem", marginBottom: "0.35rem", display: "block" }}>Investment Amount (NPR) *</label>
                    <input
                      type="number"
                      className="input"
                      placeholder="e.g. 2500000"
                      value={investForm.amount_npr}
                      onChange={(e) => setInvestForm({ ...investForm, amount_npr: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: "0.82rem", marginBottom: "0.35rem", display: "block" }}>Investment Date *</label>
                    <input
                      type="date"
                      className="input"
                      value={investForm.investment_date}
                      onChange={(e) => setInvestForm({ ...investForm, investment_date: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: "0.82rem", marginBottom: "0.35rem", display: "block" }}>Payment Method</label>
                    <select
                      className="input"
                      value={investForm.payment_method}
                      onChange={(e) => setInvestForm({ ...investForm, payment_method: e.target.value })}
                    >
                      <option value="BANK">Bank Deposit / Wire</option>
                      <option value="CASH">Cash Deposit</option>
                      <option value="CHEQUE">Bank Cheque</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: "0.82rem", marginBottom: "0.35rem", display: "block" }}>Bank Reference / Txn ID</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. NBL-TXN-9981"
                      value={investForm.reference}
                      onChange={(e) => setInvestForm({ ...investForm, reference: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: "0.82rem", marginBottom: "0.35rem", display: "block" }}>Investment Purpose / Round Notes</label>
                  <textarea
                    className="input"
                    style={{ height: "65px", resize: "none" }}
                    placeholder="Series-A Round, New Warehouse Funding, Working Capital..."
                    value={investForm.notes}
                    onChange={(e) => setInvestForm({ ...investForm, notes: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1.5rem", paddingTop: "0.75rem", borderTop: "1px solid var(--border)" }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowAddInvestModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting} style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", border: "none" }}>
                  {submitting ? "Processing..." : "Record Investment & Post Ledger"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
