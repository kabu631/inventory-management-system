"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { api, formatNPR } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import {
  TrendingUp, Package, Landmark, BookOpen, ArrowUpRight, ArrowDownLeft,
  Truck, ShoppingBag, ArrowRightLeft, ShieldAlert, FileSpreadsheet,
  Eye, EyeOff, Lock, Unlock, X, ShieldCheck, Users, Building2
} from "lucide-react";

// ── password stored in env var (set NEXT_PUBLIC_DASHBOARD_PIN in .env.local)
// falls back to "1234" if not set
const DASHBOARD_PIN = process.env.NEXT_PUBLIC_DASHBOARD_PIN ?? "1234";

interface KPIs {
  total_revenue_npr: number; total_cogs_npr: number;
  total_gross_profit_npr: number; inventory_value_npr: number;
  active_loans: number; total_loan_principal_npr: number;
  total_investor_capital_npr: number; total_bank_loan_capital_npr: number;
}
interface MonthRow {
  month: string; revenue_npr: number; cogs_npr: number;
  gross_profit_npr: number; gross_margin_pct: number;
}
interface JournalEntry {
  id: number; entry_date: string; reference: string;
  narration: string; total_debit_npr: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { company } = useCompany();
  const isAdmin = user?.role === "ADMIN";
  const isAccountant = user?.role === "ACCOUNTANT";

  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [monthly, setMonthly] = useState<MonthRow[]>([]);
  const [recent, setRecent] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // ── privacy state
  const [unlocked, setUnlocked] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [showPin, setShowPin] = useState(false);
  const pinRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      api.get<{ kpis: KPIs; monthly: MonthRow[] }>("/api/analytics/"),
      api.get<JournalEntry[]>("/api/journal/?limit=8"),
    ]).then(([analytics, journal]) => {
      if (analytics && analytics.kpis) {
        setKpis(analytics.kpis);
      }
      if (analytics && Array.isArray(analytics.monthly)) {
        setMonthly(analytics.monthly.slice(-6));
      } else {
        setMonthly([]);
      }
      if (Array.isArray(journal)) {
        setRecent(journal);
      } else {
        setRecent([]);
      }
    }).catch(err => {
      console.warn("Dashboard data load error:", err);
      setMonthly([]);
      setRecent([]);
    }).finally(() => setLoading(false));
  }, []);

  // auto-focus pin input when modal opens
  useEffect(() => {
    if (showPinModal) {
      setTimeout(() => pinRef.current?.focus(), 80);
    }
  }, [showPinModal]);

  function openLockModal() {
    if (unlocked) {
      // re-lock
      setUnlocked(false);
    } else {
      setPin("");
      setPinError("");
      setShowPin(false);
      setShowPinModal(true);
    }
  }

  function handlePinSubmit() {
    if (pin === DASHBOARD_PIN) {
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

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
        <div className="spinner" />
      </div>
    );
  }

  const maxRevenue = monthly.reduce((a, b) => Math.max(a, b.revenue_npr), 1);

  // Helper: mask a value when locked
  const mask = (val: string) =>
    unlocked ? val : "••••••";

  const kpiCards = kpis ? [
    {
      label: "Total Revenue", icon: TrendingUp, color: "#6366f1",
      value: mask(formatNPR(kpis.total_revenue_npr)),
      sub: unlocked ? "All time sales" : "🔒 Hidden",
      glowClass: "glow-indigo",
    },
    {
      label: "Gross Profit", icon: ArrowUpRight, color: "#22c55e",
      value: mask(formatNPR(kpis.total_gross_profit_npr)),
      sub: unlocked
        ? `Margin ${kpis.total_revenue_npr > 0 ? ((kpis.total_gross_profit_npr / kpis.total_revenue_npr) * 100).toFixed(1) : 0}%`
        : "🔒 Hidden",
      glowClass: "glow-green",
    },
    {
      label: "Inventory Value", icon: Package, color: "#f59e0b",
      value: mask(formatNPR(kpis.inventory_value_npr)),
      sub: unlocked ? "Stock at cost price" : "🔒 Hidden",
      glowClass: "glow-amber",
    },
    {
      label: "Active Loans", icon: Landmark, color: "#ef4444",
      value: unlocked ? `${kpis.active_loans} Loans` : "•• Loans",
      sub: mask(formatNPR(kpis.total_loan_principal_npr)),
      glowClass: "glow-red",
    },
  ] : [];

  const prodTerm = company?.product_term || "Product";
  const prodTermPlural = company?.product_term_plural || "Products";

  const QUICK_ACTIONS = isAccountant
    ? [
        { title: "Stock Audit & Prices", desc: `Audit remaining ${prodTermPlural.toLowerCase()} & price directory`, href: "/inventory", icon: Package, color: "#818cf8" },
        { title: "Tax Clearance Export", desc: "Download IRD tax clearance CSV report", href: "/journal", icon: FileSpreadsheet, color: "#22c55e" },
        { title: "Customer Ledgers", desc: "Audit customer credit limits & receivables", href: "/customers", icon: Users, color: "#3b82f6" },
        { title: "Daily Journal", desc: "Review double-entry accounting ledger", href: "/journal", icon: BookOpen, color: "#f59e0b" },
      ]
    : [
        { title: `Sell ${prodTerm}`, desc: `Create invoice & deduct ${prodTerm.toLowerCase()} stock`, href: "/inventory", icon: ShoppingBag, color: "#818cf8" },
        { title: "Purchase Stock", desc: `Buy ${prodTermPlural.toLowerCase()} stock from suppliers / loans`, href: "/inventory", icon: ArrowDownLeft, color: "#22c55e" },
        { title: "Add New SKU", desc: `Register new ${prodTerm.toLowerCase()} specifications`, href: "/inventory", icon: Package, color: "#3b82f6" },
        { title: "Data Backup & Sync", desc: "Manual backup & Google Drive sync", href: "/settings", icon: ShieldCheck, color: "#10b981" },
        { title: "Warranty & Serials", desc: `Register serial or process ${prodTerm.toLowerCase()} claim`, href: "/warranty", icon: ShieldAlert, color: "#ef4444" },
      ];

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="page-title">{isAdmin ? "Corporate Inventory Dashboard" : isAccountant ? "Accountant Audit & Compliance Portal" : "Staff Operations & Sales Portal"}</h1>
          <p className="text-muted" style={{ fontSize: "0.875rem", marginTop: "0.25rem" }}>
            {company.company_name || "Corporate"} ERP — {company.business_type ? `${company.business_type} • ` : ""}{isAdmin ? "Live Overview & Quick Operations Hub" : isAccountant ? `Welcome, ${user?.full_name || "Accountant"} (${user?.staff_id || "ACC-001"})` : `Welcome, ${user?.full_name || "Staff"} (${user?.staff_id || "EMP-102"})`}
          </p>
        </div>

        <div className="page-actions">
          {/* Privacy toggle button (Admin only) */}
          {isAdmin ? (
            <button
              id="privacy-toggle-btn"
              onClick={openLockModal}
              title={unlocked ? "Click to lock financial data" : "Click to reveal financial data"}
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
          ) : isAccountant ? (
            <div style={{ padding: "0.35rem 0.75rem", borderRadius: "0.5rem", background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.25)", color: "#f59e0b", fontSize: "0.75rem", fontWeight: 700 }}>
              📊 Accountant Audit Mode
            </div>
          ) : (
            <div style={{ padding: "0.35rem 0.75rem", borderRadius: "0.5rem", background: "rgba(99, 102, 241, 0.1)", border: "1px solid rgba(99, 102, 241, 0.25)", color: "#818cf8", fontSize: "0.75rem", fontWeight: 700 }}>
              🛡️ Staff Access Mode
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards / Operational Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
        {isAdmin ? (
          kpiCards.map((k) => (
            <div key={k.label} className={`kpi-card ${k.glowClass}`} style={{ position: "relative" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                    {k.label}
                  </p>
                  <p style={{
                    fontSize: "1.4rem", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.2,
                    filter: unlocked ? "none" : "blur(6px)",
                    userSelect: unlocked ? "auto" : "none",
                    transition: "filter 0.3s ease",
                    letterSpacing: unlocked ? "normal" : "0.1em",
                  }}>
                    {k.value}
                  </p>
                  <p style={{
                    fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.375rem",
                    filter: unlocked ? "none" : "blur(4px)",
                    transition: "filter 0.3s ease",
                  }}>
                    {k.sub}
                  </p>
                </div>
                <div style={{
                  padding: "0.5rem",
                  borderRadius: "0.5rem",
                  background: `${k.color}15`,
                  border: `1px solid ${k.color}30`,
                }}>
                  <k.icon size={18} color={k.color} />
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
                  title="Click to unlock financials"
                />
              )}
            </div>
          ))
        ) : (
          (isAccountant ? [
            { title: "Journal & Tax Audit Ledger", desc: "Audit double-entry postings & export IRD tax reports", href: "/journal", icon: BookOpen, color: "#f59e0b" },
            { title: "Stock Audit & Remaining Qty", desc: "Audit live battery stock counts & selling prices", href: "/inventory", icon: Package, color: "#10b981" },
            { title: "Depots & Warehouse Stock", desc: "Audit stock distribution across depots", href: "/warehouses", icon: Building2, color: "#3b82f6" },
            { title: "Customer Receivables", desc: "Review customer balances & invoice transaction history", href: "/customers", icon: Users, color: "#818cf8" },
          ] : [
            { title: "Sell Battery & Check Prices", desc: "View catalog prices & create customer invoice", href: "/inventory", icon: ShoppingBag, color: "#10b981" },
            { title: "Depots & Warehouse Stock", desc: "Check stock quantity across warehouse locations", href: "/warehouses", icon: Building2, color: "#3b82f6" },
            { title: "Battery Serials & Warranty", desc: "Verify serial numbers & register warranty claims", href: "/warranty", icon: ShieldAlert, color: "#f59e0b" },
            { title: "Customers Directory", desc: "Manage B2B & B2C customer contacts", href: "/customers", icon: Users, color: "#818cf8" },
          ]).map(c => (
            <Link key={c.title} href={c.href} className="kpi-card glow-indigo" style={{ textDecoration: "none", display: "block" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <p style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.25rem" }}>{c.title}</p>
                  <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{c.desc}</p>
                </div>
                <div style={{ padding: "0.4rem", borderRadius: "0.5rem", background: `${c.color}18`, border: `1px solid ${c.color}30` }}>
                  <c.icon size={18} color={c.color} />
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Capital & Funding Overview Banner (Admin only) */}
      {isAdmin && kpis && (
        <div style={{
          marginBottom: "2rem",
          padding: "1.25rem 1.5rem",
          borderRadius: "0.75rem",
          background: "linear-gradient(135deg, rgba(16,185,129,0.06) 0%, rgba(59,130,246,0.06) 50%, rgba(168,85,247,0.06) 100%)",
          border: "1px solid rgba(16,185,129,0.18)",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Decorative glow */}
          <div style={{
            position: "absolute", top: "-20px", right: "-20px", width: "120px", height: "120px",
            background: "radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)",
            borderRadius: "50%", pointerEvents: "none",
          }} />

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
            <Landmark size={18} color="#10b981" />
            <h3 style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
              Capital & Funding Overview
            </h3>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "1rem" }}>
            {/* Investor Equity */}
            <div style={{
              padding: "0.875rem 1rem",
              borderRadius: "0.625rem",
              background: "rgba(16,185,129,0.08)",
              border: "1px solid rgba(16,185,129,0.2)",
            }}>
              <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.04em", marginBottom: "0.375rem" }}>
                💼 Investor Equity Capital
              </p>
              <p style={{
                fontSize: "1.15rem", fontWeight: 800, color: "#10b981", margin: 0,
                filter: unlocked ? "none" : "blur(6px)", transition: "filter 0.3s ease",
              }}>
                {unlocked ? formatNPR(kpis.total_investor_capital_npr) : "••••••"}
              </p>
            </div>

            {/* Bank Loan Funds */}
            <div style={{
              padding: "0.875rem 1rem",
              borderRadius: "0.625rem",
              background: "rgba(59,130,246,0.08)",
              border: "1px solid rgba(59,130,246,0.2)",
            }}>
              <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.04em", marginBottom: "0.375rem" }}>
                🏦 Bank Loan Funds
              </p>
              <p style={{
                fontSize: "1.15rem", fontWeight: 800, color: "#3b82f6", margin: 0,
                filter: unlocked ? "none" : "blur(6px)", transition: "filter 0.3s ease",
              }}>
                {unlocked ? formatNPR(kpis.total_bank_loan_capital_npr) : "••••••"}
              </p>
            </div>

            {/* Inventory Value (Utilized) */}
            <div style={{
              padding: "0.875rem 1rem",
              borderRadius: "0.625rem",
              background: "rgba(245,158,11,0.08)",
              border: "1px solid rgba(245,158,11,0.2)",
            }}>
              <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.04em", marginBottom: "0.375rem" }}>
                📦 Utilized in Inventory
              </p>
              <p style={{
                fontSize: "1.15rem", fontWeight: 800, color: "#f59e0b", margin: 0,
                filter: unlocked ? "none" : "blur(6px)", transition: "filter 0.3s ease",
              }}>
                {unlocked ? formatNPR(kpis.inventory_value_npr) : "••••••"}
              </p>
            </div>

            {/* Remaining Capital */}
            <div style={{
              padding: "0.875rem 1rem",
              borderRadius: "0.625rem",
              background: "linear-gradient(135deg, rgba(168,85,247,0.1) 0%, rgba(99,102,241,0.1) 100%)",
              border: "1px solid rgba(168,85,247,0.25)",
            }}>
              <p style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.04em", marginBottom: "0.375rem" }}>
                💰 Remaining Capital
              </p>
              <p style={{
                fontSize: "1.2rem", fontWeight: 900, margin: 0,
                color: (kpis.total_investor_capital_npr + kpis.total_bank_loan_capital_npr - kpis.inventory_value_npr) >= 0 ? "#a855f7" : "#ef4444",
                filter: unlocked ? "none" : "blur(6px)", transition: "filter 0.3s ease",
              }}>
                {unlocked ? formatNPR(kpis.total_investor_capital_npr + kpis.total_bank_loan_capital_npr - kpis.inventory_value_npr) : "••••••"}
              </p>
              {unlocked && (
                <p style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                  Equity + Loans − Stock
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Layman Quick Action Hub */}
      <div style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "1rem" }}>
          ⚡ Quick Operations Hub (Easy Mode)
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: "1rem" }}>
          {QUICK_ACTIONS.map(qa => (
            <Link key={qa.title} href={qa.href} className="card" style={{ padding: "1.25rem 1rem", textDecoration: "none", transition: "transform 0.2s ease, border-color 0.2s ease" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <div style={{ padding: "0.5rem", borderRadius: "0.5rem", background: `${qa.color}18`, border: `1px solid ${qa.color}30` }}>
                  <qa.icon size={18} color={qa.color} />
                </div>
                <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary)" }}>{qa.title}</h3>
              </div>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", lineHeight: 1.3 }}>{qa.desc}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Charts & Recent Transactions */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        {/* Monthly Revenue chart */}
        <div className="card" style={{ padding: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <div>
              <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)" }}>Revenue Trend</h2>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Monthly sales performance (NPR)</p>
            </div>
          </div>
          {monthly.length === 0 ? (
            <div style={{ padding: "2rem 0", textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>
              No monthly analytics data yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {monthly.map((m) => {
                const widthPct = Math.max((m.revenue_npr / maxRevenue) * 100, 2);
                return (
                  <div key={m.month}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: "0.25rem" }}>
                      <span style={{ fontWeight: 500 }}>{m.month}</span>
                      <span style={{
                        color: "var(--text-muted)",
                        filter: unlocked ? "none" : "blur(5px)",
                        transition: "filter 0.3s ease",
                        userSelect: unlocked ? "auto" : "none",
                      }}>{formatNPR(m.revenue_npr)}</span>
                    </div>
                    <div style={{ height: "8px", background: "var(--border)", borderRadius: "999px", overflow: "hidden" }}>
                      <div style={{
                        height: "100%", width: `${widthPct}%`,
                        background: "linear-gradient(90deg, #6366f1, #22c55e)",
                        borderRadius: "999px", transition: "width 0.6s cubic-bezier(0.16, 1, 0.3, 1)"
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Journal Entries */}
        <div className="card" style={{ padding: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
            <div>
              <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)" }}>{isAdmin ? "Recent Journal Postings" : "Recent Product Sales & Activity"}</h2>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{isAdmin ? "Latest double-entry accounting records" : "Real-time activity on shared company database"}</p>
            </div>
            {isAdmin && (
              <Link href="/journal" style={{ fontSize: "0.75rem", color: "#818cf8", textDecoration: "none", fontWeight: 600 }}>
                View all →
              </Link>
            )}
          </div>
          {recent.length === 0 ? (
            <div style={{ padding: "2rem 0", textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>
              No transactions recorded yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {recent.map((entry) => (
                <div key={entry.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.625rem 0.75rem", background: "var(--bg-card-child)", borderRadius: "0.5rem", border: "1px solid var(--border)" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", background: "var(--border)", padding: "1px 6px", borderRadius: "4px" }}>
                        {entry.reference || `#${entry.id}`}
                      </span>
                      <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
                        {entry.narration || "Journal entry"}
                      </p>
                    </div>
                    <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "2px" }}>
                      {entry.entry_date}
                    </p>
                  </div>
                  {isAdmin ? (
                    <span style={{
                      fontSize: "0.85rem", fontWeight: 700, color: "#818cf8",
                      filter: unlocked ? "none" : "blur(5px)",
                      transition: "filter 0.3s ease",
                      userSelect: unlocked ? "auto" : "none",
                    }}>
                      {formatNPR(entry.total_debit_npr)}
                    </span>
                  ) : (
                    <span className="badge badge-green" style={{ fontSize: "0.7rem" }}>RECORDED</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── PIN / Password Modal ── */}
      {showPinModal && (
        <div className="modal-overlay" onClick={() => setShowPinModal(false)}>
          <div
            className="card"
            onClick={e => e.stopPropagation()}
            style={{
              width: "360px", maxWidth: "90vw",
              padding: "2rem", margin: "auto",
              display: "flex", flexDirection: "column", gap: "1.25rem",
              border: "1px solid rgba(99,102,241,0.3)",
              boxShadow: "0 0 40px rgba(99,102,241,0.15)",
            }}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                <div style={{ padding: "0.5rem", borderRadius: "0.5rem", background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.25)" }}>
                  <ShieldCheck size={18} color="#818cf8" />
                </div>
                <div>
                  <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>Financial Privacy Lock</h2>
                  <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Enter your password to view KPI data</p>
                </div>
              </div>
              <button onClick={() => setShowPinModal(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            {/* PIN input */}
            <div style={{ position: "relative" }}>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  ref={pinRef}
                  id="dashboard-pin-input"
                  type={showPin ? "text" : "password"}
                  className="input"
                  value={pin}
                  onChange={e => { setPin(e.target.value); setPinError(""); }}
                  onKeyDown={e => e.key === "Enter" && handlePinSubmit()}
                  placeholder="Enter password…"
                  style={{ paddingRight: "2.75rem", letterSpacing: "0.15em", fontSize: "1.1rem" }}
                  autoComplete="off"
                />
                <button
                  onClick={() => setShowPin(v => !v)}
                  style={{
                    position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)",
                    display: "flex", alignItems: "center",
                  }}
                  tabIndex={-1}
                >
                  {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {pinError && (
                <p style={{ marginTop: "0.4rem", fontSize: "0.75rem", color: "#ef4444", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                  ⚠ {pinError}
                </p>
              )}
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setShowPinModal(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                id="dashboard-pin-submit"
                onClick={handlePinSubmit}
                style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
              >
                <Unlock size={14} /> Unlock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
