"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, BookOpen, Package,
  Users, Landmark, BarChart3, Sun, Moon, ShieldCheck,
  Building2, Truck, ShieldAlert, LogOut, User as UserIcon, Shield
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";

const allNavItems = [
  { href: "/",           label: "Dashboard",          icon: LayoutDashboard, roles: ["ADMIN"] },
  { href: "/inventory",  label: "Inventory & Stock",  icon: Package,         roles: ["ADMIN", "STAFF"] },
  { href: "/warranty",   label: "Serials & Warranty", icon: ShieldAlert,     roles: ["ADMIN", "STAFF"] },
  { href: "/warehouses", label: "Warehouses",         icon: Building2,       roles: ["ADMIN", "STAFF"] },
  { href: "/suppliers",  label: "Suppliers & PO",     icon: Truck,           roles: ["ADMIN", "STAFF"] },
  { href: "/customers",  label: "Customers",          icon: Users,           roles: ["ADMIN", "STAFF"] },
  { href: "/journal",    label: "Journal & Tax",      icon: BookOpen,        roles: ["ADMIN"] },
  { href: "/loans",      label: "Bank Loans",         icon: Landmark,        roles: ["ADMIN"] },
  { href: "/analytics",  label: "Analytics",          icon: BarChart3,       roles: ["ADMIN"] },
  { href: "/settings",   label: "Data & Backup",      icon: ShieldCheck,     roles: ["ADMIN"] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();

  const role = user?.role || "STAFF";
  const navItems = allNavItems.filter(item => item.roles.includes(role));

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
      <div style={{ marginBottom: "1.25rem", padding: "0 0.25rem" }}>
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
            alt="ONIN Infosys Pvt. Ltd."
            style={{ width: "100%", maxHeight: "56px", objectFit: "contain" }}
          />
        </div>
      </div>

      {/* User Session Profile Badge */}
      {user && (
        <div
          style={{
            marginBottom: "1.25rem",
            padding: "0.625rem 0.75rem",
            borderRadius: "0.625rem",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", overflow: "hidden" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                background: role === "ADMIN" ? "rgba(129,140,248,0.2)" : "rgba(34,197,94,0.2)",
                color: role === "ADMIN" ? "#818cf8" : "#22c55e",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: "0.8rem",
                flexShrink: 0,
              }}
            >
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div style={{ overflow: "hidden" }}>
              <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user.full_name || user.username}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span
                  style={{
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    color: role === "ADMIN" ? "#818cf8" : "#22c55e",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {role}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={logout}
            title="Sign out of system"
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: "4px",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
            }}
            id="sidebar-logout-btn"
          >
            <LogOut size={15} />
          </button>
        </div>
      )}

      {/* Nav */}
      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.25rem", overflowY: "auto" }}>
        <p style={{
          fontSize: "0.65rem", fontWeight: 600,
          color: "var(--text-faint)",
          textTransform: "uppercase", letterSpacing: "0.08em",
          padding: "0 0.5rem", marginBottom: "0.375rem",
        }}>
          Navigation
        </p>
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link key={href} href={href} className={`nav-link${isActive ? " active" : ""}`}>
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Theme Toggle + Footer */}
      <div style={{
        borderTop: "1px solid var(--border)",
        paddingTop: "1rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
      }}>
        {/* Toggle button */}
        <button
          onClick={toggle}
          className="theme-toggle"
          id="theme-toggle-btn"
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? (
            <>
              <Sun size={14} />
              <span>Light Mode</span>
            </>
          ) : (
            <>
              <Moon size={14} />
              <span>Dark Mode</span>
            </>
          )
          }
        </button>

        <p style={{ fontSize: "0.7rem", color: "var(--text-faint)", paddingLeft: "0.25rem" }}>
          v1.0.0 · RBAC Active
        </p>
      </div>
    </aside>
  );
}
