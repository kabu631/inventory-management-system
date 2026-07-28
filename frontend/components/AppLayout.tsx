"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { useAuth } from "@/contexts/AuthContext";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const isLoginPage = pathname ? pathname.startsWith("/login") : false;

  useEffect(() => {
    if (!loading) {
      if (!user && !isLoginPage) {
        router.push("/login");
      } else if (user && user.role === "STAFF") {
        const adminOnlyRoutes = ["/", "/journal", "/loans", "/analytics", "/settings"];
        const cleanPath = pathname ? (pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname) : "/";
        if (adminOnlyRoutes.includes(cleanPath)) {
          router.push("/inventory");
        }
      }
    }
  }, [loading, user, isLoginPage, pathname, router]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center" }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!user) {
    return null;
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
