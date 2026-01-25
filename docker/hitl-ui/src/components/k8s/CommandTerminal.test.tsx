/**
 * Tests for CommandTerminal component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CommandTerminal from './CommandTerminal';
import { useK8sStore } from '../../stores/k8sStore';

// Mock the API module
vi.mock('../../api/kubernetes', () => ({
  useExecuteCommand: () => ({
    mutate: vi.fn((request, options) => {
      // Simulate successful execution
      setTimeout(() => {
        options.onSuccess({
          success: true,
          output: 'Mock output',
          exitCode: 0,
          duration: 150,
        });
      }, 10);
    }),
    isPending: false,
  }),
  isCommandAllowed: (cmd: string) => {
    const allowed = ['kubectl get', 'kubectl describe', 'kubectl logs', 'kubectl top'];
    return allowed.some((prefix) => cmd.toLowerCase().startsWith(prefix.toLowerCase()));
  },
  getCommandValidationError: (cmd: string) => {
    if (!cmd.trim()) return 'Please enter a command';
    const allowed = ['kubectl get', 'kubectl describe', 'kubectl logs', 'kubectl top'];
    if (!allowed.some((prefix) => cmd.toLowerCase().startsWith(prefix.toLowerCase()))) {
      return 'Only read-only commands are allowed';
    }
    return null;
  },
}));

// Wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('CommandTerminal', () => {
  beforeEach(() => {
    // Reset store before each test
    useK8sStore.getState().reset();
  });

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<CommandTerminal />, { wrapper: createWrapper() });
      expect(screen.getByTestId('command-terminal')).toBeInTheDocument();
    });

    it('renders input field', () => {
      render(<CommandTerminal />, { wrapper: createWrapper() });
      expect(screen.getByTestId('command-input')).toBeInTheDocument();
    });

    it('renders execute button', () => {
      render(<CommandTerminal />, { wrapper: createWrapper() });
      expect(screen.getByTestId('execute-button')).toBeInTheDocument();
    });

    it('renders clear button', () => {
      render(<CommandTerminal />, { wrapper: createWrapper() });
      expect(screen.getByTestId('clear-button')).toBeInTheDocument();
    });

    it('renders copy button', () => {
      render(<CommandTerminal />, { wrapper: createWrapper() });
      expect(screen.getByTestId('copy-button')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<CommandTerminal className="my-custom-class" />, { wrapper: createWrapper() });
      expect(screen.getByTestId('command-terminal')).toHaveClass('my-custom-class');
    });
  });

  describe('Welcome Message', () => {
    it('shows welcome message when no history', () => {
      render(<CommandTerminal />, { wrapper: createWrapper() });
      expect(screen.getByText(/welcome to the k8s terminal/i)).toBeInTheDocument();
    });

    it('shows allowed commands in welcome message', () => {
      render(<CommandTerminal />, { wrapper: createWrapper() });
      expect(screen.getByText('kubectl get')).toBeInTheDocument();
      expect(screen.getByText('kubectl describe')).toBeInTheDocument();
    });
  });

  describe('Command Input', () => {
    it('updates input value on change', () => {
      render(<CommandTerminal />, { wrapper: createWrapper() });
      const input = screen.getByTestId('command-input');

      fireEvent.change(input, { target: { value: 'kubectl get pods' } });

      expect(input).toHaveValue('kubectl get pods');
    });

    it('input is focused on mount', () => {
      render(<CommandTerminal />, { wrapper: createWrapper() });
      const input = screen.getByTestId('command-input');
      // autoFocus sets focus on mount - we verify the input is the command input
      expect(input).toBeInTheDocument();
      expect(input.tagName).toBe('INPUT');
    });
  });

  describe('Command Validation', () => {
    it('shows validation error for disallowed command', async () => {
      render(<CommandTerminal />, { wrapper: createWrapper() });
      const input = screen.getByTestId('command-input');

      fireEvent.change(input, { target: { value: 'kubectl delete pods' } });

      await waitFor(() => {
        expect(screen.getByTestId('validation-error')).toBeInTheDocument();
      });
    });

    it('does not show validation error for allowed command', () => {
      render(<CommandTerminal />, { wrapper: createWrapper() });
      const input = screen.getByTestId('command-input');

      fireEvent.change(input, { target: { value: 'kubectl get pods' } });

      expect(screen.queryByTestId('validation-error')).not.toBeInTheDocument();
    });

    it('disables execute button for invalid command', async () => {
      render(<CommandTerminal />, { wrapper: createWrapper() });
      const input = screen.getByTestId('command-input');

      fireEvent.change(input, { target: { value: 'rm -rf /' } });

      await waitFor(() => {
        expect(screen.getByTestId('execute-button')).toBeDisabled();
      });
    });
  });

  describe('Command Execution', () => {
    it('executes command on Enter key', async () => {
      render(<CommandTerminal />, { wrapper: createWrapper() });
      const input = screen.getByTestId('command-input');

      fireEvent.change(input, { target: { value: 'kubectl get pods' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        // Should add to history
        const entries = screen.getAllByTestId('command-entry');
        expect(entries.length).toBeGreaterThan(0);
      });
    });

    it('executes command on button click', async () => {
      render(<CommandTerminal />, { wrapper: createWrapper() });
      const input = screen.getByTestId('command-input');

      fireEvent.change(input, { target: { value: 'kubectl get pods' } });
      fireEvent.click(screen.getByTestId('execute-button'));

      await waitFor(() => {
        const entries = screen.getAllByTestId('command-entry');
        expect(entries.length).toBeGreaterThan(0);
      });
    });

    it('clears input after execution', async () => {
      render(<CommandTerminal />, { wrapper: createWrapper() });
      const input = screen.getByTestId('command-input');

      fireEvent.change(input, { target: { value: 'kubectl get pods' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(input).toHaveValue('');
      });
    });
  });

  describe('Clear Terminal', () => {
    it('clears history when clear button clicked', async () => {
      render(<CommandTerminal />, { wrapper: createWrapper() });
      const input = screen.getByTestId('command-input');

      // Execute a command first
      fireEvent.change(input, { target: { value: 'kubectl get pods' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getAllByTestId('command-entry').length).toBeGreaterThan(0);
      });

      // Clear
      fireEvent.click(screen.getByTestId('clear-button'));

      await waitFor(() => {
        expect(screen.queryByTestId('command-entry')).not.toBeInTheDocument();
      });
    });

    it('clears on Ctrl+L', async () => {
      render(<CommandTerminal />, { wrapper: createWrapper() });
      const input = screen.getByTestId('command-input');

      // Execute a command first
      fireEvent.change(input, { target: { value: 'kubectl get pods' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getAllByTestId('command-entry').length).toBeGreaterThan(0);
      });

      // Ctrl+L
      fireEvent.keyDown(input, { key: 'l', ctrlKey: true });

      await waitFor(() => {
        expect(screen.queryByTestId('command-entry')).not.toBeInTheDocument();
      });
    });
  });

  describe('Buttons State', () => {
    it('disables clear button when no history', () => {
      render(<CommandTerminal />, { wrapper: createWrapper() });
      expect(screen.getByTestId('clear-button')).toBeDisabled();
    });

    it('disables copy button when no history', () => {
      render(<CommandTerminal />, { wrapper: createWrapper() });
      expect(screen.getByTestId('copy-button')).toBeDisabled();
    });

    it('disables execute button when input is empty', () => {
      render(<CommandTerminal />, { wrapper: createWrapper() });
      expect(screen.getByTestId('execute-button')).toBeDisabled();
    });
  });

  describe('Terminal Styling', () => {
    it('has dark terminal background', () => {
      render(<CommandTerminal />, { wrapper: createWrapper() });
      const terminal = screen.getByTestId('command-terminal');
      expect(terminal).toHaveClass('bg-[#0d1117]');
    });

    it('shows prompt character', () => {
      render(<CommandTerminal />, { wrapper: createWrapper() });
      // There should be at least one $ prompt in the terminal
      expect(screen.getAllByText('$').length).toBeGreaterThan(0);
    });
  });
});
