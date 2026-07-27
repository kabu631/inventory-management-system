"""
Backup & Disaster Recovery API Router
Handles manual backups, downloads, cloud sync directory info, and database restore uploads.
"""
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
import os
import shutil
import tempfile
from app.services.backup import (
    trigger_auto_backup, list_backups, restore_backup,
    BASE_BACKUP_DIR, ensure_backup_dir
)
from app.database import DB_PATH

router = APIRouter()


@router.get("/list")
def get_backup_list():
    return {
        "backup_directory": BASE_BACKUP_DIR,
        "latest_backup_file": os.path.join(BASE_BACKUP_DIR, "erp_latest.db"),
        "backups": list_backups(),
    }


@router.post("/trigger")
def trigger_manual_backup():
    path = trigger_auto_backup()
    if not path:
        raise HTTPException(status_code=500, detail="Failed to create database backup")
    return {"status": "success", "message": "Backup created successfully", "filepath": path}


@router.get("/download")
def download_backup():
    """Download the active erp.db database snapshot for manual offline safekeeping."""
    latest_file = os.path.join(ensure_backup_dir(), "erp_latest.db")
    if not os.path.exists(latest_file):
        trigger_auto_backup()
    if not os.path.exists(latest_file):
        latest_file = DB_PATH
    return FileResponse(
        path=latest_file,
        filename=f"battery_erp_backup_{os.path.basename(latest_file)}",
        media_type="application/x-sqlite3",
    )


@router.post("/restore-file")
async def restore_from_uploaded_file(file: UploadFile = File(...)):
    """Upload a backup .db file from your computer or Google Drive and restore system state."""
    if not file.filename.endswith(".db"):
        raise HTTPException(status_code=400, detail="Invalid file format. Must be a .db file.")

    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".db") as tmp:
            shutil.copyfileobj(file.file, tmp)
            temp_path = tmp.name

        restore_backup(temp_path)
        return {
            "status": "success",
            "message": f"Database successfully restored from '{file.filename}'!",
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Restore failed: {str(e)}")
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


@router.post("/restore-named")
def restore_from_named_backup(filename: str):
    """Restore database state from a named timestamped backup file in history."""
    backup_dir = ensure_backup_dir()
    target_path = os.path.join(backup_dir, filename)
    if not os.path.exists(target_path):
        raise HTTPException(status_code=404, detail="Specified backup file not found")
    try:
        restore_backup(target_path)
        return {
            "status": "success",
            "message": f"Database successfully restored from '{filename}'!",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Restore failed: {str(e)}")
