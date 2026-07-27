"use client";
import { useEffect, useState, useCallback } from "react";
import { api, formatNPR, formatDate } from "@/lib/api";
import { Landmark, Plus, X, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Edit3, Trash2 } from "lucide-react";

interface LoanSummary {
  id: number; bank_name: string; loan_account_no: string;
  principal_npr: number; annual_interest_rate: number;
  disbursement_date: string; due_date: string; is_closed: boolean; purpose: string;
  accrued_interest_npr: number; outstanding_principal_npr: number;
  outstanding_interest_npr: number; total_outstanding_npr: number;
  principal_paid_npr: number; interest_paid_npr: number; repayment_count: number;
  repayments?: Array<{ id: number; payment_date: string; principal_paid_npr: number; interest_paid_npr: number; total_paid_npr: number; notes: string; }>;
}
interface AggregateSummary {
  active_loans: number; total_principal_npr: number;
  total_accrued_interest_npr: number; total_outstanding_npr: number;
}

export default function LoansPage() {
  const [loans, setLoans] = useState<LoanSummary[]>([]);
  const [agg, setAgg] = useState<AggregateSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [repayModal, setRepayModal] = useState<LoanSummary | null>(null);
  const [editRepayModal, setEditRepayModal] = useState<{ id: number; loanId: number; payment_date: string; principal_paid_npr: string; interest_paid_npr: string; notes: string } | null>(null);
  const [editLoanModal, setEditLoanModal] = useState<LoanSummary | null>(null);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [msg, setMsg] = useState({ text: "", type: "" });

  const [loanForm, setLoanForm] = useState({ bank_name:"", loan_account_no:"", principal_npr:"", annual_interest_rate:"10", disbursement_date:"", due_date:"", purpose:"" });
  const [editLoanForm, setEditLoanForm] = useState({ bank_name:"", loan_account_no:"", principal_npr:"", annual_interest_rate:"10", disbursement_date:"", due_date:"", purpose:"" });
  const [repForm, setRepForm] = useState({ payment_date: new Date().toISOString().split("T")[0], principal_paid_npr:"", interest_paid_npr:"", notes:"" });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.get<LoanSummary[]>("/api/loans/"), api.get<AggregateSummary>("/api/loans/summary")])
      .then(([l, a]) => { setLoans(l); setAgg(a); }).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const flash = (text: string, type: string) => { setMsg({ text, type }); setTimeout(() => setMsg({ text:"", type:"" }), 4000); };

  const addLoan = async () => {
    setSubmitting(true);
    try {
      await api.post("/api/loans/", { ...loanForm, principal_npr: Number(loanForm.principal_npr), annual_interest_rate: Number(loanForm.annual_interest_rate) });
      setShowAddForm(false); flash("Loan added & bank balance updated successfully!", "success"); load();
    } catch(e: unknown) { flash(e instanceof Error ? e.message : "Error", "error"); }
    finally { setSubmitting(false); }
  };

  const handleUpdateLoan = async () => {
    if (!editLoanModal) return; setSubmitting(true);
    try {
      await api.patch(`/api/loans/${editLoanModal.id}`, {
        ...editLoanForm,
        principal_npr: Number(editLoanForm.principal_npr),
        annual_interest_rate: Number(editLoanForm.annual_interest_rate),
      });
      setEditLoanModal(null); flash("Loan details updated successfully!", "success"); load();
    } catch(e: unknown) { flash(e instanceof Error ? e.message : "Error", "error"); }
    finally { setSubmitting(false); }
  };

  const addRepayment = async () => {
    if (!repayModal) return; setSubmitting(true);
    try {
      await api.post(`/api/loans/${repayModal.id}/repayments`, { ...repForm, principal_paid_npr: Number(repForm.principal_paid_npr), interest_paid_npr: Number(repForm.interest_paid_npr) });
      setRepayModal(null); flash("Repayment recorded & journal entry posted!", "success"); load();
    } catch(e: unknown) { flash(e instanceof Error ? e.message : "Error", "error"); }
    finally { setSubmitting(false); }
  };

  const handleUpdateRepayment = async () => {
    if (!editRepayModal) return; setSubmitting(true);
    try {
      await api.patch(`/api/loans/repayments/${editRepayModal.id}`, {
        payment_date: editRepayModal.payment_date,
        principal_paid_npr: Number(editRepayModal.principal_paid_npr),
        interest_paid_npr: Number(editRepayModal.interest_paid_npr),
        notes: editRepayModal.notes,
      });
      const targetLoan = loans.find(l => l.id === editRepayModal.loanId);
      setEditRepayModal(null);
      flash("Repayment amount updated & ledger adjusted successfully!", "success");
      if (targetLoan) toggleExpand(targetLoan, true);
      load();
    } catch(e: unknown) { flash(e instanceof Error ? e.message : "Error", "error"); }
    finally { setSubmitting(false); }
  };

  const handleDeleteRepayment = async (repaymentId: number, loan: LoanSummary) => {
    if (!confirm("Are you sure you want to delete this repayment record? Associated journal entry will be removed.")) return;
    try {
      await api.delete(`/api/loans/repayments/${repaymentId}`);
      flash("Repayment deleted & ledger adjusted!", "success");
      toggleExpand(loan, true);
      load();
    } catch(e: unknown) { flash(e instanceof Error ? e.message : "Error", "error"); }
  };

  const toggleExpand = async (loan: LoanSummary, forceRefresh = false) => {
    if (expandedId === loan.id && !forceRefresh) { setExpandedId(null); return; }
    const detail = await api.get<LoanSummary>(`/api/loans/${loan.id}`);
    setLoans(prev => prev.map(l => l.id === loan.id ? { ...l, repayments: detail.repayments } : l));
    setExpandedId(loan.id);
  };

  const pctPaid = (loan: LoanSummary) => Math.min((loan.principal_paid_npr / loan.principal_npr) * 100, 100);

  const LOAN_FIELDS: [string, string, string][] = [
    ["bank_name","Bank Name *","Nepal Bank Limited"], ["loan_account_no","Account No","NBL-2024-001"],
    ["principal_npr","Principal (NPR) *","2000000"], ["annual_interest_rate","Interest Rate %","10"],
    ["disbursement_date","Disbursement Date",""], ["due_date","Due Date",""], ["purpose","Purpose","Working capital"],
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Bank Loans</h1>
          <p className="text-muted" style={{ fontSize: "0.875rem" }}>Bank Loan Principal, Repayment & Repayment Amount Editing</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddForm(true)} id="add-loan-btn">
          <Plus size={16} /> Add Loan
        </button>
      </div>

      {msg.text && (
        <div className={`alert ${msg.type === "success" ? "alert-success" : "alert-error"}`}>
          {msg.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}{msg.text}
        </div>
      )}

      {/* Aggregate */}
      {agg && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
          {[
            { label: "Active Loans",           value: `${agg.active_loans}` },
            { label: "Total Principal",         value: formatNPR(agg.total_principal_npr) },
            { label: "Accrued Interest",        value: formatNPR(agg.total_accrued_interest_npr) },
            { label: "Total Outstanding",       value: formatNPR(agg.total_outstanding_npr) },
          ].map(k => (
            <div key={k.label} className="kpi-card glow-indigo">
              <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>{k.label}</p>
              <p style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-primary)", marginTop: "0.375rem" }}>{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Add Loan Form */}
      {showAddForm && (
        <div className="card" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
            <h2 style={{ fontWeight: 600, color: "var(--text-primary)" }}>Add Bank Loan</h2>
            <button onClick={() => setShowAddForm(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={18} /></button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.75rem", marginBottom: "1rem" }}>
            {LOAN_FIELDS.map(([k, l, p]) => (
              <div key={k}>
                <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem" }}>{l}</label>
                <input
                  type={k.includes("date") ? "date" : k.includes("npr") || k.includes("rate") ? "number" : "text"}
                  className="input" placeholder={p}
                  value={loanForm[k as keyof typeof loanForm]}
                  onChange={e => setLoanForm(f => ({ ...f, [k]: e.target.value }))} id={`loan-${k}`}
                />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
            <button className="btn btn-ghost" onClick={() => setShowAddForm(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={addLoan} disabled={submitting} id="save-loan-btn">
              {submitting ? "Saving..." : "Add Loan"}
            </button>
          </div>
        </div>
      )}

      {/* Loans List */}
      {loading ? (
        <div style={{ padding: "3rem", display: "flex", justifyContent: "center" }}><div className="spinner" /></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {loans.map(loan => (
            <div key={loan.id} className="card" style={{ padding: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                    <Landmark size={16} color="#6366f1" />
                    <h3 style={{ fontWeight: 700, color: "var(--text-primary)" }}>{loan.bank_name}</h3>
                    {loan.is_closed ? <span className="badge badge-green">Closed</span> : <span className="badge badge-amber">Active</span>}
                    {loan.loan_account_no && <code style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{loan.loan_account_no}</code>}
                    <button
                      onClick={() => {
                        setEditLoanModal(loan);
                        setEditLoanForm({
                          bank_name: loan.bank_name,
                          loan_account_no: loan.loan_account_no || "",
                          principal_npr: String(loan.principal_npr),
                          annual_interest_rate: String(loan.annual_interest_rate),
                          disbursement_date: loan.disbursement_date || "",
                          due_date: loan.due_date || "",
                          purpose: loan.purpose || "",
                        });
                      }}
                      style={{ background: "none", border: "none", color: "#818cf8", cursor: "pointer", display: "flex", alignItems: "center", gap: "3px", fontSize: "0.75rem" }}
                      title="Edit Loan Principal or Interest Rate"
                    >
                      <Edit3 size={13} /> Edit Loan
                    </button>
                  </div>
                  <p className="text-muted" style={{ fontSize: "0.8rem", marginBottom: "1rem" }}>{loan.purpose}</p>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "1rem" }}>
                    {[
                      ["Principal",        formatNPR(loan.principal_npr),                                      "var(--text-primary)"],
                      ["Accrued Interest", formatNPR(loan.accrued_interest_npr),                               "#f59e0b"],
                      ["Total Outstanding",formatNPR(loan.total_outstanding_npr),                              "#ef4444"],
                      ["Paid So Far",      formatNPR(loan.principal_paid_npr + loan.interest_paid_npr),        "#22c55e"],
                    ].map(([l, v, c]) => (
                      <div key={l}>
                        <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{l}</p>
                        <p style={{ fontWeight: 700, color: c, fontSize: "1rem", marginTop: "2px" }}>{v}</p>
                      </div>
                    ))}
                  </div>

                  {/* Progress bar */}
                  <div style={{ marginTop: "0.875rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "4px" }}>
                      <span>Principal repaid</span><span>{pctPaid(loan).toFixed(1)}%</span>
                    </div>
                    <div style={{ height: "6px", background: "var(--border)", borderRadius: "999px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pctPaid(loan)}%`, background: "linear-gradient(90deg, #6366f1, #22c55e)", borderRadius: "999px", transition: "width 0.5s ease" }} />
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginLeft: "1.5rem", flexShrink: 0 }}>
                  <div style={{ textAlign: "right", fontSize: "0.72rem", color: "var(--text-muted)" }}>
                    <div>Disbursed: {formatDate(loan.disbursement_date)}</div>
                    {loan.due_date && <div>Due: {formatDate(loan.due_date)}</div>}
                    <div>{loan.annual_interest_rate}% p.a. simple</div>
                  </div>
                  {!loan.is_closed && (
                    <button className="btn btn-primary" style={{ fontSize: "0.78rem" }}
                      onClick={() => { setRepayModal(loan); setRepForm({ payment_date: new Date().toISOString().split("T")[0], principal_paid_npr:"", interest_paid_npr:"", notes:"" }); }}
                      id={`repay-${loan.id}`}>
                      Record Repayment
                    </button>
                  )}
                  <button className="btn btn-ghost" style={{ fontSize: "0.75rem" }}
                    onClick={() => toggleExpand(loan)} id={`expand-${loan.id}`}>
                    {expandedId === loan.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    History ({loan.repayment_count})
                  </button>
                </div>
              </div>

              {/* Repayment history */}
              {expandedId === loan.id && loan.repayments && (
                <div style={{ marginTop: "1.25rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.625rem" }}>Repayment History</p>
                  {loan.repayments.length === 0 ? (
                    <p style={{ fontSize: "0.8rem", color: "var(--text-faint)" }}>No repayments recorded yet.</p>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th style={{ textAlign:"right" }}>Principal</th>
                          <th style={{ textAlign:"right" }}>Interest</th>
                          <th style={{ textAlign:"right" }}>Total Paid</th>
                          <th>Notes</th>
                          <th style={{ textAlign:"center" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loan.repayments.map(r => (
                          <tr key={r.id}>
                            <td>{formatDate(r.payment_date)}</td>
                            <td style={{ textAlign:"right" }}>{formatNPR(r.principal_paid_npr)}</td>
                            <td style={{ textAlign:"right", color:"#f59e0b" }}>{formatNPR(r.interest_paid_npr)}</td>
                            <td style={{ textAlign:"right", fontWeight:600 }}>{formatNPR(r.total_paid_npr)}</td>
                            <td className="text-muted">{r.notes || "—"}</td>
                            <td style={{ textAlign:"center" }}>
                              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
                                <button
                                  className="btn btn-ghost"
                                  style={{ fontSize: "0.7rem", padding: "0.2rem 0.4rem", color: "#818cf8" }}
                                  onClick={() => setEditRepayModal({
                                    id: r.id,
                                    loanId: loan.id,
                                    payment_date: r.payment_date,
                                    principal_paid_npr: String(r.principal_paid_npr),
                                    interest_paid_npr: String(r.interest_paid_npr),
                                    notes: r.notes || "",
                                  })}
                                  title="Edit Repayment Amount"
                                  id={`edit-rep-${r.id}`}
                                >
                                  <Edit3 size={12} /> Edit
                                </button>
                                <button
                                  className="btn btn-ghost"
                                  style={{ fontSize: "0.7rem", padding: "0.2rem 0.4rem", color: "#ef4444" }}
                                  onClick={() => handleDeleteRepayment(r.id, loan)}
                                  title="Delete Repayment"
                                  id={`del-rep-${r.id}`}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Record Repayment Modal */}
      {repayModal && (
        <div className="modal-overlay">
          <div className="card" style={{ padding: "2rem", width: "460px", maxWidth: "90vw" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.25rem" }}>
              <h2 style={{ fontWeight: 600, color: "var(--text-primary)" }}>Record Repayment</h2>
              <button onClick={() => setRepayModal(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={18} /></button>
            </div>
            <p className="text-muted" style={{ fontSize: "0.8rem", marginBottom: "1rem" }}>
              {repayModal.bank_name} · Outstanding: <strong style={{ color: "var(--text-primary)" }}>{formatNPR(repayModal.total_outstanding_npr)}</strong>
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              {[["payment_date","Payment Date","date"],["principal_paid_npr","Principal Amount (NPR)","number"],["interest_paid_npr","Interest Amount (NPR)","number"],["notes","Notes","text"]].map(([k,l,t]) => (
                <div key={k}>
                  <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem" }}>{l}</label>
                  <input type={t} className="input" value={repForm[k as keyof typeof repForm]} onChange={e => setRepForm(f => ({ ...f, [k]: e.target.value }))} id={`rep-${k}`} />
                </div>
              ))}
            </div>
            {Number(repForm.principal_paid_npr) + Number(repForm.interest_paid_npr) > 0 && (
              <div style={{ marginTop: "0.875rem", padding: "0.75rem", background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: "0.5rem", fontSize: "0.8rem", color: "#818cf8" }}>
                Total payment: <strong>{formatNPR(Number(repForm.principal_paid_npr) + Number(repForm.interest_paid_npr))}</strong>
                <br /><span className="text-muted" style={{ fontSize: "0.72rem" }}>A journal entry will be auto-posted to the ledger.</span>
              </div>
            )}
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "1.25rem" }}>
              <button className="btn btn-ghost" onClick={() => setRepayModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={addRepayment} disabled={submitting} id="confirm-repayment-btn">
                {submitting ? "Processing..." : "Confirm & Post"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Repayment Amount Modal */}
      {editRepayModal && (
        <div className="modal-overlay">
          <div className="card" style={{ padding: "2rem", width: "460px", maxWidth: "90vw" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.25rem" }}>
              <h2 style={{ fontWeight: 600, color: "var(--text-primary)" }}>Edit Repayment Amount</h2>
              <button onClick={() => setEditRepayModal(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={18} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              <div>
                <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem" }}>Payment Date</label>
                <input
                  type="date" className="input"
                  value={editRepayModal.payment_date}
                  onChange={e => setEditRepayModal(m => m ? ({ ...m, payment_date: e.target.value }) : null)}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem" }}>Principal Amount (NPR)</label>
                <input
                  type="number" className="input"
                  value={editRepayModal.principal_paid_npr}
                  onChange={e => setEditRepayModal(m => m ? ({ ...m, principal_paid_npr: e.target.value }) : null)}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem" }}>Interest Amount (NPR)</label>
                <input
                  type="number" className="input"
                  value={editRepayModal.interest_paid_npr}
                  onChange={e => setEditRepayModal(m => m ? ({ ...m, interest_paid_npr: e.target.value }) : null)}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem" }}>Notes</label>
                <input
                  type="text" className="input"
                  value={editRepayModal.notes}
                  onChange={e => setEditRepayModal(m => m ? ({ ...m, notes: e.target.value }) : null)}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "1.25rem" }}>
              <button className="btn btn-ghost" onClick={() => setEditRepayModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleUpdateRepayment} disabled={submitting}>
                {submitting ? "Updating..." : "Save Corrected Amount"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Loan Details Modal */}
      {editLoanModal && (
        <div className="modal-overlay">
          <div className="card" style={{ padding: "2rem", width: "500px", maxWidth: "90vw" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.25rem" }}>
              <h2 style={{ fontWeight: 600, color: "var(--text-primary)" }}>Edit Loan Details</h2>
              <button onClick={() => setEditLoanModal(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={18} /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              {LOAN_FIELDS.map(([k, l]) => (
                <div key={k}>
                  <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem" }}>{l}</label>
                  <input
                    type={k.includes("date") ? "date" : k.includes("npr") || k.includes("rate") ? "number" : "text"}
                    className="input"
                    value={editLoanForm[k as keyof typeof editLoanForm]}
                    onChange={e => setEditLoanForm(f => ({ ...f, [k]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "1.25rem" }}>
              <button className="btn btn-ghost" onClick={() => setEditLoanModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleUpdateLoan} disabled={submitting}>
                {submitting ? "Saving..." : "Save Loan Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
