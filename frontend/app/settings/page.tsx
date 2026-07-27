"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import {
  ShieldCheck, Download, Upload, RefreshCw,
  HardDrive, FileSpreadsheet, CheckCircle2, AlertCircle, Clock, Cloud
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
  const [data, setData] = useState<BackupInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ text: "", type: "" });
  const [restoring, setRestoring] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const loadData = useCallback(() => {
    setLoading(true);
    api.get<BackupInfo>("/api/backup/list")
      .then(setData)
      .catch(err => setMsg({ text: err.message || "Failed to fetch backup info", type: "error" }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const flashMsg = (text: string, type: "success" | "error") => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: "", type: "" }), 5000);
  };

  const handleTriggerBackup = async () => {
    try {
      await api.post("/api/backup/trigger", {});
      flashMsg("Fresh backup snapshot created successfully!", "success");
      loadData();
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
    if (!selectedFile) return;
    if (!confirm(`Are you sure you want to restore database from uploaded file '${selectedFile.name}'?`)) {
      return;
    }
    setRestoring(true);
    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}/api/backup/restore-file`, {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || "Restore failed");
      flashMsg(result.message, "success");
      setSelectedFile(null);
      setTimeout(() => window.location.reload(), 1500);
    } catch (e: unknown) {
      flashMsg(e instanceof Error ? e.message : "Restore failed", "error");
    } finally {
      setRestoring(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Data Backup & Disaster Recovery</h1>
          <p className="text-muted" style={{ fontSize: "0.875rem" }}>
            Automated Google Drive / Cloud Sync & 1-Click System State Restoration
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleTriggerBackup} id="backup-now-btn">
          <RefreshCw size={16} /> Backup Database Now
        </button>
      </div>

      {msg.text && (
        <div className={`alert ${msg.type === "success" ? "alert-success" : "alert-error"}`}>
          {msg.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {msg.text}
        </div>
      )}

      {/* Auto-backup & Cloud Sync Status Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
        <div className="kpi-card glow-green">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Auto-Backup Schedule</p>
              <p style={{ fontSize: "1.1rem", fontWeight: 700, color: "#22c55e", marginTop: "0.375rem" }}>Every 30 Minutes</p>
              <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "2px" }}>Auto-runs every 30m + on every new entry</p>
            </div>
            <ShieldCheck size={28} color="#22c55e" />
          </div>
        </div>

        <div className="kpi-card glow-indigo">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Google Drive Cloud Sync</p>
              <p style={{ fontSize: "0.95rem", fontWeight: 700, color: "#818cf8", marginTop: "0.375rem", fontFamily: "monospace" }}>G:\My Drive\BatteryERP_Backups</p>
              <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "2px" }}>Synced continuously every 30 mins</p>
            </div>
            <Cloud size={28} color="#818cf8" />
          </div>
        </div>

        <div className="kpi-card glow-amber">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Snapshot History</p>
              <p style={{ fontSize: "1.1rem", fontWeight: 700, color: "#f59e0b", marginTop: "0.375rem" }}>{data?.backups.length || 0} Snapshots</p>
              <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "2px" }}>Point-in-time recovery</p>
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
            Download a full copy of your SQLite database (`erp.db`) to store on a USB drive, email, or Google Drive for offline safekeeping.
          </p>
          <a
            href={`${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}/api/backup/download`}
            download="battery_erp_backup.db"
            className="btn btn-primary"
            style={{ textDecoration: "none" }}
            id="download-backup-btn"
          >
            <Download size={15} /> Download Backup (.db)
          </a>
        </div>

        {/* Card 2: Restore from Uploaded File */}
        <div className="card" style={{ padding: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "1rem" }}>
            <Upload size={20} color="#22c55e" />
            <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)" }}>
              System Recovery (Upload & Restore)
            </h2>
          </div>
          <p className="text-muted" style={{ fontSize: "0.8rem", marginBottom: "1rem", lineHeight: 1.5 }}>
            If your computer crashed or you got a new system, select your backed-up `.db` file from Google Drive or local disk to restore everything.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <input
              type="file"
              accept=".db"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="input"
              style={{ fontSize: "0.8rem" }}
              id="upload-db-input"
            />
            <button
              className="btn btn-primary"
              onClick={handleUploadRestore}
              disabled={!selectedFile || restoring}
              id="restore-db-btn"
            >
              {restoring ? "Restoring..." : "Restore State"}
            </button>
          </div>
        </div>
      </div>

      {/* Backup File Location Info */}
      {data && (
        <div className="card" style={{ padding: "1rem 1.5rem", marginBottom: "1.5rem", background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)" }}>
          <p style={{ fontSize: "0.8rem", color: "#818cf8", fontWeight: 600, marginBottom: "0.375rem" }}>
            💡 How to set up Google Drive / Cloud Sync:
          </p>
          <p className="text-muted" style={{ fontSize: "0.75rem", lineHeight: 1.5 }}>
            All real-time database backups are written directly to: <code style={{ color: "#a5b4fc" }}>{data.backup_directory}</code>.
            <br />
            To sync to Google Drive automatically: Install <strong>Google Drive for Desktop</strong> and select the <code style={{ color: "#a5b4fc" }}>backups</code> directory to auto-sync to your Google Drive account!
          </p>
        </div>
      )}

      {/* Snapshot History Table */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)" }}>
            Snapshot History & Point-in-Time Recovery
          </h2>
          <span className="text-muted" style={{ fontSize: "0.75rem" }}>
            Last 50 automated snapshots retained
          </span>
        </div>

        {loading ? (
          <div style={{ padding: "3rem", display: "flex", justifyContent: "center" }}><div className="spinner" /></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Filename</th>
                <th>Snapshot Type</th>
                <th>Date & Time</th>
                <th style={{ textAlign: "right" }}>File Size</th>
                <th style={{ textAlign: "center" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {data?.backups.map((b) => (
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
  );
}

function RotateCcw({ size, style }: { size: number; style?: React.CSSProperties }) {
  return <RefreshCw size={size} style={{ transform: "rotate(-90deg)", ...style }} />;
}
