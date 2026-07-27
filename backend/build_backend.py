"""
PyInstaller build script — bundles the FastAPI backend into backend.exe
Run from the erp/ root: python backend/build_backend.py
"""
import subprocess
import sys
import os

ROOT = os.path.dirname(os.path.abspath(__file__))

cmd = [
    sys.executable, "-m", "PyInstaller",
    "--onefile",
    "--name", "backend",
    "--distpath", os.path.join(ROOT, "..", "desktop-app", "resources"),
    "--workpath", os.path.join(ROOT, "..", "build", "pyinstaller"),
    "--specpath", os.path.join(ROOT, "..", "build"),
    "--hidden-import", "uvicorn.lifespan.on",
    "--hidden-import", "uvicorn.lifespan.off",
    "--hidden-import", "uvicorn.protocols.http.auto",
    "--hidden-import", "uvicorn.protocols.websockets.auto",
    "--hidden-import", "uvicorn.loops.auto",
    "--hidden-import", "sqlalchemy.dialects.sqlite",
    "--add-data", f"{os.path.join(ROOT,'app')};app",
    os.path.join(ROOT, "run.py"),
]

print("Building backend executable...")
print(" ".join(cmd))
result = subprocess.run(cmd, cwd=ROOT)
sys.exit(result.returncode)
