"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { api, getAuthToken, formatNPR } from "@/lib/api";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany, CompanyProfile } from "@/contexts/CompanyContext";
import {
  ShieldCheck, Download, Upload, RefreshCw,
  Building2, CheckCircle2, AlertCircle, Clock, Cloud, ShieldAlert,
  Image as ImageIcon, FileText, Globe, Phone, Mail, MapPin, Hash,
  Sparkles, RotateCcw, Eye, Save, Trash2
} from "lucide-react";

interface BackupItem {
  filename: string;
  filepath: string;
  size_bytes: number;
  created_at: string;
  is_latest: boolean;
}

interface BackupInfo {
  backup_directory: string;
  latest_backup_file: string;
  backups: BackupItem[];
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { company, updateCompany, refreshCompany } = useCompany();

  // Tab State
  const [activeTab, setActiveTab] = useState<"branding" | "backup">("branding");

  // Company Form State
  const [formData, setFormData] = useState<CompanyProfile>(company);
  const [savingBranding, setSavingBranding] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string>(company.logo_data || "/logo.png");
  const [previewPaperMode, setPreviewPaperMode] = useState<"light" | "dark">("light");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Backup State
  const [backupData, setBackupData] = useState<BackupInfo | null>(null);
  const [loadingBackups, setLoadingBackups] = useState(true);
  const [restoring, setRestoring] = useState(false);
  const [selectedDbFile, setSelectedDbFile] = useState<File | null>(null);

  // Notifications
  const [msg, setMsg] = useState({ text: "", type: "" });

  const isAuthorized = !user || user.role === "ADMIN" || user.role === "STAFF";

  // Sync formData whenever company context updates
  useEffect(() => {
    setFormData(company);
    setLogoPreview(company.logo_data || "/logo.png");
  }, [company]);

  const loadBackupData = useCallback(() => {
    if (!isAuthorized) {
      setLoadingBackups(false);
      return;
    }
    setLoadingBackups(true);
    api.get<BackupInfo>("/api/backup/list")
      .then(res => {
        if (res && Array.isArray(res.backups)) {
          setBackupData(res);
        } else {
          setBackupData({ backup_directory: "", latest_backup_file: "", backups: [] });
        }
      })
      .catch(err => setMsg({ text: err.message || "Failed to fetch backup info", type: "error" }))
      .finally(() => setLoadingBackups(false));
  }, [isAuthorized]);

  useEffect(() => {
    if (activeTab === "backup") {
      loadBackupData();
    }
  }, [activeTab, loadBackupData]);

  const flashMsg = (text: string, type: "success" | "error") => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: "", type: "" }), 5000);
  };

  if (!isAuthorized) {
    return (
      <div style={{ padding: "4rem", textAlign: "center" }}>
        <div style={{ display: "inline-flex", padding: "1rem", borderRadius: "50%", background: "rgba(239, 68, 68, 0.1)", marginBottom: "1rem" }}>
          <ShieldAlert size={36} color="#ef4444" />
        </div>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)" }}>Admin Access Required</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "0.5rem", maxWidth: "420px", margin: "0.5rem auto 1.5rem" }}>
          System branding configuration and database disaster recovery are restricted strictly to authorized staff &amp; administrators.
        </p>
        <Link href="/inventory" className="btn btn-primary">Go to Product Sales &amp; Catalog</Link>
      </div>
    );
  }

  // --- BRANDING HANDLERS ---
  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      flashMsg("Please select a valid image file (PNG, JPG, SVG, WebP).", "error");
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      flashMsg("Logo file size should be less than 3MB.", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setLogoPreview(result);
      setFormData(prev => ({ ...prev, logo_data: result }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.company_name.trim()) {
      flashMsg("Company Name is required.", "error");
      return;
    }

    setSavingBranding(true);
    try {
      await updateCompany({
        company_name: formData.company_name.trim(),
        tagline: formData.tagline?.trim() || "",
        business_type: formData.business_type?.trim() || "Commercial Trading & Distribution",
        product_term: formData.product_term?.trim() || "Product",
        product_term_plural: formData.product_term_plural?.trim() || "Products",
        pan_vat_no: formData.pan_vat_no?.trim() || "",
        phone: formData.phone?.trim() || "",
        email: formData.email?.trim() || "",
        address: formData.address?.trim() || "",
        website: formData.website?.trim() || "",
        logo_data: formData.logo_data || logoPreview,
        terms_and_conditions: formData.terms_and_conditions || "",
        invoice_footer: formData.invoice_footer || "",
        currency_symbol: formData.currency_symbol || "NPR",
      });
      flashMsg("Company branding & profile saved successfully! App updated.", "success");
    } catch (err: unknown) {
      flashMsg(err instanceof Error ? err.message : "Failed to update company branding", "error");
    } finally {
      setSavingBranding(false);
    }
  };

  const handleResetDefaultLogo = () => {
    setLogoPreview("/logo.png");
    setFormData(prev => ({ ...prev, logo_data: "/logo.png" }));
  };

  const handleResetToFactoryDefaults = async () => {
    if (!confirm("Are you sure you want to reset company details and terms to default template?")) {
      return;
    }
    try {
      const res = await api.post<{ status: string; company: CompanyProfile }>("/api/company/reset-default", {});
      if (res.company) {
        setFormData(res.company);
        setLogoPreview(res.company.logo_data || "/logo.png");
      }
      await refreshCompany();
      flashMsg("Company settings reset to default template.", "success");
    } catch (err: unknown) {
      flashMsg(err instanceof Error ? err.message : "Reset failed", "error");
    }
  };

  // --- BACKUP HANDLERS ---
  const handleTriggerBackup = async () => {
    try {
      await api.post("/api/backup/trigger", {});
      flashMsg("Fresh database snapshot created successfully!", "success");
      loadBackupData();
    } catch (e: unknown) {
      flashMsg(e instanceof Error ? e.message : "Backup failed", "error");
    }
  };

  const handleRestoreNamed = async (filename: string) => {
    if (!confirm(`Are you sure you want to restore the system state to '${filename}'? Current data will be replaced.`)) {
      return;
    }
    setRestoring(true);
    try {
      const res = await api.post<{ status: string; message: string }>(
        `/api/backup/restore-named?filename=${encodeURIComponent(filename)}`, {}
      );
      flashMsg(res.message, "success");
      setTimeout(() => window.location.reload(), 1500);
    } catch (e: unknown) {
      flashMsg(e instanceof Error ? e.message : "Restore failed", "error");
    } finally {
      setRestoring(false);
    }
  };

  const handleUploadRestore = async () => {
    if (!selectedDbFile) return;
    if (!confirm(`Are you sure you want to restore database from uploaded file '${selectedDbFile.name}'?`)) {
      return;
    }
    setRestoring(true);
    const formDataUpload = new FormData();
    formDataUpload.append("file", selectedDbFile);

    try {
      const token = getAuthToken();
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}/api/backup/restore-file`, {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formDataUpload,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || "Restore failed");
      flashMsg(result.message, "success");
      setSelectedDbFile(null);
      setTimeout(() => window.location.reload(), 1500);
    } catch (e: unknown) {
      flashMsg(e instanceof Error ? e.message : "Restore failed", "error");
    } finally {
      setRestoring(false);
    }
  };

  const handleDownloadBackup = async () => {
    try {
      const token = getAuthToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}/api/backup/download`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Download failed");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safePrefix = (formData.company_name || "erp").toLowerCase().replace(/[^a-z0-9]/g, "_");
      a.download = `${safePrefix}_backup_${new Date().toISOString().split("T")[0]}.db`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      flashMsg("Database backup downloaded successfully!", "success");
    } catch (e: unknown) {
      flashMsg(e instanceof Error ? e.message : "Download failed", "error");
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-info">
          <h1 className="page-title">Settings &amp; System Configuration</h1>
          <p className="text-muted" style={{ fontSize: "0.875rem", marginTop: "0.25rem" }}>
            Customize your company identity, logo, PAN/VAT, invoice terms, and database disaster backups
          </p>
        </div>
        <div className="page-actions" style={{ display: "flex", gap: "0.5rem" }}>
          {activeTab === "branding" ? (
            <button
              className="btn btn-primary"
              onClick={handleSaveBranding}
              disabled={savingBranding}
              id="save-branding-top-btn"
            >
              <Save size={15} /> {savingBranding ? "Saving Changes..." : "Save Branding Settings"}
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleTriggerBackup} id="backup-now-btn">
              <RefreshCw size={15} /> Backup Database Now
            </button>
          )}
        </div>
      </div>

      {/* Alert Messages */}
      {msg.text && (
        <div className={`alert ${msg.type === "success" ? "alert-success" : "alert-error"}`} style={{ marginBottom: "1.25rem" }}>
          {msg.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {msg.text}
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid var(--border)", marginBottom: "1.5rem" }}>
        <button
          type="button"
          onClick={() => setActiveTab("branding")}
          id="tab-branding-btn"
          style={{
            padding: "0.625rem 1.25rem",
            fontSize: "0.875rem",
            fontWeight: 700,
            cursor: "pointer",
            background: "none",
            border: "none",
            borderBottom: activeTab === "branding" ? "2px solid #10b981" : "2px solid transparent",
            color: activeTab === "branding" ? "#10b981" : "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            transition: "all 0.2s ease",
          }}
        >
          <Building2 size={16} />
          <span>Company Profile &amp; Branding</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("backup")}
          id="tab-backup-btn"
          style={{
            padding: "0.625rem 1.25rem",
            fontSize: "0.875rem",
            fontWeight: 700,
            cursor: "pointer",
            background: "none",
            border: "none",
            borderBottom: activeTab === "backup" ? "2px solid #6366f1" : "2px solid transparent",
            color: activeTab === "backup" ? "#818cf8" : "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            transition: "all 0.2s ease",
          }}
        >
          <ShieldCheck size={16} />
          <span>Database &amp; Cloud Backup</span>
        </button>
      </div>

      {/* TAB 1: COMPANY PROFILE & BRANDING */}
      {activeTab === "branding" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "1.5rem", alignItems: "start" }}>
          {/* Left Column: Form Fields */}
          <form onSubmit={handleSaveBranding} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* Section 1: Legal & Company Identity */}
            <div className="card" style={{ padding: "1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem" }}>
                <Building2 size={18} color="#10b981" />
                <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>
                  Company Legal Identity &amp; Tax Info
                </h2>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.35rem" }}>
                    Company Name / Business Title *
                  </label>
                  <input
                    type="text"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    placeholder="e.g. Apex Energy Solutions Pvt. Ltd."
                    className="input"
                    id="branding-company-name"
                    required
                  />
                  <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "4px" }}>
                    Displayed on the top sidebar, login screen, invoices, and exported tax reports.
                  </p>
                </div>

                <div>
                  <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.35rem" }}>
                    Business Tagline / Subtitle
                  </label>
                  <input
                    type="text"
                    value={formData.tagline}
                    onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                    placeholder="e.g. Renewable Energy &amp; Battery Distribution"
                    className="input"
                    id="branding-tagline"
                  />
                </div>

                {/* Free-Text Line of Business / Industry Category */}
                <div>
                  <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.35rem" }}>
                    Line of Business / Industry Category (Written, not selected)
                  </label>
                  <input
                    type="text"
                    value={formData.business_type || ""}
                    onChange={(e) => setFormData({ ...formData, business_type: e.target.value })}
                    placeholder="e.g. Solar &amp; Battery Storage, Electronics, Hardware, Apparel, Auto Parts, FMCG"
                    className="input"
                    id="branding-business-type"
                  />
                  <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "4px" }}>
                    Freely type your business domain or category. The app is universal for any product or service.
                  </p>
                </div>

                {/* Free-Text Custom Item Terminology */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.35rem" }}>
                      Item Term (Singular)
                    </label>
                    <input
                      type="text"
                      value={formData.product_term || ""}
                      onChange={(e) => setFormData({ ...formData, product_term: e.target.value })}
                      placeholder="e.g. Product, Item, Battery, Part, Unit"
                      className="input"
                      id="branding-product-term"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.35rem" }}>
                      Item Term (Plural)
                    </label>
                    <input
                      type="text"
                      value={formData.product_term_plural || ""}
                      onChange={(e) => setFormData({ ...formData, product_term_plural: e.target.value })}
                      placeholder="e.g. Products, Items, Batteries, Parts, Units"
                      className="input"
                      id="branding-product-term-plural"
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.35rem" }}>
                    PAN / VAT Registration Number *
                  </label>
                  <div style={{ position: "relative" }}>
                    <Hash size={15} color="var(--text-muted)" style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)" }} />
                    <input
                      type="text"
                      value={formData.pan_vat_no}
                      onChange={(e) => setFormData({ ...formData, pan_vat_no: e.target.value })}
                      placeholder="e.g. 610464122"
                      className="input"
                      style={{ paddingLeft: "2.25rem", fontFamily: "monospace", fontWeight: 600 }}
                      id="branding-pan-vat"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Contact & Location */}
            <div className="card" style={{ padding: "1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem" }}>
                <Phone size={18} color="#6366f1" />
                <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>
                  Contact Information &amp; Office Address
                </h2>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.35rem" }}>
                    Primary Contact Number / Hotline
                  </label>
                  <div style={{ position: "relative" }}>
                    <Phone size={15} color="var(--text-muted)" style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)" }} />
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="e.g. +977 01-4573200, 9851000000"
                      className="input"
                      style={{ paddingLeft: "2.25rem" }}
                      id="branding-phone"
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.35rem" }}>
                    Official Email Address
                  </label>
                  <div style={{ position: "relative" }}>
                    <Mail size={15} color="var(--text-muted)" style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)" }} />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="e.g. info@company.com"
                      className="input"
                      style={{ paddingLeft: "2.25rem" }}
                      id="branding-email"
                    />
                  </div>
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.35rem" }}>
                    Full Physical Address (Street, City, Country)
                  </label>
                  <div style={{ position: "relative" }}>
                    <MapPin size={15} color="var(--text-muted)" style={{ position: "absolute", left: "0.75rem", top: "1rem" }} />
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="e.g. New Baneshwor, Kathmandu, Nepal"
                      className="input"
                      style={{ paddingLeft: "2.25rem" }}
                      id="branding-address"
                    />
                  </div>
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.35rem" }}>
                    Website URL (Optional)
                  </label>
                  <div style={{ position: "relative" }}>
                    <Globe size={15} color="var(--text-muted)" style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)" }} />
                    <input
                      type="text"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      placeholder="e.g. www.company.com"
                      className="input"
                      style={{ paddingLeft: "2.25rem" }}
                      id="branding-website"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Invoices, Terms & Legal Conditions */}
            <div className="card" style={{ padding: "1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem" }}>
                <FileText size={18} color="#f59e0b" />
                <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>
                  Tax Invoice Terms &amp; Conditions Customization
                </h2>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.35rem" }}>
                    Custom Printable Terms &amp; Conditions
                  </label>
                  <textarea
                    rows={4}
                    value={formData.terms_and_conditions}
                    onChange={(e) => setFormData({ ...formData, terms_and_conditions: e.target.value })}
                    placeholder="Enter numbered or bulleted terms to be printed at the bottom of customer invoices..."
                    className="input"
                    style={{ fontSize: "0.8rem", lineHeight: 1.5, resize: "vertical" }}
                    id="branding-terms"
                  />
                  <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "4px" }}>
                    Printed at the bottom-left of every printable A4 Tax Invoice and Customer Receipt.
                  </p>
                </div>

                <div>
                  <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "0.35rem" }}>
                    Invoice Footer Disclaimer Note
                  </label>
                  <input
                    type="text"
                    value={formData.invoice_footer}
                    onChange={(e) => setFormData({ ...formData, invoice_footer: e.target.value })}
                    placeholder="e.g. Thank you for your business! This is a computer-generated tax invoice."
                    className="input"
                    id="branding-footer"
                  />
                </div>
              </div>
            </div>

            {/* Save Actions Bar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "0.5rem" }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleResetToFactoryDefaults}
                style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}
                id="reset-branding-btn"
              >
                <RotateCcw size={13} style={{ marginRight: 4 }} /> Reset to Default Template
              </button>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={savingBranding}
                id="save-branding-bottom-btn"
                style={{ padding: "0.625rem 1.75rem", fontSize: "0.9rem", fontWeight: 700 }}
              >
                <Save size={16} /> {savingBranding ? "Saving..." : "Save Branding Settings"}
              </button>
            </div>
          </form>

          {/* Right Column: Logo Manager & Live Invoice Preview */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {/* Logo Upload Card */}
            <div className="card" style={{ padding: "1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <ImageIcon size={18} color="#10b981" />
                  <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>
                    Company Logo
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={handleResetDefaultLogo}
                  className="btn btn-ghost"
                  style={{ fontSize: "0.72rem", padding: "0.2rem 0.5rem" }}
                  title="Reset to default logo"
                >
                  <RotateCcw size={12} style={{ marginRight: 3 }} /> Default Logo
                </button>
              </div>

              {/* Logo Preview Container */}
              <div style={{
                background: previewPaperMode === "light" ? "#ffffff" : "#0f172a",
                border: "2px dashed rgba(16, 185, 129, 0.3)",
                borderRadius: "0.75rem",
                padding: "1.5rem",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "130px",
                marginBottom: "1rem",
                transition: "all 0.2s ease",
              }}>
                {logoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoPreview}
                    alt="Company Logo Preview"
                    style={{ maxHeight: "70px", maxWidth: "100%", objectFit: "contain" }}
                  />
                ) : (
                  <div style={{ textAlign: "center", color: previewPaperMode === "light" ? "#64748b" : "#94a3b8" }}>
                    <ImageIcon size={32} style={{ margin: "0 auto 0.5rem", opacity: 0.6 }} />
                    <p style={{ fontSize: "0.8rem", fontWeight: 600 }}>No logo uploaded</p>
                  </div>
                )}
              </div>

              {/* Upload Controls */}
              <input
                type="file"
                ref={fileInputRef}
                accept="image/png, image/jpeg, image/jpg, image/svg+xml, image/webp"
                onChange={handleLogoFileChange}
                style={{ display: "none" }}
                id="logo-file-input"
              />

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ flex: 1, justifyContent: "center" }}
                  onClick={() => fileInputRef.current?.click()}
                  id="choose-logo-btn"
                >
                  <Upload size={14} /> Upload Custom Logo
                </button>
              </div>

              <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.75rem", lineHeight: 1.4 }}>
                Recommended: Transparent PNG or SVG (aspect ratio approx 3:1 or 4:1, max 3MB).
              </p>
            </div>

            {/* Live Letterhead & Invoice Preview Card */}
            <div className="card" style={{ padding: "1.5rem", background: "var(--bg-card)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Eye size={18} color="#6366f1" />
                  <h2 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary)" }}>
                    Live Invoice Letterhead Preview
                  </h2>
                </div>
                <span className="badge badge-indigo" style={{ fontSize: "0.68rem" }}>Real-Time</span>
              </div>

              {/* Simulated A4 Invoice Header */}
              <div style={{
                background: "#ffffff",
                color: "#0f172a",
                borderRadius: "0.5rem",
                padding: "1rem",
                border: "1px solid #e2e8f0",
                fontSize: "0.75rem",
                boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #0369a1", paddingBottom: "0.75rem", marginBottom: "0.75rem" }}>
                  <div style={{ maxWidth: "65%" }}>
                    {logoPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoPreview} alt="Logo" style={{ maxHeight: "32px", maxWidth: "140px", objectFit: "contain", marginBottom: "4px" }} />
                    ) : null}
                    <div style={{ fontWeight: 800, fontSize: "0.85rem", color: "#0f172a" }}>
                      {formData.company_name || "Company Legal Name"}
                    </div>
                    <div style={{ color: "#475569", fontSize: "0.68rem" }}>{formData.address || "Address, Nepal"}</div>
                    <div style={{ color: "#475569", fontSize: "0.68rem" }}>Phone: {formData.phone || "+977 01-XXXXXXX"}</div>
                    <div style={{ fontWeight: 700, color: "#0369a1", fontSize: "0.7rem", marginTop: "3px" }}>
                      PAN/VAT: {formData.pan_vat_no || "XXXXXXXXX"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontWeight: 800, color: "#0284c7", fontSize: "0.85rem" }}>TAX INVOICE</span>
                    <div style={{ color: "#475569", fontSize: "0.68rem", marginTop: "2px" }}>INV-00124</div>
                    <div style={{ color: "#475569", fontSize: "0.68rem" }}>Date: {new Date().toLocaleDateString("en-GB")}</div>
                  </div>
                </div>

                {/* Simulated Terms */}
                <div style={{ background: "#f8fafc", padding: "0.5rem", borderRadius: "4px", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontWeight: 700, fontSize: "0.65rem", color: "#334155", textTransform: "uppercase" }}>Terms &amp; Conditions</div>
                  <div style={{ fontSize: "0.62rem", color: "#64748b", whiteSpace: "pre-line", maxHeight: "60px", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {formData.terms_and_conditions || "1. Goods once sold are not returnable.\n2. Warranty valid with original tax invoice."}
                  </div>
                </div>
              </div>

              <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.75rem", textAlign: "center" }}>
                💡 Click <strong>Save Branding Settings</strong> to apply this branding across the entire ERP portal and printable tax invoices.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DATABASE BACKUP & CLOUD RECOVERY */}
      {activeTab === "backup" && (
        <div>
          {/* Auto-backup & Cloud Sync Status Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
            <div className="kpi-card glow-green">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Auto-Backup Schedule</p>
                  <p style={{ fontSize: "1.1rem", fontWeight: 700, color: "#22c55e", marginTop: "0.375rem" }}>Every 30 Minutes</p>
                  <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "2px" }}>Auto-runs every 30m + on every write entry</p>
                </div>
                <ShieldCheck size={28} color="#22c55e" />
              </div>
            </div>

            <div className="kpi-card glow-indigo">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Google Drive Cloud Sync</p>
                  <p style={{ fontSize: "0.95rem", fontWeight: 700, color: "#818cf8", marginTop: "0.375rem", fontFamily: "monospace" }}>G:\My Drive\ERP_Backups</p>
                  <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "2px" }}>Synced continuously every 30 mins</p>
                </div>
                <Cloud size={28} color="#818cf8" />
              </div>
            </div>

            <div className="kpi-card glow-amber">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Snapshot History</p>
                  <p style={{ fontSize: "1.1rem", fontWeight: 700, color: "#f59e0b", marginTop: "0.375rem" }}>{backupData?.backups?.length || 0} Snapshots</p>
                  <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "2px" }}>Point-in-time state recovery</p>
                </div>
                <Clock size={28} color="#f59e0b" />
              </div>
            </div>
          </div>

          {/* Restore & Download Actions */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", marginBottom: "1.5rem" }}>
            {/* Card 1: Download Offline Backup */}
            <div className="card" style={{ padding: "1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "1rem" }}>
                <Download size={20} color="#6366f1" />
                <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)" }}>
                  Download Manual Backup
                </h2>
              </div>
              <p className="text-muted" style={{ fontSize: "0.8rem", marginBottom: "1.25rem", lineHeight: 1.5 }}>
                Download a full copy of your SQLite database (`erp.db`) including all inventory, customers, journal entries, and custom branding for offline safekeeping.
              </p>
              <button
                onClick={handleDownloadBackup}
                className="btn btn-primary"
                id="download-backup-btn"
              >
                <Download size={15} /> Download Backup (.db)
              </button>
            </div>

            {/* Card 2: Restore from Uploaded File */}
            <div className="card" style={{ padding: "1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "1rem" }}>
                <Upload size={20} color="#22c55e" />
                <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)" }}>
                  System Recovery (Upload &amp; Restore)
                </h2>
              </div>
              <p className="text-muted" style={{ fontSize: "0.8rem", marginBottom: "1rem", lineHeight: 1.5 }}>
                If your computer crashed or you got a new workstation, select your backed-up `.db` file from Google Drive or local disk to restore everything.
              </p>
              <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                <input
                  type="file"
                  accept=".db"
                  onChange={(e) => setSelectedDbFile(e.target.files?.[0] || null)}
                  className="input"
                  style={{ fontSize: "0.8rem" }}
                  id="upload-db-input"
                />
                <button
                  className="btn btn-primary"
                  onClick={handleUploadRestore}
                  disabled={!selectedDbFile || restoring}
                  id="restore-db-btn"
                >
                  {restoring ? "Restoring..." : "Restore State"}
                </button>
              </div>
            </div>
          </div>

          {/* Backup File Location Info */}
          {backupData && (
            <div className="card" style={{ padding: "1rem 1.5rem", marginBottom: "1.5rem", background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)" }}>
              <p style={{ fontSize: "0.8rem", color: "#818cf8", fontWeight: 600, marginBottom: "0.375rem" }}>
                💡 Google Drive / Cloud Sync Setup:
              </p>
              <p className="text-muted" style={{ fontSize: "0.75rem", lineHeight: 1.5 }}>
                All real-time database backups are written directly to: <code style={{ color: "#a5b4fc" }}>{backupData.backup_directory}</code>.
                <br />
                To sync to Google Drive automatically: Install <strong>Google Drive for Desktop</strong> and select the <code style={{ color: "#a5b4fc" }}>backups</code> directory to auto-sync to your cloud storage!
              </p>
            </div>
          )}

          {/* Snapshot History Table */}
          <div className="card" style={{ overflow: "hidden" }}>
            <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)" }}>
                Snapshot History &amp; Point-in-Time Recovery
              </h2>
              <span className="text-muted" style={{ fontSize: "0.75rem" }}>
                Last 50 automated snapshots retained
              </span>
            </div>

            {loadingBackups ? (
              <div style={{ padding: "3rem", display: "flex", justifyContent: "center" }}><div className="spinner" /></div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Filename</th>
                    <th>Snapshot Type</th>
                    <th>Date &amp; Time</th>
                    <th style={{ textAlign: "right" }}>File Size</th>
                    <th style={{ textAlign: "center" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(backupData?.backups) ? backupData.backups : []).map((b) => (
                    <tr key={b.filename}>
                      <td style={{ fontWeight: 500 }}>
                        <code style={{ fontSize: "0.78rem", color: b.is_latest ? "#22c55e" : "#818cf8" }}>{b.filename}</code>
                      </td>
                      <td>
                        {b.is_latest ? (
                          <span className="badge badge-green">Latest Cloud Sync (erp_latest.db)</span>
                        ) : (
                          <span className="badge badge-indigo">Timestamped Snapshot</span>
                        )}
                      </td>
                      <td className="text-muted">{b.created_at}</td>
                      <td style={{ textAlign: "right" }} className="text-muted">{formatSize(b.size_bytes)}</td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: "0.72rem", padding: "0.25rem 0.6rem" }}
                          onClick={() => handleRestoreNamed(b.filename)}
                          disabled={restoring}
                          id={`restore-${b.filename}`}
                        >
                          <RotateCcw size={12} style={{ marginRight: 3 }} /> Restore This State
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
