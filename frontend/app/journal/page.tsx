"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api, formatNPR, formatDate } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Search, X, CheckCircle2, AlertCircle, Download, FileSpreadsheet, Printer, ShieldAlert } from "lucide-react";

interface Account { id: number; code: string; name: string; account_type?: string; }
interface JournalLine { account_id: number; debit_npr: number; credit_npr: number; description: string; }
interface JournalEntry {
  id: number; entry_date: string; reference: string; narration: string;
  category?: string;
  total_debit_npr: number; is_posted: boolean;
  lines: Array<{ id: number; account_code: string; account_name: string; debit_npr: number; credit_npr: number; description: string; }>;
}

const EMPTY_LINE = (): JournalLine => ({ account_id: 0, debit_npr: 0, credit_npr: 0, description: "" });

export default function JournalPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split("T")[0]);
  const [reference, setReference] = useState("");
  const [narration, setNarration] = useState("");
  const [lines, setLines] = useState<JournalLine[]>([EMPTY_LINE(), EMPTY_LINE()]);
  const [submitting, setSubmitting] = useState(false);
  const [category, setCategory] = useState("GENERAL");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedFiscalYear, setSelectedFiscalYear] = useState("ALL");
  const [fiscalYearOptions, setFiscalYearOptions] = useState<string[]>([]);

  const isAuthorized = !user || user.role === "ADMIN" || user.role === "ACCOUNTANT";

  const loadData = useCallback(() => {
    if (!isAuthorized) {
      setLoading(false);
      return;
    }
    setLoading(true);
    let url = "/api/journal/?limit=100";
    if (selectedCategory !== "ALL") url += `&category=${selectedCategory}`;
    if (selectedFiscalYear !== "ALL") url += `&fiscal_year=${selectedFiscalYear}`;
    Promise.all([
      api.get<JournalEntry[]>(url),
      api.get<Account[]>("/api/journal/accounts"),
    ]).then(([j, a]) => {
      setEntries(Array.isArray(j) ? j : []);
      setAccounts(Array.isArray(a) ? a : []);
    }).catch(e => {
      console.warn("Failed to load journal:", e);
    }).finally(() => setLoading(false));
  }, [selectedCategory, selectedFiscalYear, isAuthorized]);

  useEffect(() => {
    if (isAuthorized) {
      api.get<{ fiscal_years: string[] }>("/api/journal/fiscal-years")
        .then(res => { if (res?.fiscal_years && Array.isArray(res.fiscal_years)) setFiscalYearOptions(res.fiscal_years); })
        .catch(() => {});
    }
  }, [isAuthorized]);

  useEffect(() => { loadData(); }, [loadData]);

  if (!isAuthorized) {
    return (
      <div style={{ padding: "4rem", textAlign: "center" }}>
        <div style={{ display: "inline-flex", padding: "1rem", borderRadius: "50%", background: "rgba(239, 68, 68, 0.1)", marginBottom: "1rem" }}>
          <ShieldAlert size={36} color="#ef4444" />
        </div>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)" }}>Admin &amp; Accountant Access Required</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "0.5rem", maxWidth: "420px", margin: "0.5rem auto 1.5rem" }}>
          Financial journal entries, double-entry ledgers, and tax compliance records are restricted to administrators and company accountants.
        </p>
        <Link href="/inventory" className="btn btn-primary">Go to Product Catalog &amp; Stock</Link>
      </div>
    );
  }

  const totalDebit  = lines.reduce((s, l) => s + (Number(l.debit_npr) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit_npr) || 0), 0);
  const isBalanced  = Math.abs(totalDebit - totalCredit) < 0.01;

  const addLine = () => setLines(prev => [...prev, EMPTY_LINE()]);
  const removeLine = (i: number) => setLines(prev => prev.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: keyof JournalLine, value: string | number) =>
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));

  const handleSubmit = async () => {
    setError(""); setSuccess("");
    if (!entryDate) return setError("Entry date is required");
    const validLines = lines.filter(l => l.account_id > 0);
    if (validLines.length < 2) return setError("At least 2 lines are required");
    setSubmitting(true);
    try {
      await api.post("/api/journal/", { entry_date: entryDate, reference, narration, category, lines: validLines });
      setSuccess("Journal entry posted successfully!");
      setShowForm(false);
      setLines([EMPTY_LINE(), EMPTY_LINE()]);
      setReference(""); setNarration(""); setCategory("GENERAL");
      loadData();
      setTimeout(() => setSuccess(""), 4000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create entry");
    } finally { setSubmitting(false); }
  };

  const safeEntries = Array.isArray(entries) ? entries : [];
  const filtered = safeEntries.filter(e =>
    e.reference?.toLowerCase().includes(search.toLowerCase()) ||
    e.narration?.toLowerCase().includes(search.toLowerCase()) ||
    e.lines?.some(l => l.account_name?.toLowerCase().includes(search.toLowerCase()) || l.description?.toLowerCase().includes(search.toLowerCase()))
  );

  const handleDownloadCsv = (type: "journal" | "tax") => {
    const url = type === "journal"
      ? "http://127.0.0.1:8000/api/journal/export/csv"
      : "http://127.0.0.1:8000/api/journal/export/tax-clearance-csv";
    window.open(url, "_blank");
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="page-title">Daily Journal & Tax Audit Ledger</h1>
          <p className="text-muted" style={{ fontSize: "0.875rem", marginTop: "0.25rem" }}>Double-entry bookkeeping in NPR with IRD Tax Clearance Export</p>
        </div>
        <div className="page-actions">
          <button
            className="btn btn-ghost"
            onClick={() => handleDownloadCsv("journal")}
            style={{ borderColor: "rgba(34,197,94,0.4)", color: "#22c55e" }}
            id="download-journal-csv-btn"
          >
            <Download size={15} /> Export Journal CSV
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => handleDownloadCsv("tax")}
            style={{ borderColor: "rgba(99,102,241,0.4)", color: "#818cf8" }}
            id="download-tax-csv-btn"
          >
            <FileSpreadsheet size={15} /> Tax Report CSV
          </button>
          <button className="btn btn-primary" onClick={() => setShowForm(true)} id="new-entry-btn">
            <Plus size={15} /> New Entry
          </button>
        </div>
      </div>

      {success && <div className="alert alert-success"><CheckCircle2 size={16}/>{success}</div>}
      {error   && <div className="alert alert-error"><AlertCircle size={16}/>{error}</div>}

      {/* New Entry Form */}
      {showForm && (
        <div className="card" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.25rem" }}>
            <h2 style={{ fontWeight: 600, color: "var(--text-primary)" }}>New Journal Entry</h2>
            <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
              <X size={18} />
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 2fr", gap: "1rem", marginBottom: "1.25rem" }}>
            {[
              { label: "Date *",     el: <input type="date"  className="input" value={entryDate}  onChange={e => setEntryDate(e.target.value)}  id="je-date" /> },
              { label: "Reference",  el: <input type="text"  className="input" placeholder="INV-2025-001" value={reference}  onChange={e => setReference(e.target.value)}  id="je-ref" /> },
              { label: "Category",   el: (
                <select className="input" value={category} onChange={e => setCategory(e.target.value)} id="je-cat">
                  <option value="GENERAL">GENERAL</option>
                  <option value="SALES">SALES</option>
                  <option value="PURCHASE">PURCHASE</option>
                  <option value="PAYMENT">PAYMENT</option>
                  <option value="RECEIPT">RECEIPT</option>
                  <option value="EXPENSE">EXPENSE</option>
                  <option value="LOAN">LOAN</option>
                  <option value="INVESTMENT">INVESTMENT</option>
                </select>
              )},
              { label: "Narration",  el: <input type="text"  className="input" placeholder="Describe the transaction..." value={narration} onChange={e => setNarration(e.target.value)} id="je-narration" /> },
            ].map(({ label, el }) => (
              <div key={label}>
                <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: "0.375rem" }}>{label}</label>
                {el}
              </div>
            ))}
          </div>

          {/* Lines */}
          <div style={{ overflowX: "auto", marginBottom: "1rem" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "0.5rem 0.625rem", fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid var(--border)" }}>
                    Account Head
                  </th>
                  <th style={{ textAlign: "left", padding: "0.5rem 0.625rem", fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid var(--border)" }}>
                    Description
                  </th>
                  <th style={{ textAlign: "right", padding: "0.5rem 0.625rem", fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid var(--border)" }}>
                    <div>DESTINATION (Debit)</div>
                    <div style={{ fontSize: "0.62rem", color: "#818cf8", textTransform: "none", fontWeight: 400 }}>Where value went / Money In</div>
                  </th>
                  <th style={{ textAlign: "right", padding: "0.5rem 0.625rem", fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid var(--border)" }}>
                    <div>SOURCE (Credit)</div>
                    <div style={{ fontSize: "0.62rem", color: "#f59e0b", textTransform: "none", fontWeight: 400 }}>Where value came from / Money Out</div>
                  </th>
                  <th style={{ borderBottom: "1px solid var(--border)" }} />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => (
                  <tr key={i}>
                    <td style={{ padding: "0.375rem 0.625rem" }}>
                      <select className="input" style={{ minWidth: "220px" }} value={line.account_id}
                        onChange={e => updateLine(i, "account_id", Number(e.target.value))} id={`je-acc-${i}`}>
                        <option value={0}>— Select Account —</option>
                        {["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"].map(type => {
                          const group = accounts.filter(a => a.account_type === type);
                          if (!group.length) return null;
                          const labels: Record<string, string> = {
                            ASSET: "📦 ASSETS (Inventory, Cash, Bank)",
                            LIABILITY: "💳 LIABILITIES (Payables, Loans)",
                            EQUITY: "🏦 EQUITY (Owner Capital)",
                            INCOME: "💰 INCOME (Sales Revenue)",
                            EXPENSE: "🧾 EXPENSES (Rent, Salary, Freight)",
                          };
                          return (
                            <optgroup key={type} label={labels[type] || type}>
                              {group.map(a => (
                                <option key={a.id} value={a.id}>
                                  {a.code} — {a.name}
                                </option>
                              ))}
                            </optgroup>
                          );
                        })}
                      </select>
                    </td>
                    <td style={{ padding: "0.375rem 0.625rem" }}>
                      <input type="text" className="input" placeholder="Description" value={line.description}
                        onChange={e => updateLine(i, "description", e.target.value)} id={`je-desc-${i}`} />
                    </td>
                    <td style={{ padding: "0.375rem 0.625rem" }}>
                      <input type="number" className="input" style={{ textAlign: "right" }} min="0" step="0.01"
                        value={line.debit_npr || ""} placeholder="0"
                        onChange={e => updateLine(i, "debit_npr", e.target.value)} id={`je-dr-${i}`} />
                    </td>
                    <td style={{ padding: "0.375rem 0.625rem" }}>
                      <input type="number" className="input" style={{ textAlign: "right" }} min="0" step="0.01"
                        value={line.credit_npr || ""} placeholder="0"
                        onChange={e => updateLine(i, "credit_npr", e.target.value)} id={`je-cr-${i}`} />
                    </td>
                    <td style={{ padding: "0.375rem 0.625rem" }}>
                      {lines.length > 2 && (
                        <button onClick={() => removeLine(i)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer" }}>
                          <X size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2} style={{ padding: "0.5rem 0.625rem", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)" }}>Totals</td>
                  <td style={{ padding: "0.5rem 0.625rem", fontWeight: 700, textAlign: "right", color: isBalanced ? "#22c55e" : "#ef4444" }}>
                    {formatNPR(totalDebit)}
                  </td>
                  <td style={{ padding: "0.5rem 0.625rem", fontWeight: 700, textAlign: "right", color: isBalanced ? "#22c55e" : "#ef4444" }}>
                    {formatNPR(totalCredit)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <button className="btn btn-ghost" onClick={addLine} id="add-line-btn"><Plus size={14} /> Add Line</button>
            {!isBalanced && totalDebit + totalCredit > 0 && (
              <span style={{ fontSize: "0.8rem", color: "#f59e0b" }}>
                Difference: {formatNPR(Math.abs(totalDebit - totalCredit))}
              </span>
            )}
            {isBalanced && totalDebit > 0 && (
              <span style={{ fontSize: "0.8rem", color: "#22c55e" }}>Entry is balanced</span>
            )}
            <div style={{ flex: 1 }} />
            <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting || !isBalanced} id="submit-entry-btn">
              {submitting ? "Posting..." : "Post Entry"}
            </button>
          </div>
        </div>
      )}

      {/* Filters: Category & Fiscal Year */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: "240px" }}>
          <Search size={15} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input type="text" className="input" style={{ paddingLeft: "2.25rem" }}
            placeholder="Search by reference or narration..." value={search} onChange={e => setSearch(e.target.value)} id="journal-search" />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 }}>Fiscal Year:</span>
          <select
            className="input"
            style={{ minWidth: "130px", fontSize: "0.8rem", padding: "0.35rem 0.5rem" }}
            value={selectedFiscalYear}
            onChange={e => setSelectedFiscalYear(e.target.value)}
            id="fy-select"
          >
            <option value="ALL">All Years</option>
            {fiscalYearOptions.map(fy => (
              <option key={fy} value={fy}>FY {fy}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Category Tabs */}
      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        {["ALL", "SALES", "PURCHASE", "PAYMENT", "RECEIPT", "EXPENSE", "LOAN", "INVESTMENT", "GENERAL"].map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`btn ${selectedCategory === cat ? "btn-primary" : "btn-ghost"}`}
            style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
            id={`cat-tab-${cat}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Entries Table */}
      <div className="card" style={{ overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "3rem", display: "flex", justifyContent: "center" }}><div className="spinner" /></div>
        ) : (
          <div style={{ overflowX: "auto", width: "100%" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th><th>Category</th><th>Reference</th><th>Narration</th>
                  <th style={{ textAlign: "right" }}>Amount (NPR)</th><th>Lines</th><th style={{ textAlign: "center" }}>Tax Invoice</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => (
                  <tr key={e.id}>
                    <td style={{ whiteSpace: "nowrap" }} className="text-muted">{formatDate(e.entry_date)}</td>
                    <td>
                      <span className={`badge ${
                        e.category === "SALES" ? "badge-green" :
                        e.category === "PURCHASE" ? "badge-blue" :
                        e.category === "PAYMENT" ? "badge-amber" :
                        e.category === "EXPENSE" ? "badge-red" : "badge-indigo"
                      }`}>
                        {e.category || "GENERAL"}
                      </span>
                    </td>
                    <td><span className="badge badge-indigo">{e.reference || "—"}</span></td>
                    <td style={{ maxWidth: "280px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.narration}</td>
                    <td style={{ textAlign: "right", fontWeight: 600, color: "#818cf8" }}>{formatNPR(e.total_debit_npr)}</td>
                    <td className="text-muted">{e.lines?.length || 0} lines</td>
                    <td style={{ textAlign: "center" }}>
                      <Link
                        href={`/invoice?id=${e.id}`}
                        className="btn btn-ghost"
                        style={{ fontSize: "0.7rem", padding: "0.2rem 0.5rem", color: "#818cf8" }}
                        title="Print Official A4 Tax Invoice"
                        id={`print-inv-${e.id}`}
                      >
                        <Printer size={12} style={{ marginRight: 3 }} /> Invoice
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
