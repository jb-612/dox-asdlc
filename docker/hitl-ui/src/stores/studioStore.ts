import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  streaming?: boolean;
}

export interface OutlineSection {
  id: string;
  title: string;
  status: 'complete' | 'in_progress' | 'not_started';
  content?: string;
}

export interface ArtifactCard {
  id: string;
  name: string;
  type: 'prd' | 'test_spec' | 'architecture' | 'task' | 'other';
  status: 'draft' | 'not_started' | 'generating';
  validationStatus: {
    isValid: boolean;
    warnings: string[];
    errors: string[];
  };
  content?: string;
  diffFromPrevious?: string;
}

interface StudioState {
  // Chat state
  messages: ChatMessage[];
  isStreaming: boolean;

  // Working outline state
  workingOutline: OutlineSection[];
  completeness: number; // 0-100

  // Generated artifacts
  artifacts: ArtifactCard[];

  // Model selection
  selectedModel: 'sonnet' | 'opus' | 'haiku';
  rlmEnabled: boolean;

  // Actions
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  clearMessages: () => void;

  updateOutline: (sections: OutlineSection[]) => void;
  updateSection: (sectionId: string, updates: Partial<OutlineSection>) => void;
  calculateCompleteness: () => void;

  addArtifact: (artifact: Omit<ArtifactCard, 'id'>) => void;
  updateArtifact: (artifactId: string, updates: Partial<ArtifactCard>) => void;
  removeArtifact: (artifactId: string) => void;

  setSelectedModel: (model: 'sonnet' | 'opus' | 'haiku') => void;
  setRlmEnabled: (enabled: boolean) => void;

  resetStudio: () => void;
}

const DEFAULT_STATE = {
  messages: [],
  isStreaming: false,
  workingOutline: [],
  completeness: 0,
  artifacts: [],
  selectedModel: 'sonnet' as const,
  rlmEnabled: false,
};

export const useStudioStore = create<StudioState>((set, get) => ({
  ...DEFAULT_STATE,

  addMessage: (message) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          ...message,
          id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(),
        },
      ],
      isStreaming: message.streaming || false,
    })),

  updateMessage: (id, updates) =>
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? { ...msg, ...updates } : msg
      ),
      isStreaming: updates.streaming ?? state.isStreaming,
    })),

  clearMessages: () => set({ messages: [], isStreaming: false }),

  updateOutline: (sections) => {
    set({ workingOutline: sections });
    get().calculateCompleteness();
  },

  updateSection: (sectionId, updates) => {
    set((state) => ({
      workingOutline: state.workingOutline.map((section) =>
        section.id === sectionId ? { ...section, ...updates } : section
      ),
    }));
    get().calculateCompleteness();
  },

  calculateCompleteness: () => {
    const { workingOutline } = get();
    if (workingOutline.length === 0) {
      set({ completeness: 0 });
      return;
    }

    const completeCount = workingOutline.filter(
      (s) => s.status === 'complete'
    ).length;
    const completeness = Math.round((completeCount / workingOutline.length) * 100);
    set({ completeness });
  },

  addArtifact: (artifact) =>
    set((state) => ({
      artifacts: [
        ...state.artifacts,
        {
          ...artifact,
          id: `artifact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        },
      ],
    })),

  updateArtifact: (artifactId, updates) =>
    set((state) => ({
      artifacts: state.artifacts.map((artifact) =>
        artifact.id === artifactId ? { ...artifact, ...updates } : artifact
      ),
    })),

  removeArtifact: (artifactId) =>
    set((state) => ({
      artifacts: state.artifacts.filter((a) => a.id !== artifactId),
    })),

  setSelectedModel: (model) => set({ selectedModel: model }),

  setRlmEnabled: (enabled) => set({ rlmEnabled: enabled }),

  resetStudio: () => set(DEFAULT_STATE),
}));
