import { create } from 'zustand';

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export interface UIState {
  sidebarCollapsed: boolean;
  activePanel: 'properties' | 'validation' | 'events' | null;
  selectedTab: string;

  // --- Actions ---
  toggleSidebar: () => void;
  setActivePanel: (panel: UIState['activePanel']) => void;
  setSelectedTab: (tab: string) => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  activePanel: null,
  selectedTab: 'designer',

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setActivePanel: (panel) => set({ activePanel: panel }),

  setSelectedTab: (tab) => set({ selectedTab: tab }),
}));
