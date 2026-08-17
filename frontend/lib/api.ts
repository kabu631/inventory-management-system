const BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("rg_erp_token") || localStorage.getItem("rg_erp_token");
}

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const isMutation = opts?.method && opts.method.toUpperCase() !== "GET";
  try {
    const token = getAuthToken();
    const res = await fetch(`${BASE}${path}`, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...opts?.headers,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (res.status === 401 && path.startsWith("/api/auth/") && typeof window !== "undefined") {
        sessionStorage.removeItem("rg_erp_user");
        sessionStorage.removeItem("rg_erp_token");
        localStorage.removeItem("rg_erp_user");
        localStorage.removeItem("rg_erp_token");
      }
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err: unknown) {
    console.warn(`[API Warning] Request to ${path} failed:`, err);
    if (isMutation) {
      if (err instanceof Error && (err.message === "Failed to fetch" || err.message.includes("NetworkError"))) {
        throw new Error("Unable to connect to backend server at http://127.0.0.1:8000. Please check backend process.");
      }
      throw err;
    }
    return ([] as unknown) as T;
  }
}

export const api = {
  get: <T>(path: string) => req<T>(path),
  post: <T>(path: string, body: unknown) =>
    req<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    req<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    req<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: (path: string) => req<void>(path, { method: "DELETE" }),
};

export function formatNPR(amount: number): string {
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Math.round(amount || 0));
  return `NPR ${formatted}`;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch {
    return dateStr;
  }
}
