import { create } from "zustand";
import { api } from "@/lib/api";

interface User {
  id: string;
  tenant_id: string | null;
  role: string;
  full_name: string | null;
  email?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, fullName: string, orgName: string) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: typeof window !== "undefined" ? localStorage.getItem("access_token") : null,
  isLoading: true,

  login: async (email, password) => {
    const res = await api.auth.login({ email, password });
    const { access_token, user } = res.data;
    localStorage.setItem("access_token", access_token);
    set({ token: access_token });
    // Fetch full user profile
    const me = await api.auth.me();
    set({ user: me.data, isLoading: false });
  },

  signup: async (email, password, fullName, orgName) => {
    await api.auth.signup({ email, password, full_name: fullName, organization_name: orgName });
    // Auto-login after signup
    const res = await api.auth.login({ email, password });
    const { access_token } = res.data;
    localStorage.setItem("access_token", access_token);
    set({ token: access_token });
    const me = await api.auth.me();
    set({ user: me.data, isLoading: false });
  },

  logout: () => {
    localStorage.removeItem("access_token");
    set({ user: null, token: null });
    window.location.href = "/login";
  },

  loadUser: async () => {
    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        set({ isLoading: false });
        return;
      }
      const me = await api.auth.me();
      set({ user: me.data, token, isLoading: false });
    } catch {
      localStorage.removeItem("access_token");
      set({ user: null, token: null, isLoading: false });
    }
  },
}));
