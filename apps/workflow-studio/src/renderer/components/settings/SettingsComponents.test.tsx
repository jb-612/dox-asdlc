import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import ModelParamsForm from './ModelParamsForm';
import AboutSection from './AboutSection';

// Mock electronAPI on the existing jsdom window
const mockGetVersion = vi.fn();

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  // Set electronAPI on the existing window (don't replace window)
  Object.defineProperty(window, 'electronAPI', {
    value: {
      settings: {
        getVersion: mockGetVersion,
        load: vi.fn(),
        save: vi.fn(),
        setApiKey: vi.fn(),
        deleteApiKey: vi.fn(),
        getKeyStatus: vi.fn(),
        testProvider: vi.fn(),
      },
      dialog: {
        openDirectory: vi.fn(),
      },
    },
    writable: true,
    configurable: true,
  });
});

describe('ModelParamsForm (T08)', () => {
  it('renders temperature slider and numeric input synced', () => {
    const onChange = vi.fn();
    render(
      <ModelParamsForm
        params={{ temperature: 0.7, maxTokens: 4096 }}
        selectedModel="claude-sonnet-4-6"
        onChange={onChange}
      />,
    );

    expect(screen.getByText('Temperature')).toBeInTheDocument();
    expect(screen.getByText('Max Tokens')).toBeInTheDocument();
    expect(screen.getByText(/200K tokens/)).toBeInTheDocument();
  });

  it('clamps temperature to [0, 1]', () => {
    const onChange = vi.fn();
    render(
      <ModelParamsForm
        params={{ temperature: 0.5, maxTokens: 4096 }}
        selectedModel="gpt-4o"
        onChange={onChange}
      />,
    );

    const numericInput = screen.getAllByRole('spinbutton')[0];
    fireEvent.change(numericInput, { target: { value: '1.5' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ temperature: 1.0 }),
    );
  });

  it('clamps maxTokens to [1, 200000]', () => {
    const onChange = vi.fn();
    render(
      <ModelParamsForm
        params={{ temperature: 0.7, maxTokens: 4096 }}
        selectedModel="gpt-4o"
        onChange={onChange}
      />,
    );

    const inputs = screen.getAllByRole('spinbutton');
    const maxTokensInput = inputs[1];
    fireEvent.change(maxTokensInput, { target: { value: '999999' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ maxTokens: 200000 }),
    );
  });

  it('shows context window badge when model has known context', () => {
    render(
      <ModelParamsForm
        params={{ temperature: 0.7, maxTokens: 4096 }}
        selectedModel="gemini-2.0-flash"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/1.0M tokens/)).toBeInTheDocument();
  });

  it('does not show context window for unknown models', () => {
    render(
      <ModelParamsForm
        params={{ temperature: 0.7, maxTokens: 4096 }}
        selectedModel="unknown-model"
        onChange={vi.fn()}
      />,
    );

    expect(screen.queryByText('Context Window')).not.toBeInTheDocument();
  });
});

describe('AboutSection (T10)', () => {
  it('renders version info after IPC call resolves', async () => {
    mockGetVersion.mockResolvedValue({
      app: '0.1.0',
      electron: '30.0.0',
      node: '20.0.0',
    });

    render(<AboutSection />);

    expect(await screen.findByText('v0.1.0')).toBeInTheDocument();
    expect(screen.getByText('30.0.0')).toBeInTheDocument();
    expect(screen.getByText('20.0.0')).toBeInTheDocument();
  });

  it('shows copy button', async () => {
    mockGetVersion.mockResolvedValue({
      app: '0.1.0',
      electron: '30.0.0',
      node: '20.0.0',
    });

    render(<AboutSection />);

    const copyButton = await screen.findByText('Copy version info');
    expect(copyButton).toBeInTheDocument();
  });
});
