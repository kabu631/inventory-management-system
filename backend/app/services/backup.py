"""
Backup Service — Single-File Overwrite SQLite Backup Engine
Always replaces the previous backup file ('erp_latest.db') on every single entry.
Syncs directly to both local directory and Google Drive ('G:\\My Drive\\BatteryERP_Backups\\erp_latest.db').
"""
import os
import shutil
import sqlite3
from datetime import datetime
from typing import List, Dict, Any
from app.database import DB_PATH, engine, init_db

# Local backup directory
LOCAL_BACKUP_DIR = os.getenv(
    "ERP_BACKUP_DIR",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backups"))
)
BASE_BACKUP_DIR = LOCAL_BACKUP_DIR

# Google Drive folder (G:\My Drive)
GDRIVE_ROOT = "G:\\My Drive"
GDRIVE_BACKUP_DIR = os.path.join(GDRIVE_ROOT, "ONIN_ERP_Backups")


def get_active_backup_dirs() -> List[str]:
    """Returns active backup directories (Local + Google Drive)."""
    dirs = [LOCAL_BACKUP_DIR]
    if os.path.exists(GDRIVE_ROOT):
        try:
            os.makedirs(GDRIVE_BACKUP_DIR, exist_ok=True)
            dirs.append(GDRIVE_BACKUP_DIR)
        except Exception as e:
            print(f"[Backup Warning] Could not create Google Drive folder: {e}")
    return dirs


def ensure_backup_dir() -> str:
    os.makedirs(LOCAL_BACKUP_DIR, exist_ok=True)
    if os.path.exists(GDRIVE_ROOT):
        try:
            os.makedirs(GDRIVE_BACKUP_DIR, exist_ok=True)
        except Exception:
            pass
    return LOCAL_BACKUP_DIR


def trigger_auto_backup() -> str:
    """
    Overwrites and replaces the single backup file ('erp_latest.db') on every write action.
    Target destinations: Local backups and Google Drive ('G:\\My Drive\\BatteryERP_Backups\\erp_latest.db').
    """
    primary_file = ""
    try:
        target_dirs = get_active_backup_dirs()

        for bdir in target_dirs:
            os.makedirs(bdir, exist_ok=True)
            backup_file_path = os.path.join(bdir, "erp_latest.db")

            # Perform atomic SQLite backup directly replacing the previous file
            src_conn = sqlite3.connect(DB_PATH)
            dest_conn = sqlite3.connect(backup_file_path)
            with dest_conn:
                src_conn.backup(dest_conn)
            dest_conn.close()
            src_conn.close()

            # Clean up any old timestamped files to ensure ONLY 1 file exists
            _clean_old_snapshots(bdir)

            if not primary_file:
                primary_file = backup_file_path

        return primary_file
    except Exception as e:
        print(f"[Backup Warning] Single-file auto-backup failed: {e}")
        return ""


def _clean_old_snapshots(backup_dir: str):
    """Deletes old timestamped snapshot files so only erp_latest.db remains."""
    try:
        if not os.path.exists(backup_dir):
            return
        for fname in os.listdir(backup_dir):
            if fname.startswith("erp_backup_") and fname.endswith(".db"):
                try:
                    os.remove(os.path.join(backup_dir, fname))
                except Exception:
                    pass
    except Exception:
        pass


def list_backups() -> List[Dict[str, Any]]:
    """List available backup files."""
    backup_dir = ensure_backup_dir()
    results = []
    if not os.path.exists(backup_dir):
        return results

    for fname in sorted(os.listdir(backup_dir)):
        if fname.endswith(".db"):
            fpath = os.path.join(backup_dir, fname)
            stat = os.stat(fpath)
            results.append({
                "filename": fname,
                "filepath": fpath,
                "size_bytes": stat.st_size,
                "created_at": datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S"),
                "is_latest": True,
            })
    return results


def restore_backup(source_filepath: str) -> bool:
    """
    Restores database state from a backup .db file.
    Validates SQLite format, closes active connections, overwrites erp.db, and re-initializes engine.
    """
    if not os.path.exists(source_filepath):
        raise FileNotFoundError("Backup file not found.")

    # Validate header (SQLite format 3)
    with open(source_filepath, "rb") as f:
        header = f.read(16)
        if not header.startswith(b"SQLite format 3"):
            raise ValueError("Invalid backup file: Not a valid SQLite database.")

    # Close active engine connections
    engine.dispose()

    # Overwrite current active database
    shutil.copy2(source_filepath, DB_PATH)

    # Re-initialize tables
    init_db()
    return True
