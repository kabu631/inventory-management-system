import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { ThemeProvider } from "@/contexts/ThemeContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Renew Gen Resources Nepal Pvt. Ltd.",
  description: "Renew Gen Resources Nepal Pvt. Ltd. ERP System",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={inter.className}
        style={{ background: "var(--bg-root)", color: "var(--text-primary)", minHeight: "100vh" }}
      >
        <ThemeProvider>
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
        </ThemeProvider>
      </body>
    </html>
  );
}
