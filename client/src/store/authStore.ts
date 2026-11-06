import { create } from "zustand";
import { apiFetch, setAccessToken } from "../lib/api.js";

export type UserRole = "ADMIN" | "MEMBER";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  teamId: string;
  avatarUrl?: string;
  createdAt: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isInitialized: boolean;
  isLoading: boolean;
  setAuth: (user: User, accessToken: string) => void;
  clearAuth: () => void;
  updateUser: (partial: Partial<User>) => void;
  initAuth: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  isInitialized: false,
  isLoading: false,

  setAuth: (user: User, accessToken: string) => {
    setAccessToken(accessToken);
    set({ user, accessToken, isInitialized: true, isLoading: false });
  },

  clearAuth: () => {
    setAccessToken(null);
    set({ user: null, accessToken: null, isInitialized: true, isLoading: false });
  },

  updateUser: (partial: Partial<User>) => {
    const current = get().user;
    if (current) {
      set({ user: { ...current, ...partial } });
    }
  },

  initAuth: async () => {
    if (get().isInitialized) return;
    set({ isLoading: true });

    try {
      // Attempt silent refresh using the httpOnly cookie
      const refreshRes = await apiFetch<{ accessToken: string }>("/api/v1/auth/refresh", {
        method: "POST",
      });

      if (refreshRes?.accessToken) {
        setAccessToken(refreshRes.accessToken);
        // Fetch current user details
        const meRes = await apiFetch<{ user: User }>("/api/v1/auth/me");
        set({
          user: meRes.user,
          accessToken: refreshRes.accessToken,
          isInitialized: true,
          isLoading: false,
        });
        return;
      }
    } catch {
      // Unauthenticated or expired refresh token
    }

    setAccessToken(null);
    set({ user: null, accessToken: null, isInitialized: true, isLoading: false });
  },

  logout: async () => {
    try {
      await apiFetch("/api/v1/auth/logout", { method: "POST" });
    } catch {
      // Ignore network errors on logout
    }
    get().clearAuth();
  },
}));

