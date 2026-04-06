import { create } from "zustand";

interface User {
  id: string;
  tenant_id: string | null;
  role: string;
  full_name: string | null;
  email?: string;
}

const defaultUser: User = {
  id: "default",
  tenant_id: null,
  role: "owner",
  full_name: "Admin",
  email: "admin@vgent.local",
};

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  loadUser: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: defaultUser,
  token: null,
  isLoading: false,
  isAuthenticated: true,

  loadUser: async () => {
    set({ user: defaultUser, isLoading: false, isAuthenticated: true });
  },

  logout: async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    set({ user: null, token: null, isAuthenticated: false });
    window.location.href = "/login";
  },
}));
