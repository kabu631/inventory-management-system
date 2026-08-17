"use client";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { api } from "@/lib/api";
import { Lock, User, Eye, EyeOff, ArrowRight, AlertCircle, Building2 } from "lucide-react";

interface LoginResponse {
  status: string;
  message: string;
  token: string;
  user: {
    id: number;
    username: string;
    role: "ADMIN" | "STAFF";
    full_name: string;
    staff_id: string;
  };
}

export default function LoginPage() {
  const { login } = useAuth();
  const { company } = useCompany();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("Please fill in both Username and Password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await api.post<LoginResponse>("/api/auth/login", {
        username: username.trim(),
        password,
      });

      login(res.user, res.token);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(circle at 50% 20%, rgba(16, 185, 129, 0.12) 0%, rgba(15, 23, 42, 0.98) 70%), var(--bg-root)",
        padding: "1.5rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "440px",
          background: "rgba(15, 23, 42, 0.85)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: "1.25rem",
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.4), 0 0 30px rgba(16, 185, 129, 0.15)",
          padding: "2.25rem",
        }}
      >
        {/* Dynamic Company Header */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div
            style={{
              display: "inline-flex",
              background: "#ffffff",
              padding: "0.75rem 1.25rem",
              borderRadius: "0.875rem",
              boxShadow: "0 8px 20px rgba(0,0,0,0.2)",
              marginBottom: "1.25rem",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "56px",
              minWidth: "120px",
            }}
          >
            {company.logo_data ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={company.logo_data}
                alt={company.company_name || "Company Logo"}
                style={{ height: "48px", maxHeight: "48px", maxWidth: "200px", objectFit: "contain" }}
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Building2 size={24} color="#10b981" />
                <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>
                  {company.company_name || "ERP System"}
                </span>
              </div>
            )}
          </div>
          <h1 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#f8fafc", letterSpacing: "-0.02em" }}>
            {company.company_name || "Corporate ERP Portal"}
          </h1>
          <p style={{ fontSize: "0.825rem", color: "#94a3b8", marginTop: "4px" }}>
            {company.tagline || "Enterprise Resource Planning & Inventory Management"}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            style={{
              padding: "0.75rem 1rem",
              borderRadius: "0.625rem",
              background: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#fca5a5",
              fontSize: "0.8rem",
              display: "flex",
              alignItems: "center",
              gap: "0.625rem",
              marginBottom: "1.5rem",
            }}
          >
            <AlertCircle size={16} color="#ef4444" style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.125rem" }}>
          <div>
            <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "#cbd5e1", marginBottom: "0.375rem", display: "block" }}>
              Username / Staff User ID
            </label>
            <div style={{ position: "relative" }}>
              <User size={16} color="#64748b" style={{ position: "absolute", left: "0.875rem", top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. admin or staff"
                className="input"
                style={{ paddingLeft: "2.5rem" }}
                id="login-username-input"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "#cbd5e1", marginBottom: "0.375rem", display: "block" }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <Lock size={16} color="#64748b" style={{ position: "absolute", left: "0.875rem", top: "50%", transform: "translateY(-50%)" }} />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password…"
                className="input"
                style={{ paddingLeft: "2.5rem", paddingRight: "2.5rem" }}
                id="login-password-input"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: "0.75rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: "#64748b",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{
              padding: "0.875rem",
              marginTop: "0.5rem",
              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              border: "none",
              fontWeight: 700,
              fontSize: "0.9rem",
              boxShadow: "0 4px 14px rgba(16, 185, 129, 0.35)",
              justifyContent: "center",
            }}
            id="login-submit-btn"
          >
            {loading ? (
              <span>Signing in...</span>
            ) : (
              <>
                <span>Sign In to ERP Portal</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
