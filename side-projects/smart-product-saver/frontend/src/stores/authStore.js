import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useAuthStore = create(
  persist(
    (set) => ({
      token: null,
      apiKey: null,
      user: null,

      setAuth: (token, apiKey, user) => set({ token, apiKey, user }),

      logout: () => set({ token: null, apiKey: null, user: null }),
    }),
    {
      name: "auth-storage",
    }
  )
);
