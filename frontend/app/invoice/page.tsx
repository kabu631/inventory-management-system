"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { api, formatNPR, formatDate } from "@/lib/api";
import { Printer, ArrowLeft, Building2 } from "lucide-react";
import Link from "next/link";

interface InvoiceData {
  invoice_no: string;
  invoice_date: string;
  narration: string;
  total_amount_npr: number;
  company_info: {
    name: string;
    company_name?: string;
    pan_vat_no: string;
    address: string;
    phone: string;
    email: string;
    website?: string;
    logo_data?: string;
    terms_and_conditions?: string;
    invoice_footer?: string;
  };
  customer: {
    name: string;
    phone: string;
    email: string;
    address: string;
    customer_type: string;
    pan_no?: string;
  };
  lines: Array<{
    account_code: string;
    account_name: string;
    hs_code?: string;
    debit_npr: number;
    credit_npr: number;
    description: string;
  }>;
}

function InvoiceContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [data, setData] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) {
      setError("No invoice ID specified.");
      setLoading(false);
      return;
    }
    api.get<InvoiceData>(`/api/inventory/invoices/journal-entry/${id}`)
      .then(setData)
      .catch(e => setError(e.message || "Failed to load invoice details"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div style={{ padding: "4rem", textAlign: "center" }}><div className="spinner" /></div>;
  }

  if (error || !data) {
    return (
      <div style={{ padding: "3rem", textAlign: "center" }}>
        <p style={{ color: "#ef4444", fontWeight: 600 }}>{error || "Invoice not found"}</p>
        <Link href="/journal" className="btn btn-ghost" style={{ marginTop: "1rem" }}>
          <ArrowLeft size={16} /> Back to Journal
        </Link>
      </div>
    );
  }

  const companyName = data.company_info.company_name || data.company_info.name || "Corporate Enterprise";
  const logoSrc = data.company_info.logo_data || "/logo.png";
  const termsText = data.company_info.terms_and_conditions || "1. Goods once sold are not returnable without authorization.\n2. Warranty claims require original tax invoice.\n3. Subject to local jurisdiction.";
  const footerNote = data.company_info.invoice_footer || "Thank you for your business! This is a computer-generated tax invoice.";

  return (
    <div className="invoice-container" style={{ maxWidth: "840px", margin: "0 auto", padding: "1rem" }}>
      {/* Action Header (Hidden when printing) */}
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <Link href="/journal" className="btn btn-ghost">
          <ArrowLeft size={16} /> Back to Daily Journal
        </Link>
        <button className="btn btn-primary" onClick={() => window.print()} id="print-tax-inv-btn">
          <Printer size={16} /> Print Official A4 Tax Invoice / Save PDF
        </button>
      </div>

      {/* Printable A4 Document Sheet */}
      <div
        className="card invoice-sheet"
        style={{
          background: "#ffffff",
          color: "#0f172a",
          padding: "2.5rem",
          borderRadius: "0.75rem",
          boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
          fontFamily: "sans-serif",
          border: "1px solid #e2e8f0",
        }}
      >
        {/* Company Letterhead */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #0369a1", paddingBottom: "1.25rem", marginBottom: "1.5rem" }}>
          <div style={{ maxWidth: "60%" }}>
            {logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoSrc}
                alt={companyName}
                style={{ maxHeight: "56px", maxWidth: "220px", objectFit: "contain", marginBottom: "0.5rem", display: "block" }}
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <Building2 size={28} color="#0369a1" />
                <h1 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>{companyName}</h1>
              </div>
            )}
            <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a", margin: "0 0 2px 0" }}>{companyName}</h3>
            <p style={{ fontSize: "0.8rem", color: "#475569", margin: "1px 0" }}>{data.company_info.address}</p>
            <p style={{ fontSize: "0.8rem", color: "#475569", margin: "1px 0" }}>
              Phone: {data.company_info.phone} {data.company_info.email ? `· Email: ${data.company_info.email}` : ""}
            </p>
            {data.company_info.website && (
              <p style={{ fontSize: "0.78rem", color: "#64748b", margin: "1px 0" }}>Web: {data.company_info.website}</p>
            )}
            <p style={{ fontSize: "0.85rem", fontWeight: 800, color: "#0369a1", marginTop: "6px" }}>
              PAN / VAT REGISTRATION NO: {data.company_info.pan_vat_no || "N/A"}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#0284c7", textTransform: "uppercase", margin: 0 }}>
              TAX INVOICE
            </h2>
            <p style={{ fontSize: "0.85rem", fontWeight: 700, color: "#0f172a", marginTop: "4px" }}>
              Invoice #: <span style={{ fontFamily: "monospace", color: "#0369a1" }}>{data.invoice_no}</span>
            </p>
            <p style={{ fontSize: "0.8rem", color: "#475569" }}>Date: {formatDate(data.invoice_date)}</p>
          </div>
        </div>

        {/* Customer Details */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", background: "#f8fafc", padding: "1rem", borderRadius: "0.5rem", border: "1px solid #e2e8f0", marginBottom: "1.5rem" }}>
          <div>
            <p style={{ fontSize: "0.7rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>Billed To (Buyer)</p>
            <p style={{ fontSize: "1rem", fontWeight: 700, color: "#0f172a", marginTop: "2px" }}>{data.customer.name}</p>
            <p style={{ fontSize: "0.8rem", color: "#475569" }}>Address: {data.customer.address}</p>
            <p style={{ fontSize: "0.8rem", color: "#475569" }}>Phone: {data.customer.phone}</p>
            <p style={{ fontSize: "0.8rem", fontWeight: 700, color: "#0369a1", marginTop: "2px" }}>
              Buyer PAN / VAT No: {data.customer.pan_no || "N/A"}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: "0.7rem", color: "#64748b", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>Transaction Summary</p>
            <p style={{ fontSize: "0.85rem", color: "#0f172a", marginTop: "2px", fontWeight: 500 }}>{data.narration}</p>
            <span style={{ display: "inline-block", marginTop: "6px", padding: "2px 8px", background: "#e0e7ff", color: "#3730a3", borderRadius: "4px", fontSize: "0.75rem", fontWeight: 700 }}>
              {data.customer.customer_type} CUSTOMER
            </span>
          </div>
        </div>

        {/* Line Items Table */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "1.5rem" }}>
          <thead>
            <tr style={{ background: "#1e1b4b", color: "#ffffff", textAlign: "left", fontSize: "0.8rem", textTransform: "uppercase" }}>
              <th style={{ padding: "0.625rem 0.875rem" }}>Account Code</th>
              <th style={{ padding: "0.625rem 0.875rem" }}>HS Code</th>
              <th style={{ padding: "0.625rem 0.875rem" }}>Description / Account Name</th>
              <th style={{ padding: "0.625rem 0.875rem", textAlign: "right" }}>Debit (NPR)</th>
              <th style={{ padding: "0.625rem 0.875rem", textAlign: "right" }}>Credit (NPR)</th>
            </tr>
          </thead>
          <tbody>
            {data.lines.filter(l => !["5001", "1004"].includes(l.account_code)).map((l, idx) => (
              <tr key={idx} style={{ borderBottom: "1px solid #e2e8f0", fontSize: "0.85rem", background: idx % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                <td style={{ padding: "0.625rem 0.875rem", fontFamily: "monospace", fontWeight: 700, color: "#4338ca" }}>{l.account_code}</td>
                <td style={{ padding: "0.625rem 0.875rem", fontFamily: "monospace", fontWeight: 600, color: "#047857" }}>{l.hs_code || "—"}</td>
                <td style={{ padding: "0.625rem 0.875rem" }}>
                  <div style={{ fontWeight: 600 }}>{l.account_name}</div>
                  {l.description && <div style={{ fontSize: "0.75rem", color: "#64748b" }}>{l.description}</div>}
                </td>
                <td style={{ padding: "0.625rem 0.875rem", textAlign: "right", fontWeight: l.debit_npr > 0 ? 700 : 400 }}>
                  {l.debit_npr > 0 ? formatNPR(l.debit_npr) : "—"}
                </td>
                <td style={{ padding: "0.625rem 0.875rem", textAlign: "right", fontWeight: l.credit_npr > 0 ? 700 : 400 }}>
                  {l.credit_npr > 0 ? formatNPR(l.credit_npr) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Invoice Total & Summary */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: "1rem", paddingTop: "1rem", borderTop: "2px solid #e2e8f0" }}>
          <div style={{ maxWidth: "55%" }}>
            <p style={{ fontSize: "0.75rem", fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.25rem" }}>
              Terms &amp; Conditions
            </p>
            <div style={{ fontSize: "0.72rem", color: "#64748b", lineHeight: 1.45, whiteSpace: "pre-line", background: "#f8fafc", padding: "0.5rem 0.75rem", borderRadius: "0.375rem", border: "1px solid #e2e8f0" }}>
              {termsText}
            </div>
            <p style={{ fontSize: "0.72rem", color: "#475569", marginTop: "0.5rem", fontWeight: 500 }}>
              {footerNote}
            </p>
          </div>
          <div style={{ textAlign: "right", minWidth: "220px" }}>
            <p style={{ fontSize: "0.8rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Total Invoice Amount</p>
            <p style={{ fontSize: "1.5rem", fontWeight: 800, color: "#4338ca", marginTop: "2px" }}>{formatNPR(data.total_amount_npr)}</p>
            <div style={{ marginTop: "2rem", borderTop: "1px dashed #cbd5e1", paddingTop: "0.5rem", minWidth: "200px" }}>
              <p style={{ fontSize: "0.75rem", color: "#475569", fontWeight: 600 }}>Authorized Signature</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InvoicePrintPage() {
  return (
    <Suspense fallback={<div style={{ padding: "4rem", textAlign: "center" }}><div className="spinner" /></div>}>
      <InvoiceContent />
    </Suspense>
  );
}
