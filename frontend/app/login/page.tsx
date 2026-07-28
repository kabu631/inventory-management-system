"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Lock, User as UserIcon, ShieldAlert, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Please fill in both username and password");
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      const u = await login(username, password);
      if (u.role === "STAFF") {
        router.push("/inventory");
      } else {
        router.push("/");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid credentials");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(circle at 50% 20%, rgba(99,102,241,0.12) 0%, var(--bg-root) 70%)",
        padding: "1.5rem",
      }}
    >
      <div
        className="card"
        style={{
          width: "440px",
          maxWidth: "100%",
          padding: "2.5rem 2rem",
          backdropFilter: "blur(20px)",
          border: "1px solid var(--border)",
          boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
          borderRadius: "1.25rem",
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div
            style={{
              background: "#ffffff",
              padding: "0.75rem 1rem",
              borderRadius: "0.875rem",
              display: "inline-block",
              boxShadow: "0 6px 16px rgba(0,0,0,0.15)",
              marginBottom: "1.25rem",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="ONIN Infosys Pvt. Ltd."
              style={{ height: "48px", objectFit: "contain" }}
            />
          </div>
          <h1 style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--text-primary)" }}>
            ERP Access Portal
          </h1>
          <p className="text-muted" style={{ fontSize: "0.825rem", marginTop: "0.35rem" }}>
            ONIN Infosys Pvt. Ltd. — Pako, New Road, Kathmandu
          </p>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: "1.25rem", fontSize: "0.825rem" }}>
            <ShieldAlert size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
          <div>
            <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "0.4rem" }}>
              Username / Account ID
            </label>
            <div style={{ position: "relative" }}>
              <UserIcon
                size={16}
                style={{ position: "absolute", left: "0.875rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)" }}
              />
              <input
                type="text"
                className="input"
                style={{ paddingLeft: "2.5rem" }}
                placeholder="Enter username (e.g. admin or staff)"
                value={username}
                onChange={e => setUsername(e.target.value)}
                id="login-username-input"
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "0.4rem" }}>
              Security Password
            </label>
            <div style={{ position: "relative" }}>
              <Lock
                size={16}
                style={{ position: "absolute", left: "0.875rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)" }}
              />
              <input
                type="password"
                className="input"
                style={{ paddingLeft: "2.5rem" }}
                placeholder="Enter password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                id="login-password-input"
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
            style={{ marginTop: "0.5rem", padding: "0.75rem", fontWeight: 600, fontSize: "0.9rem", width: "100%", justifyContent: "center" }}
            id="login-submit-btn"
          >
            {submitting ? "Authenticating..." : <>Sign In to Dashboard <ArrowRight size={16} /></>}
          </button>
        </form>
      </div>
    </div>
  );
}
