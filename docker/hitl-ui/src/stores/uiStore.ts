import { create } from 'zustand';

interface UIState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Modal states
  isDecisionModalOpen: boolean;
  selectedGateId: string | null;
  openDecisionModal: (gateId: string) => void;
  closeDecisionModal: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

  isDecisionModalOpen: false,
  selectedGateId: null,
  openDecisionModal: (gateId) =>
    set({ isDecisionModalOpen: true, selectedGateId: gateId }),
  closeDecisionModal: () =>
    set({ isDecisionModalOpen: false, selectedGateId: null }),
}));
