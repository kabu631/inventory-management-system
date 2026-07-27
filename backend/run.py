"""
Entry point for PyInstaller — starts uvicorn serving the FastAPI app.
"""
import os
import sys

# When bundled as .exe, resources are next to the exe
BASE_DIR = os.path.dirname(sys.executable if getattr(sys, "frozen", False) else os.path.abspath(__file__))

# Add the bundled app to path
if getattr(sys, "frozen", False):
    sys.path.insert(0, os.path.join(sys._MEIPASS))  # type: ignore[attr-defined]

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=8000,
        log_level="info",
    )
