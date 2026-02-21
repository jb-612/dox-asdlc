import { create } from 'zustand';
import { updateMermaidTheme } from '../config/mermaid';

// Safe localStorage access for SSR/test environments
const getStoredTheme = (): 'light' | 'dark' => {
  if (typeof window !== 'undefined' && window.localStorage) {
    const stored = localStorage.getItem('asdlc:theme');
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
  }
  return 'dark';
};

// Apply initial theme class on load to prevent flash
const initializeTheme = () => {
  const theme = getStoredTheme();
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }
  return theme;
};

const initialTheme = initializeTheme();

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

  // Theme state - initialized on module load to prevent flash
  theme: initialTheme,
  setTheme: (theme) => {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('asdlc:theme', theme);
    }
    set({ theme });
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', theme === 'dark');
      // Update mermaid theme for diagram rendering
      updateMermaidTheme(theme);
    }
  },
  toggleTheme: () => {
    const newTheme = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(newTheme);
  },
}));
