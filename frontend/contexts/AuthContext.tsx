"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export interface UserProfile {
  id: number;
  username: string;
  role: "ADMIN" | "STAFF" | "ACCOUNTANT";
  full_name: string;
  staff_id: string;
}

interface AuthContextValue {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  login: (user: UserProfile, token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  loading: true,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    try {
      // Clear any legacy persistent localStorage auth items
      localStorage.removeItem("rg_erp_user");
      localStorage.removeItem("rg_erp_token");

      // Read current tab/browser session storage
      const storedUser = sessionStorage.getItem("rg_erp_user");
      const storedToken = sessionStorage.getItem("rg_erp_token");

      if (storedUser && storedToken) {
        setUser(JSON.parse(storedUser));
        setToken(storedToken);
      }
    } catch {
      sessionStorage.removeItem("rg_erp_user");
      sessionStorage.removeItem("rg_erp_token");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading) {
      const normalizedPath = pathname?.replace(/\/$/, "") || "/";
      if (!user && normalizedPath !== "/login") {
        router.push("/login");
      }
    }
  }, [user, loading, pathname, router]);

  const login = (userData: UserProfile, authToken: string) => {
    setUser(userData);
    setToken(authToken);
    sessionStorage.setItem("rg_erp_user", JSON.stringify(userData));
    sessionStorage.setItem("rg_erp_token", authToken);
    router.push("/");
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    sessionStorage.removeItem("rg_erp_user");
    sessionStorage.removeItem("rg_erp_token");
    localStorage.removeItem("rg_erp_user");
    localStorage.removeItem("rg_erp_token");
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
