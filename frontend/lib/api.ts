const BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("rg_erp_token") || localStorage.getItem("rg_erp_token");
}

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
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
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err: unknown) {
    console.warn(`[API Warning] Request to ${path} failed:`, err);
    // For non-GET mutation requests (POST/PATCH/DELETE), rethrow for user alerts
    if (opts?.method && opts.method.toUpperCase() !== "GET") {
      if (err instanceof Error && err.message === "Failed to fetch") {
        throw new Error("Unable to connect to backend server at http://127.0.0.1:8000. Please check backend process.");
      }
      throw err;
    }
    // For GET page queries, return safe empty array fallback so Next.js never crashes with red error overlay
    return ([] as unknown) as T;
  }
}

export const api = {
  get: <T>(path: string) => req<T>(path),
  post: <T>(path: string, body: unknown) =>
    req<T>(path, { method: "POST", body: JSON.stringify(body) }),
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
