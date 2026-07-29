const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const isDev = process.argv.includes("--dev");

let mainWindow = null;
let backendProcess = null;

// ---------------------------------------------------------------------------
// Backend startup
// ---------------------------------------------------------------------------
function startBackend() {
  const backendExe = isDev
    ? null  // In dev, run `uvicorn` separately
    : path.join(process.resourcesPath, "backend.exe");

  if (isDev) {
    console.log("[Electron] Dev mode — backend should be started separately.");
    return;
  }

  console.log("[Electron] Starting backend:", backendExe);
  backendProcess = spawn(backendExe, [], {
    detached: false,
    stdio: "ignore",
    env: {
      ...process.env,
      // Place DB next to the exe in user data dir
      ERP_DB_PATH: path.join(app.getPath("userData"), "erp.db"),
    },
  });

  backendProcess.on("error", (err) => {
    console.error("[Backend] Failed to start:", err);
  });
  backendProcess.on("exit", (code) => {
    console.log("[Backend] Exited with code:", code);
  });
}

function stopBackend() {
  if (backendProcess) {
    try { backendProcess.kill("SIGTERM"); } catch (_) {}
    backendProcess = null;
  }
}

// ---------------------------------------------------------------------------
// Wait for backend to be ready
// ---------------------------------------------------------------------------
function waitForBackend(url, maxRetries = 30, delay = 500) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      fetch(url)
        .then(() => resolve())
        .catch(() => {
          attempts++;
          if (attempts >= maxRetries) return reject(new Error("Backend did not start in time"));
          setTimeout(check, delay);
        });
    };
    check();
  });
}

// ---------------------------------------------------------------------------
// Window creation
// ---------------------------------------------------------------------------
async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    title: "ONIN Infosys ERP — Nepal",
    backgroundColor: "#030712",
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,  // allow loading local files + calling localhost API
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("closed", () => { mainWindow = null; });

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev) {
    // Dev: load Next.js dev server
    mainWindow.loadURL("http://localhost:3000");
    mainWindow.webContents.openDevTools();
  } else {
    // Production: load static export
    const indexPath = path.join(process.resourcesPath, "frontend", "index.html");
    mainWindow.loadFile(indexPath);
  }
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
app.whenReady().then(async () => {
  startBackend();

  if (!isDev) {
    try {
      await waitForBackend("http://127.0.0.1:8000/api/health");
      console.log("[Electron] Backend ready.");
    } catch (err) {
      console.error("[Electron] Backend startup timeout:", err.message);
    }
  }

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  stopBackend();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  stopBackend();
});
