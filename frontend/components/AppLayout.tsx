"use client";
import AppLayoutWrapper from "./AppLayoutWrapper";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppLayoutWrapper>{children}</AppLayoutWrapper>;
}

