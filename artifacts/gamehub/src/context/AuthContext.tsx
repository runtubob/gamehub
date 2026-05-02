import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

export interface AuthUser {
  id: number;
  username: string;
  name: string;
  role: "superadmin" | "admin" | "owner" | "karyawan";
  active: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);
const TOKEN_KEY = "gamehub_token";
const USER_KEY = "gamehub_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);
    if (storedToken && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser) as AuthUser;
        setToken(storedToken);
        setUser(parsedUser);
        setAuthTokenGetter(() => storedToken);
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Login gagal");
    const { token: newToken, user: newUser } = data as { token: string; user: AuthUser };
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    setAuthTokenGetter(() => newToken);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setAuthTokenGetter(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** Super Admin = semua akses termasuk hapus/sensitif. Admin = operasional harian. */
export function isSuperAdmin(role: string | undefined) {
  return role === "superadmin" || role === "admin" || role === "owner";
}

export function isAdminOrAbove(role: string | undefined) {
  return role === "superadmin" || role === "admin" || role === "owner";
}

export function canDelete(role: string | undefined) {
  return role === "superadmin";
}

export function canAccess(role: string | undefined, feature: "finance" | "settings" | "expenses" | "transactions" | "packages" | "users" | "stock") {
  if (!role) return false;
  if (role === "superadmin" || role === "admin" || role === "owner") return true;
  if (role === "karyawan" && (feature === "expenses" || feature === "stock")) return true;
  return false;
}
