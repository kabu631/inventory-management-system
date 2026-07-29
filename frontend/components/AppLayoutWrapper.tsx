"use client";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { useAuth } from "@/contexts/AuthContext";

export default function AppLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const normalizedPath = pathname?.replace(/\/$/, "") || "/";
  const isLoginPage = normalizedPath === "/login";

  if (isLoginPage) {
    return <main style={{ minHeight: "100vh", background: "var(--bg-root)" }}>{children}</main>;
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--bg-root)" }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect via AuthContext
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <main
        style={{
          flex: 1,
          marginLeft: "16rem",
          padding: "2rem",
          overflow: "auto",
          background: "var(--bg-root)",
          minHeight: "100vh",
          transition: "background 0.25s ease",
        }}
      >
        {children}
      </main>
    </div>
  );
}
