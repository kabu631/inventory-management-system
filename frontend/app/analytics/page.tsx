"use client";
import { useEffect, useState, useRef } from "react";
import { api, formatNPR } from "@/lib/api";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, Area, AreaChart,
} from "recharts";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { TrendingUp, TrendingDown, Eye, EyeOff, Lock, Unlock, X, ShieldCheck, ShieldAlert } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

const DASHBOARD_PIN = process.env.NEXT_PUBLIC_DASHBOARD_PIN ?? "1234";

interface MonthRow {
  month: string; revenue_npr: number; cogs_npr: number;
  gross_profit_npr: number; gross_margin_pct: number;
}
interface Analytics {
  monthly: MonthRow[];
  kpis: { total_revenue_npr: number; total_cogs_npr: number; total_gross_profit_npr: number; inventory_value_npr: number; active_loans: number; total_loan_principal_npr: number; };
}
interface ForecastData {
  historical: Array<{ month: string; revenue_npr: number }>;
  forecast: Array<{ month: string; predicted_revenue_npr: number }>;
  model?: { slope: number; intercept: number };
}

const NPR = (v: number) => `Rs.${(v / 1000).toFixed(0)}k`;

function makeTooltip(isDark: boolean, unlocked: boolean) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload || !payload.length) return null;
    return (
      <div style={{
        background: isDark ? "#0f172a" : "#ffffff",
        border: `1px solid ${isDark ? "rgba(255,255,255,0.15)" : "#e2e8f0"}`,
        borderRadius: "0.5rem",
        padding: "0.5rem 0.75rem",
        fontSize: "0.75rem",
        color: isDark ? "#f8fafc" : "#0f172a",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      }}>
        <p style={{ fontWeight: 700, marginBottom: "4px" }}>{label}</p>
        {payload.map((p: any) => (
          <div key={p.name} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: p.color }} />
            <span>{p.name}:</span>
            <span style={{ fontWeight: 600, filter: unlocked ? "none" : "blur(4px)" }}>
              {unlocked ? formatNPR(p.value) : "••••••"}
            </span>
          </div>
        ))}
      </div>
    );
  };
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const { theme } = useTheme();
  
  if (user && user.role !== "ADMIN") {
    return (
      <div style={{ padding: "4rem", textAlign: "center" }}>
        <div style={{ display: "inline-flex", padding: "1rem", borderRadius: "50%", background: "rgba(239, 68, 68, 0.1)", marginBottom: "1rem" }}>
          <ShieldAlert size={36} color="#ef4444" />
        </div>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)" }}>Admin &amp; Investor Access Required</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "0.5rem", maxWidth: "420px", margin: "0.5rem auto 1.5rem" }}>
          Financial profit margins, revenue forecasting, and ML analytics are restricted strictly to company administrators and investors.
        </p>
        <Link href="/inventory" className="btn btn-primary">Go to Product Sales &amp; Catalog</Link>
      </div>
    );
  }

  const isDark = theme === "dark";

  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [forecast, setForecast] = useState<ForecastData | null>(null);
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
      api.get<Analytics>("/api/analytics/"),
      api.get<ForecastData>("/api/analytics/forecast"),
    ]).then(([a, f]) => { setAnalytics(a); setForecast(f); }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (showPinModal) setTimeout(() => pinRef.current?.focus(), 80);
  }, [showPinModal]);

  const TooltipComponent = makeTooltip(isDark, unlocked);

  function openLockModal() {
    if (unlocked) {
      setUnlocked(false);
    } else {
      setPin(""); setPinError(""); setShowPin(false);
      setShowPinModal(true);
    }
  }

  function handlePinSubmit() {
    if (pin === DASHBOARD_PIN) {
      setUnlocked(true); setShowPinModal(false);
      setPin(""); setPinError("");
    } else {
      setPinError("Incorrect password. Try again.");
      setPin(""); pinRef.current?.focus();
    }
  }

  // blur helper for text
  const blurStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
    filter: unlocked ? "none" : "blur(7px)",
    userSelect: unlocked ? "auto" : "none",
    transition: "filter 0.3s ease",
    ...extra,
  });

  if (loading) {
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}><div className="spinner" /></div>;
  }

  const { kpis, monthly } = analytics!;
  const slope = forecast?.model?.slope ?? 0;

  const combinedChartData = [
    ...(forecast?.historical || []).map(h => ({ month: h.month, actual: h.revenue_npr, forecast: null as number | null })),
    ...(forecast?.forecast || []).map(f => ({ month: f.month, actual: null as number | null, forecast: f.predicted_revenue_npr })),
  ];

  const gridColor  = isDark ? "rgba(55,65,81,0.4)"   : "rgba(203,213,225,0.5)";
  const tickColor  = isDark ? "#6b7280"               : "#64748b";
  const cursorFill = isDark ? "rgba(99,102,241,0.05)" : "rgba(99,102,241,0.04)";

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics &amp; Forecast</h1>
          <p className="text-muted" style={{ fontSize: "0.875rem" }}>Revenue trends with ML-powered 3-month forecast</p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {/* Trend badge */}
          <div style={{
            display: "flex", alignItems: "center", gap: "0.5rem",
            background: slope >= 0 ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.10)",
            border: `1px solid ${slope >= 0 ? "rgba(34,197,94,0.30)" : "rgba(239,68,68,0.30)"}`,
            borderRadius: "0.625rem", padding: "0.5rem 0.875rem",
          }}>
            {slope >= 0 ? <TrendingUp size={16} color="#22c55e" /> : <TrendingDown size={16} color="#ef4444" />}
            <span style={{
              fontSize: "0.8rem",
              color: slope >= 0 ? "#22c55e" : "#ef4444",
              fontWeight: 500,
              ...blurStyle(),
            }}>
              {slope >= 0 ? "Growing" : "Declining"} trend · {unlocked ? formatNPR(Math.abs(slope)) : "••••••"}/mo
            </span>
          </div>

          {/* Privacy toggle */}
          <button
            id="analytics-privacy-toggle"
            onClick={openLockModal}
            title={unlocked ? "Click to lock financial data" : "Click to reveal financial data"}
            style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              padding: "0.5rem 1rem", borderRadius: "0.625rem",
              border: `1px solid ${unlocked ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}`,
              background: unlocked ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
              color: unlocked ? "#22c55e" : "#ef4444",
              cursor: "pointer", fontWeight: 600, fontSize: "0.8rem",
              transition: "all 0.2s ease",
            }}
          >
            {unlocked ? <Unlock size={15} /> : <Lock size={15} />}
            {unlocked ? "Lock Financials" : "Unlock Financials"}
          </button>
        </div>
      </div>

      {/* KPI grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem", marginBottom: "2rem" }}>
        {[
          { label: "Total Revenue",  value: formatNPR(kpis.total_revenue_npr),      color: "#6366f1" },
          { label: "Total COGS",     value: formatNPR(kpis.total_cogs_npr),         color: "#f59e0b" },
          { label: "Gross Profit",   value: formatNPR(kpis.total_gross_profit_npr), color: "#22c55e" },
        ].map(k => (
          <div key={k.label} className="kpi-card" style={{ position: "relative", cursor: unlocked ? "default" : "pointer" }} onClick={unlocked ? undefined : openLockModal}>
            <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>{k.label}</p>
            <p style={{ fontSize: "1.3rem", fontWeight: 700, color: k.color, marginTop: "0.375rem", ...blurStyle() }}>
              {unlocked ? k.value : "••••••"}
            </p>
            {!unlocked && (
              <button
                style={{ position: "absolute", inset: 0, background: "transparent", border: "none", cursor: "pointer", borderRadius: "inherit" }}
                title="Click to unlock financials"
              />
            )}
          </div>
        ))}
      </div>

      {/* Revenue vs COGS Bar Chart */}
      <div className="card" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "1.25rem" }}>
          Monthly Revenue vs COGS
        </h2>
        <div style={{ filter: unlocked ? "none" : "blur(5px)", transition: "filter 0.3s ease", userSelect: unlocked ? "auto" : "none", pointerEvents: unlocked ? "auto" : "none" }}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthly} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="month" tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={NPR} tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<TooltipComponent />} cursor={{ fill: cursorFill }} />
              <Legend wrapperStyle={{ fontSize: "0.78rem", color: tickColor }} />
              <Bar dataKey="revenue_npr"      name="Revenue"      fill="#6366f1" radius={[4,4,0,0]} maxBarSize={40} />
              <Bar dataKey="cogs_npr"         name="COGS"         fill="#f59e0b" radius={[4,4,0,0]} maxBarSize={40} />
              <Bar dataKey="gross_profit_npr" name="Gross Profit" fill="#22c55e" radius={[4,4,0,0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {!unlocked && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", marginTop: "0.5rem" }}>
            <Lock size={13} color="var(--text-muted)" />
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Unlock to view chart data</span>
          </div>
        )}
      </div>

      {/* Forecast Chart */}
      <div className="card" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)" }}>Revenue Forecast (Linear Regression)</h2>
          <div style={{ display: "flex", gap: "1rem" }}>
            {[["#6366f1","Actual"],["#f59e0b","Forecast"]].map(([c,n]) => (
              <div key={n} style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                <div style={{ width: "12px", height: "3px", background: c, borderRadius: "1px" }} />{n}
              </div>
            ))}
          </div>
        </div>
        <div style={{ filter: unlocked ? "none" : "blur(5px)", transition: "filter 0.3s ease", userSelect: unlocked ? "auto" : "none", pointerEvents: unlocked ? "auto" : "none" }}>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={combinedChartData} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
              <defs>
                <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6366f1" stopOpacity={isDark ? 0.25 : 0.15} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradForecast" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f59e0b" stopOpacity={isDark ? 0.20 : 0.12} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="month" tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={NPR} tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<TooltipComponent />} />
              <Area type="monotone" dataKey="actual"   name="Actual Revenue" stroke="#6366f1" strokeWidth={2} fill="url(#gradActual)"   connectNulls={false} dot={false} />
              <Area type="monotone" dataKey="forecast" name="Forecast"       stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 4" fill="url(#gradForecast)" connectNulls={false} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {!unlocked && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", marginTop: "0.5rem" }}>
            <Lock size={13} color="var(--text-muted)" />
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Unlock to view forecast</span>
          </div>
        )}

        {/* Forecast cards */}
        {forecast?.forecast && (
          <div style={{ display: "flex", gap: "1rem", marginTop: "1rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
            {forecast.forecast.map(f => (
              <div key={f.month} style={{
                flex: 1,
                background: isDark ? "rgba(245,158,11,0.07)" : "rgba(245,158,11,0.06)",
                border: "1px solid rgba(245,158,11,0.2)",
                borderRadius: "0.625rem", padding: "0.75rem", textAlign: "center",
              }}>
                <p className="text-muted" style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>{f.month}</p>
                <p style={{ fontSize: "1rem", fontWeight: 700, color: "#f59e0b", marginTop: "0.25rem", ...blurStyle() }}>
                  {unlocked ? formatNPR(f.predicted_revenue_npr) : "••••••"}
                </p>
                <p className="text-faint" style={{ fontSize: "0.65rem", marginTop: "2px" }}>predicted</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Gross Margin Table */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)" }}>Monthly Breakdown</h2>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Month</th>
              <th style={{ textAlign: "right" }}>Revenue</th>
              <th style={{ textAlign: "right" }}>COGS</th>
              <th style={{ textAlign: "right" }}>Gross Profit</th>
              <th style={{ textAlign: "right" }}>Margin %</th>
            </tr>
          </thead>
          <tbody>
            {monthly.map(m => (
              <tr key={m.month}>
                <td style={{ fontWeight: 500 }}>{m.month}</td>
                <td style={{ textAlign: "right", color: "#818cf8", ...blurStyle() }}>
                  {unlocked ? formatNPR(m.revenue_npr) : "••••••"}
                </td>
                <td style={{ textAlign: "right", color: "#fbbf24", ...blurStyle() }}>
                  {unlocked ? formatNPR(m.cogs_npr) : "••••••"}
                </td>
                <td style={{ textAlign: "right", color: "#4ade80", fontWeight: 600, ...blurStyle() }}>
                  {unlocked ? formatNPR(m.gross_profit_npr) : "••••••"}
                </td>
                <td style={{ textAlign: "right" }}>
                  <span style={blurStyle()}>
                    <span className={`badge ${m.gross_margin_pct >= 20 ? "badge-green" : m.gross_margin_pct >= 10 ? "badge-amber" : "badge-red"}`}>
                      {unlocked ? `${m.gross_margin_pct.toFixed(1)}%` : "••%"}
                    </span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
                  <p style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Enter your password to view analytics data</p>
                </div>
              </div>
              <button onClick={() => setShowPinModal(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            {/* PIN input */}
            <div>
              <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  ref={pinRef}
                  id="analytics-pin-input"
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
                <p style={{ marginTop: "0.4rem", fontSize: "0.75rem", color: "#ef4444" }}>
                  ⚠ {pinError}
                </p>
              )}
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setShowPinModal(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                id="analytics-pin-submit"
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
