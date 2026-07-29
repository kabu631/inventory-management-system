"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, BookOpen, Package,
  Users, Landmark, BarChart3, Sun, Moon, ShieldCheck,
  Building2, Truck, ShieldAlert, LogOut, Shield, User as UserIcon, TrendingUp
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { href: "/",           label: "Dashboard",          icon: LayoutDashboard },
  { href: "/journal",    label: "Journal & Tax",      icon: BookOpen },
  { href: "/investors",  label: "Investors & Capital",icon: TrendingUp },
  { href: "/inventory",  label: "Inventory & Stock",  icon: Package },
  { href: "/warehouses", label: "Warehouses",         icon: Building2 },
  { href: "/suppliers",  label: "Suppliers & PO",     icon: Truck },
  { href: "/warranty",   label: "Serials & Warranty", icon: ShieldAlert },
  { href: "/customers",  label: "Customers",          icon: Users },
  { href: "/loans",      label: "Bank Loans",         icon: Landmark },
  { href: "/analytics",  label: "Analytics",          icon: BarChart3 },
  { href: "/settings",   label: "Data & Backup",      icon: ShieldCheck },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();

  const isAdmin = user?.role === "ADMIN";
  const isAccountant = user?.role === "ACCOUNTANT";

  return (
    <aside
      style={{
        position: "fixed",
        top: 0, left: 0, bottom: 0,
        width: "16rem",
        background: "var(--bg-sidebar)",
        borderRight: "1px solid var(--border-sidebar)",
        display: "flex",
        flexDirection: "column",
        padding: "1.5rem 0.875rem",
        backdropFilter: "blur(20px)",
        zIndex: 50,
        transition: "background 0.25s ease, border-color 0.25s ease",
      }}
    >
      {/* Official Company Logo */}
      <div style={{ marginBottom: "1.5rem", padding: "0 0.25rem" }}>
        <div style={{
          background: "#ffffff",
          padding: "0.625rem 0.75rem",
          borderRadius: "0.625rem",
          border: "1px solid rgba(255,255,255,0.15)",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Renew Gen Resources"
            style={{ width: "100%", maxHeight: "54px", objectFit: "contain" }}
          />
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        <p style={{
          fontSize: "0.65rem", fontWeight: 600,
          color: "var(--text-faint)",
          textTransform: "uppercase", letterSpacing: "0.08em",
          padding: "0 0.5rem", marginBottom: "0.375rem",
        }}>
          {isAdmin ? "Admin Navigation" : isAccountant ? "Accountant Audit Menu" : "Staff Operations Menu"}
        </p>
        {navItems
          .filter(({ href }) => {
            if (isAdmin) return true;
            if (isAccountant) return ["/", "/journal", "/inventory", "/warehouses", "/warranty", "/customers"].includes(href);
            // STAFF
            return !["/journal", "/loans", "/analytics", "/settings", "/investors"].includes(href);
          })
          .map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Link key={href} href={href} className={`nav-link${isActive ? " active" : ""}`}>
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
      </nav>

      {/* User Profile Badge */}
      {user && (
        <div style={{
          padding: "0.75rem",
          borderRadius: "0.625rem",
          background: isAdmin ? "rgba(16, 185, 129, 0.08)" : isAccountant ? "rgba(245, 158, 11, 0.08)" : "rgba(99, 102, 241, 0.08)",
          border: `1px solid ${isAdmin ? "rgba(16, 185, 129, 0.25)" : isAccountant ? "rgba(245, 158, 11, 0.25)" : "rgba(99, 102, 241, 0.25)"}`,
          marginBottom: "0.75rem",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
            <span style={{
              fontSize: "0.65rem",
              fontWeight: 800,
              padding: "1px 6px",
              borderRadius: "4px",
              background: isAdmin ? "#10b981" : isAccountant ? "#f59e0b" : "#6366f1",
              color: "#ffffff",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}>
              {user.role}
            </span>
            <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "monospace" }}>
              {user.staff_id}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{
              width: "28px", height: "28px", borderRadius: "50%",
              background: isAdmin ? "linear-gradient(135deg, #10b981, #059669)" : "linear-gradient(135deg, #6366f1, #4f46e5)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, color: "#fff", fontSize: "0.7rem", flexShrink: 0
            }}>
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div style={{ overflow: "hidden", flex: 1 }}>
              <p style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-primary)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user.username}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Theme Toggle + Logout */}
      <div style={{
        borderTop: "1px solid var(--border)",
        paddingTop: "0.75rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
      }}>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={toggle}
            className="theme-toggle"
            style={{ flex: 1 }}
            id="theme-toggle-btn"
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            <span>{theme === "dark" ? "Light" : "Dark"}</span>
          </button>

          <button
            onClick={logout}
            className="btn btn-ghost"
            style={{
              padding: "0.375rem 0.625rem",
              fontSize: "0.75rem",
              color: "#ef4444",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              background: "rgba(239, 68, 68, 0.05)",
            }}
            id="logout-btn"
            title="Sign out of ERP Portal"
          >
            <LogOut size={14} />
            <span>Logout</span>
          </button>
        </div>

        <p style={{ fontSize: "0.68rem", color: "var(--text-faint)", paddingLeft: "0.25rem", marginTop: "2px" }}>
          Renew Gen ERP · NPR Currency
        </p>
      </div>
    </aside>
  );
}
