import { create } from "zustand";

export const useUIStore = create((set) => ({
  sidebarOpen: false,
  viewMode: "grid", // 'grid' | 'list'
  compareProducts: [], // IDs of products to compare

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  setViewMode: (mode) => set({ viewMode: mode }),

  toggleCompare: (productId) =>
    set((state) => {
      const isSelected = state.compareProducts.includes(productId);
      if (isSelected) {
        return {
          compareProducts: state.compareProducts.filter((id) => id !== productId),
        };
      }
      if (state.compareProducts.length >= 4) {
        return state; // Max 4 products
      }
      return { compareProducts: [...state.compareProducts, productId] };
    }),

  clearCompare: () => set({ compareProducts: [] }),
}));
