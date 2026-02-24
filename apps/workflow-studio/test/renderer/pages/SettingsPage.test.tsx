import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// ---------------------------------------------------------------------------
// Mock window.electronAPI before importing the component
// ---------------------------------------------------------------------------

const mockLoad = vi.fn();
const mockSave = vi.fn();
const mockSetApiKey = vi.fn();
const mockDeleteApiKey = vi.fn();
const mockGetKeyStatus = vi.fn();
const mockTestProvider = vi.fn();
const mockGetVersion = vi.fn();
const mockOpenDirectory = vi.fn();

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();

  // Default mocks -- load returns default settings, key status returns no keys
  mockLoad.mockResolvedValue({
    workflowDirectory: '',
    templateDirectory: '',
    autoSaveIntervalSeconds: 30,
    cliDefaultCwd: '',
    redisUrl: 'redis://localhost:6379',
    cursorAgentUrl: 'http://localhost:8090',
    executionMockMode: true,
    workItemDirectory: '',
    providers: {
      anthropic: { id: 'anthropic', defaultModel: 'claude-sonnet-4-6' },
      openai: { id: 'openai', defaultModel: 'gpt-4o' },
      google: { id: 'google', defaultModel: 'gemini-2.0-flash' },
      azure: { id: 'azure' },
    },
    dockerSocketPath: '/var/run/docker.sock',
    defaultRepoMountPath: '',
    workspaceDirectory: '',
    agentTimeoutSeconds: 300,
  });

  mockSave.mockResolvedValue({ success: true });
  mockGetKeyStatus.mockResolvedValue({ hasKey: false, encryptionAvailable: true });
  mockGetVersion.mockResolvedValue({ app: '1.0.0', electron: '30.0.0', node: '20.0.0' });

  Object.defineProperty(window, 'electronAPI', {
    value: {
      settings: {
        load: mockLoad,
        save: mockSave,
        setApiKey: mockSetApiKey,
        deleteApiKey: mockDeleteApiKey,
        getKeyStatus: mockGetKeyStatus,
        testProvider: mockTestProvider,
        getVersion: mockGetVersion,
      },
      dialog: {
        openDirectory: mockOpenDirectory,
      },
      // Stubs for other APIs that components may reference
      onEvent: vi.fn(),
      removeListener: vi.fn(),
    },
    writable: true,
    configurable: true,
  });
});

// ---------------------------------------------------------------------------
// Import AFTER mock setup (module-level beforeEach runs before tests)
// ---------------------------------------------------------------------------

import SettingsPage from '../../../src/renderer/pages/SettingsPage';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SettingsPage', () => {
  // =========================================================================
  // Rendering basics
  // =========================================================================

  describe('rendering', () => {
    it('renders without crashing', async () => {
      render(<SettingsPage />);

      // Should show loading state first, then the actual page
      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });
    });

    it('shows a loading state before settings are loaded', () => {
      // Delay the load response so we can observe the loading state
      mockLoad.mockReturnValue(new Promise(() => {})); // Never resolves

      render(<SettingsPage />);

      expect(screen.getByText('Loading settings...')).toBeInTheDocument();
    });

    it('shows the page header with title and description', async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });
      expect(
        screen.getByText(/Configure AI providers, environment, and application preferences/),
      ).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Tab layout
  // =========================================================================

  describe('tabbed layout', () => {
    it('shows three tabs: AI Providers, Environment, About', async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        // "AI Providers" appears in both the tab button and the content heading
        const aiProviderElements = screen.getAllByText('AI Providers');
        expect(aiProviderElements.length).toBeGreaterThanOrEqual(1);
      });
      expect(screen.getByText('Environment')).toBeInTheDocument();
      expect(screen.getByText('About')).toBeInTheDocument();
    });

    it('defaults to the AI Providers tab', async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        // Both the tab button and the content area heading say "AI Providers"
        const heading = screen.getAllByText('AI Providers');
        // Tab button + section heading = at least 2
        expect(heading.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('switches to Environment tab when clicked', async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Environment')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Environment'));

      // Environment tab content should be visible
      await waitFor(() => {
        expect(screen.getByText(/Docker Socket Path/i)).toBeInTheDocument();
      });
    });

    it('switches to About tab when clicked', async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('About')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('About'));

      // About tab renders version info or at least the "About" heading inside content
      await waitFor(() => {
        expect(screen.getByText('v1.0.0')).toBeInTheDocument();
      });
    });

    it('hides Save and Reset buttons on the About tab', async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('About')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('About'));

      await waitFor(() => {
        expect(screen.queryByText('Save')).not.toBeInTheDocument();
        expect(screen.queryByText('Reset to Defaults')).not.toBeInTheDocument();
      });
    });

    it('shows Save and Reset buttons on the Providers tab', async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Save')).toBeInTheDocument();
      });
      expect(screen.getByText('Reset to Defaults')).toBeInTheDocument();
    });

    it('shows Save and Reset buttons on the Environment tab', async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Environment')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Environment'));

      expect(screen.getByText('Save')).toBeInTheDocument();
      expect(screen.getByText('Reset to Defaults')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Settings loading on mount
  // =========================================================================

  describe('settings loading on mount', () => {
    it('calls electronAPI.settings.load on mount', async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        expect(mockLoad).toHaveBeenCalledTimes(1);
      });
    });

    it('checks key status for all four providers on mount', async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        expect(mockGetKeyStatus).toHaveBeenCalledTimes(4);
      });
      expect(mockGetKeyStatus).toHaveBeenCalledWith('anthropic');
      expect(mockGetKeyStatus).toHaveBeenCalledWith('openai');
      expect(mockGetKeyStatus).toHaveBeenCalledWith('google');
      expect(mockGetKeyStatus).toHaveBeenCalledWith('azure');
    });

    it('falls back to default settings when load throws', async () => {
      mockLoad.mockRejectedValue(new Error('IPC failed'));

      render(<SettingsPage />);

      // Should still render the page (with defaults) instead of crashing
      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });
    });

    it('falls back to default settings when electronAPI is undefined', async () => {
      Object.defineProperty(window, 'electronAPI', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // Provider cards
  // =========================================================================

  describe('provider cards', () => {
    it('renders provider cards for all four providers (anthropic, openai, google, azure)', async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Anthropic')).toBeInTheDocument();
      });
      expect(screen.getByText('OpenAI')).toBeInTheDocument();
      expect(screen.getByText('Google AI')).toBeInTheDocument();
      expect(screen.getByText('Azure OpenAI')).toBeInTheDocument();
    });

    it('shows "No key" badge when provider has no stored key', async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        const badges = screen.getAllByText('No key');
        expect(badges.length).toBe(4); // All four providers should show "No key"
      });
    });

    it('shows "Key stored" badge when provider has a stored key', async () => {
      mockGetKeyStatus.mockImplementation(async (providerId: string) => {
        if (providerId === 'anthropic') return { hasKey: true, encryptionAvailable: true };
        return { hasKey: false, encryptionAvailable: true };
      });

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Key stored')).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // Save
  // =========================================================================

  describe('save functionality', () => {
    it('calls electronAPI.settings.save when Save button is clicked', async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Save')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(mockSave).toHaveBeenCalledTimes(1);
      });
    });

    it('shows "Settings saved." confirmation after successful save', async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Save')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(screen.getByText('Settings saved.')).toBeInTheDocument();
      });
    });

    it('shows error message when save fails', async () => {
      mockSave.mockResolvedValue({ success: false, error: 'Disk full' });

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Save')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(screen.getByText(/Disk full/)).toBeInTheDocument();
      });
    });

    it('shows "Saving..." text while save is in progress', async () => {
      mockSave.mockReturnValue(new Promise(() => {})); // Never resolves

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Save')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Save'));

      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });

    it('disables Save button while saving', async () => {
      mockSave.mockReturnValue(new Promise(() => {})); // Never resolves

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Save')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Save'));

      const savingBtn = screen.getByText('Saving...');
      expect(savingBtn).toBeDisabled();
    });

    it('handles save exception gracefully', async () => {
      mockSave.mockRejectedValue(new Error('Network error'));

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Save')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(screen.getByText(/Network error/)).toBeInTheDocument();
      });
    });

    it('shows error when electronAPI.settings is not available', async () => {
      Object.defineProperty(window, 'electronAPI', {
        value: { settings: undefined, dialog: { openDirectory: vi.fn() } },
        writable: true,
        configurable: true,
      });

      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Save')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(screen.getByText(/not available/i)).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // Reset
  // =========================================================================

  describe('reset functionality', () => {
    it('resets settings to defaults when Reset to Defaults is clicked', async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Reset to Defaults')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Reset to Defaults'));

      // After reset, save status should be idle (no confirmation/error shown)
      expect(screen.queryByText('Settings saved.')).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // Encryption warning banner
  // =========================================================================

  describe('encryption warning banner', () => {
    it('shows warning banner when safeStorage/encryption is unavailable', async () => {
      mockGetKeyStatus.mockResolvedValue({
        hasKey: false,
        encryptionAvailable: false,
      });

      render(<SettingsPage />);

      await waitFor(() => {
        expect(
          screen.getByText(/API key encryption unavailable/i),
        ).toBeInTheDocument();
      });
    });

    it('does not show warning banner when encryption is available', async () => {
      // Default mock already returns encryptionAvailable: true
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });

      expect(
        screen.queryByText(/API key encryption unavailable/i),
      ).not.toBeInTheDocument();
    });

    it('can dismiss the encryption warning banner', async () => {
      mockGetKeyStatus.mockResolvedValue({
        hasKey: false,
        encryptionAvailable: false,
      });

      render(<SettingsPage />);

      await waitFor(() => {
        expect(
          screen.getByText(/API key encryption unavailable/i),
        ).toBeInTheDocument();
      });

      // The dismiss button is an X icon button inside the warning banner.
      // Find it by looking for the button within the warning container.
      const warningBanner = screen.getByText(/API key encryption unavailable/i).closest('div');
      const dismissButton = warningBanner?.querySelector('button');

      if (dismissButton) {
        fireEvent.click(dismissButton);
      }

      await waitFor(() => {
        expect(
          screen.queryByText(/API key encryption unavailable/i),
        ).not.toBeInTheDocument();
      });
    });
  });
});
