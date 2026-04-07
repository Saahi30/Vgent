import { create } from "zustand";
import { setToken } from "@/lib/api";

interface User {
  id: string;
  tenant_id: string | null;
  role: string;
  full_name: string | null;
  email?: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isSuperadmin: boolean;
  loadUser: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  isSuperadmin: false,

  loadUser: async () => {
    set({ isLoading: true });
    try {
      // Try loading from localStorage first (set during login)
      const stored = localStorage.getItem("vgent_user");
      if (stored) {
        const supaUser = JSON.parse(stored);
        // Fetch the full user profile from backend
        const { api } = await import("@/lib/api");
        const res = await api.auth.me();
        if (res.data) {
          const user: User = {
            id: res.data.id,
            tenant_id: res.data.tenant_id,
            role: res.data.role,
            full_name: res.data.full_name,
            email: supaUser.email,
          };
          set({
            user,
            isLoading: false,
            isAuthenticated: true,
            isSuperadmin: user.role === "superadmin",
          });
          return;
        }
      }
      // No stored user — check if we have a valid token via cookie
      const tokenRes = await fetch("/api/auth/token");
      if (tokenRes.ok) {
        const { token } = await tokenRes.json();
        if (token) {
          setToken(token);
          const { api } = await import("@/lib/api");
          const res = await api.auth.me();
          if (res.data) {
            const user: User = {
              id: res.data.id,
              tenant_id: res.data.tenant_id,
              role: res.data.role,
              full_name: res.data.full_name,
            };
            set({
              user,
              isLoading: false,
              isAuthenticated: true,
              isSuperadmin: user.role === "superadmin",
            });
            return;
          }
        }
      }
      set({ user: null, isLoading: false, isAuthenticated: false, isSuperadmin: false });
    } catch {
      set({ user: null, isLoading: false, isAuthenticated: false, isSuperadmin: false });
    }
  },

  logout: async () => {
    setToken(null);
    localStorage.removeItem("vgent_user");
    localStorage.removeItem("vgent_token");
    await fetch("/api/auth/logout", { method: "POST" });
    set({ user: null, isAuthenticated: false, isSuperadmin: false });
    window.location.href = "/login";
  },
}));
