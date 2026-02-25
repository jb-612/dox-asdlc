import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// ---------------------------------------------------------------------------
// Mock window.electronAPI before importing the component
// ---------------------------------------------------------------------------

const mockGetDockerStatus = vi.fn();
const mockOpenDirectory = vi.fn();

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();

  mockGetDockerStatus.mockResolvedValue({ available: true, version: '24.0.0' });
  mockOpenDirectory.mockResolvedValue(null);

  Object.defineProperty(window, 'electronAPI', {
    value: {
      cli: {
        getDockerStatus: mockGetDockerStatus,
      },
      dialog: {
        openDirectory: mockOpenDirectory,
      },
      onEvent: vi.fn(),
      removeListener: vi.fn(),
    },
    writable: true,
    configurable: true,
  });
});

// ---------------------------------------------------------------------------
// Import AFTER mock setup
// ---------------------------------------------------------------------------

import SpawnDialog from '../../../../src/renderer/components/cli/SpawnDialog';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderDialog(overrides?: Partial<React.ComponentProps<typeof SpawnDialog>>) {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSpawn: vi.fn(),
    defaultCwd: '/home/user/projects',
    ...overrides,
  };
  return { ...render(<SpawnDialog {...defaultProps} />), props: defaultProps };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SpawnDialog', () => {
  // -------------------------------------------------------------------------
  // Basic rendering
  // -------------------------------------------------------------------------

  describe('basic rendering', () => {
    it('renders the dialog when isOpen is true', () => {
      renderDialog();
      expect(screen.getByText('Spawn CLI Session')).toBeInTheDocument();
    });

    it('returns null when isOpen is false', () => {
      const { container } = renderDialog({ isOpen: false });
      expect(container.innerHTML).toBe('');
    });

    it('renders the Spawn button', () => {
      renderDialog();
      expect(screen.getByText('Spawn')).toBeInTheDocument();
    });

    it('renders the Cancel button', () => {
      renderDialog();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Preset buttons (F06 T08)
  // -------------------------------------------------------------------------

  describe('preset buttons', () => {
    it('renders the "Presets" label', () => {
      renderDialog();
      expect(screen.getByText('Presets')).toBeInTheDocument();
    });

    it('renders 3 preset buttons: Raw Session, Issue Focus, Template Run', () => {
      renderDialog();
      expect(screen.getByText('Raw Session')).toBeInTheDocument();
      expect(screen.getByText('Issue Focus')).toBeInTheDocument();
      expect(screen.getByText('Template Run')).toBeInTheDocument();
    });

    it('all preset buttons are type="button"', () => {
      renderDialog();
      const rawBtn = screen.getByText('Raw Session');
      const issueBtn = screen.getByText('Issue Focus');
      const templateBtn = screen.getByText('Template Run');

      expect(rawBtn.getAttribute('type')).toBe('button');
      expect(issueBtn.getAttribute('type')).toBe('button');
      expect(templateBtn.getAttribute('type')).toBe('button');
    });

    describe('"Raw Session" preset', () => {
      it('sets mode to Local when clicked', () => {
        renderDialog();
        // First switch to docker
        const dockerRadio = screen.getByDisplayValue('docker');
        fireEvent.click(dockerRadio);

        // Then click Raw Session preset
        fireEvent.click(screen.getByText('Raw Session'));

        // Local radio should be checked
        const localRadio = screen.getByDisplayValue('local') as HTMLInputElement;
        expect(localRadio.checked).toBe(true);
      });

      it('sets command to "claude" when clicked', () => {
        renderDialog();
        const commandInput = screen.getByPlaceholderText('claude') as HTMLInputElement;

        // Change command first
        fireEvent.change(commandInput, { target: { value: 'node' } });
        expect(commandInput.value).toBe('node');

        // Click Raw Session
        fireEvent.click(screen.getByText('Raw Session'));
        expect(commandInput.value).toBe('claude');
      });

      it('clears args text when clicked', () => {
        renderDialog();
        const argsTextarea = screen.getByPlaceholderText(/--model/i) as HTMLTextAreaElement;

        fireEvent.change(argsTextarea, { target: { value: '--verbose' } });
        expect(argsTextarea.value).toBe('--verbose');

        fireEvent.click(screen.getByText('Raw Session'));
        expect(argsTextarea.value).toBe('');
      });
    });

    describe('"Issue Focus" preset', () => {
      it('sets mode to Docker when clicked', () => {
        renderDialog();
        fireEvent.click(screen.getByText('Issue Focus'));

        const dockerRadio = screen.getByDisplayValue('docker') as HTMLInputElement;
        expect(dockerRadio.checked).toBe(true);
      });

      it('opens the Session Context section when clicked', () => {
        renderDialog();
        // Context should be collapsed initially
        expect(screen.queryByPlaceholderText('owner/repo#123')).not.toBeInTheDocument();

        fireEvent.click(screen.getByText('Issue Focus'));

        // Context section should now be visible with the GitHub Issue field
        expect(screen.getByPlaceholderText('owner/repo#123')).toBeInTheDocument();
      });
    });

    describe('"Template Run" preset', () => {
      it('sets mode to Docker when clicked', () => {
        renderDialog();
        fireEvent.click(screen.getByText('Template Run'));

        const dockerRadio = screen.getByDisplayValue('docker') as HTMLInputElement;
        expect(dockerRadio.checked).toBe(true);
      });

      it('opens the Session Context section when clicked', () => {
        renderDialog();
        expect(screen.queryByPlaceholderText('Template ID or name')).not.toBeInTheDocument();

        fireEvent.click(screen.getByText('Template Run'));

        // Template field should be visible
        expect(screen.getByPlaceholderText('Template ID or name')).toBeInTheDocument();
      });
    });
  });

  // -------------------------------------------------------------------------
  // Mode toggle
  // -------------------------------------------------------------------------

  describe('mode toggle', () => {
    it('defaults to local mode', () => {
      renderDialog();
      const localRadio = screen.getByDisplayValue('local') as HTMLInputElement;
      expect(localRadio.checked).toBe(true);
    });

    it('allows switching to docker mode', () => {
      renderDialog();
      const dockerRadio = screen.getByDisplayValue('docker');
      fireEvent.click(dockerRadio);

      expect((screen.getByDisplayValue('docker') as HTMLInputElement).checked).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Spawn action
  // -------------------------------------------------------------------------

  describe('spawn action', () => {
    it('calls onSpawn with config when Spawn is clicked', () => {
      const { props } = renderDialog();
      fireEvent.click(screen.getByText('Spawn'));

      expect(props.onSpawn).toHaveBeenCalledTimes(1);
      const config = (props.onSpawn as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(config.command).toBe('claude');
      expect(config.mode).toBe('local');
    });

    it('calls onClose after spawning', () => {
      const { props } = renderDialog();
      fireEvent.click(screen.getByText('Spawn'));

      expect(props.onClose).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Cancel / backdrop
  // -------------------------------------------------------------------------

  describe('cancel and close', () => {
    it('calls onClose when Cancel is clicked', () => {
      const { props } = renderDialog();
      fireEvent.click(screen.getByText('Cancel'));
      expect(props.onClose).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Prefill config
  // -------------------------------------------------------------------------

  describe('prefill config', () => {
    it('applies prefillConfig values to the form', () => {
      renderDialog({
        prefillConfig: {
          mode: 'docker',
          command: 'node',
          args: ['--version'],
          cwd: '/tmp',
        },
      });

      const dockerRadio = screen.getByDisplayValue('docker') as HTMLInputElement;
      expect(dockerRadio.checked).toBe(true);

      const commandInput = screen.getByPlaceholderText('claude') as HTMLInputElement;
      expect(commandInput.value).toBe('node');
    });
  });
});
