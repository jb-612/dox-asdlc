import { create } from 'zustand';

type Environment = 'dev' | 'staging' | 'prod';

interface SessionState {
  // Session context
  environment: Environment;
  repo: string;
  epicId: string | null;
  currentGitSha: string;
  currentBranch: string;

  // Actions
  setEnvironment: (env: Environment) => void;
  setRepo: (repo: string) => void;
  setEpic: (epicId: string | null) => void;
  setGitState: (sha: string, branch: string) => void;
  clearSession: () => void;
}

const DEFAULT_STATE = {
  environment: 'dev' as Environment,
  repo: '',
  epicId: null,
  currentGitSha: '',
  currentBranch: 'main',
};

export const useSessionStore = create<SessionState>((set) => ({
  ...DEFAULT_STATE,

  setEnvironment: (env) => set({ environment: env }),

  setRepo: (repo) => set({ repo }),

  setEpic: (epicId) => set({ epicId }),

  setGitState: (sha, branch) =>
    set({ currentGitSha: sha, currentBranch: branch }),

  clearSession: () => set(DEFAULT_STATE),
}));
