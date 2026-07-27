"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, BookOpen, Package,
  Users, Landmark, BarChart3, Zap, Sun, Moon, ShieldCheck,
  Building2, Truck, ShieldAlert,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

const navItems = [
  { href: "/",           label: "Dashboard",          icon: LayoutDashboard },
  { href: "/journal",    label: "Journal & Tax",      icon: BookOpen },
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
      <div style={{ marginBottom: "1.75rem", padding: "0 0.25rem" }}>
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
            alt="Renew Gen Resources Nepal Pvt. Ltd."
            style={{ width: "100%", maxHeight: "56px", objectFit: "contain" }}
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
          )}
        </button>

        <p style={{ fontSize: "0.7rem", color: "var(--text-faint)", paddingLeft: "0.25rem" }}>
          v1.0.0 · NPR Currency
        </p>
      </div>
    </aside>
  );
}
