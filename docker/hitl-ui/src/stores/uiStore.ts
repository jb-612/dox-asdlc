import { create } from 'zustand';

// Safe localStorage access for SSR/test environments
const getStoredTheme = (): 'light' | 'dark' => {
  if (typeof window !== 'undefined' && window.localStorage) {
    const stored = localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
  }
  return 'dark';
};

interface UIState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Modal states
  isDecisionModalOpen: boolean;
  selectedGateId: string | null;
  openDecisionModal: (gateId: string) => void;
  closeDecisionModal: () => void;

  // Theme state
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
}

export const useUIStore = create<UIState>((set, get) => ({
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

  // Theme state - default to dark, check localStorage
  theme: getStoredTheme(),
  setTheme: (theme) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('theme', theme);
    }
    set({ theme });
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }
  },
  toggleTheme: () => {
    const newTheme = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(newTheme);
  },
}));
