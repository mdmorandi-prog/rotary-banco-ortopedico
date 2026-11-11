"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { authService, StaffUser } from "@/lib/auth/auth-service";
import { ShieldCheck } from "lucide-react";

interface AuthContextValue {
  user: StaffUser | null;
  loading: boolean;
  refreshSession: () => Promise<StaffUser | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  refreshSession: async () => null,
  logout: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

const PUBLIC_PATHS = ["/login", "/renovar", "/item"];

export function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return true;
  }
  // Public access to official discharge quittance receipts (Art. 320 CCB)
  if (pathname.includes("/receipt")) {
    return true;
  }
  return false;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  const refreshSession = useCallback(async () => {
    const current = await authService.getCurrentSessionUser();
    setUser(current);
    setLoading(false);
    return current;
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession, pathname]);

  useEffect(() => {
    if (loading) return;
    if (!user && !isPublicRoute(pathname)) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [loading, user, pathname, router]);

  const logout = useCallback(async () => {
    await authService.signOut();
    setUser(null);
    router.replace("/login");
  }, [router]);

  // While checking session on protected routes, show subtle Rotary security loader
  if (loading && !isPublicRoute(pathname)) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-slate-600">
        <div className="w-12 h-12 rounded-2xl bg-rotary-blue/10 flex items-center justify-center text-rotary-blue animate-pulse">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Verificando sessão autenticada MFA...
        </p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, refreshSession, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

