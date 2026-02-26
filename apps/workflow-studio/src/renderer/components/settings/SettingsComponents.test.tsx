import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import ModelParamsForm from './ModelParamsForm';
import AboutSection from './AboutSection';
import ProviderCard from './ProviderCard';
import EnvironmentSection from './EnvironmentSection';
import { DEFAULT_SETTINGS } from '../../../shared/types/settings';

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
      cli: {
        getDockerStatus: vi.fn(),
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

// ---------------------------------------------------------------------------
// ProviderCard (T07)
// ---------------------------------------------------------------------------

const defaultProviderConfig = {
  id: 'anthropic' as const,
  defaultModel: 'claude-sonnet-4-6',
  modelParams: { temperature: 0.7, maxTokens: 4096 },
};

const defaultProviderCardProps = {
  provider: 'anthropic' as const,
  config: defaultProviderConfig,
  hasKey: false,
  encryptionAvailable: true,
  onChange: vi.fn(),
  onSaveKey: vi.fn(),
  onDeleteKey: vi.fn(),
  onTest: vi.fn(),
};

describe('ProviderCard (T07)', () => {
  it('renders provider name in collapsed header', () => {
    render(<ProviderCard {...defaultProviderCardProps} />);

    expect(screen.getByText('Anthropic')).toBeInTheDocument();
  });

  it('shows "Key stored" badge when hasKey=true', () => {
    render(<ProviderCard {...defaultProviderCardProps} hasKey={true} />);

    expect(screen.getByText('Key stored')).toBeInTheDocument();
  });

  it('shows "No key" badge when hasKey=false', () => {
    render(<ProviderCard {...defaultProviderCardProps} hasKey={false} />);

    expect(screen.getByText('No key')).toBeInTheDocument();
  });

  it('expands on header click to show key input', () => {
    render(<ProviderCard {...defaultProviderCardProps} />);

    // API Key input should not be visible before expansion
    expect(screen.queryByPlaceholderText('Enter API key')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Anthropic'));

    // After expansion, the password input for the API key should appear
    expect(screen.getByPlaceholderText('Enter API key')).toBeInTheDocument();
  });

  it('Save Key button calls onSaveKey with trimmed input', () => {
    const onSaveKey = vi.fn();
    render(<ProviderCard {...defaultProviderCardProps} onSaveKey={onSaveKey} />);

    // Expand the card
    fireEvent.click(screen.getByText('Anthropic'));

    const keyInput = screen.getByPlaceholderText('Enter API key');
    fireEvent.change(keyInput, { target: { value: '  sk-test-key  ' } });
    fireEvent.click(screen.getByText('Save Key'));

    expect(onSaveKey).toHaveBeenCalledWith('sk-test-key');
  });

  it('Save Key button disabled when input is empty', () => {
    render(<ProviderCard {...defaultProviderCardProps} />);

    // Expand the card
    fireEvent.click(screen.getByText('Anthropic'));

    const saveButton = screen.getByText('Save Key');
    expect(saveButton).toBeDisabled();
  });

  it('Clear button visible only when hasKey=true and calls onDeleteKey', () => {
    const onDeleteKey = vi.fn();
    render(<ProviderCard {...defaultProviderCardProps} hasKey={true} onDeleteKey={onDeleteKey} />);

    // Expand the card
    fireEvent.click(screen.getByText('Anthropic'));

    const clearButton = screen.getByText('Clear');
    expect(clearButton).toBeInTheDocument();

    fireEvent.click(clearButton);
    expect(onDeleteKey).toHaveBeenCalledTimes(1);
  });

  it('Clear button not visible when hasKey=false', () => {
    render(<ProviderCard {...defaultProviderCardProps} hasKey={false} />);

    // Expand the card
    fireEvent.click(screen.getByText('Anthropic'));

    expect(screen.queryByText('Clear')).not.toBeInTheDocument();
  });

  it('Test Connection disabled when no key (canTest=false)', () => {
    render(<ProviderCard {...defaultProviderCardProps} hasKey={false} />);

    // Expand the card
    fireEvent.click(screen.getByText('Anthropic'));

    expect(screen.getByText('Test Connection')).toBeDisabled();
  });

  it('Test Connection enabled when key stored (canTest=true)', () => {
    render(<ProviderCard {...defaultProviderCardProps} hasKey={true} />);

    // Expand the card
    fireEvent.click(screen.getByText('Anthropic'));

    expect(screen.getByText('Test Connection')).not.toBeDisabled();
  });

  it('shows test result badge after test completes', () => {
    render(
      <ProviderCard
        {...defaultProviderCardProps}
        hasKey={true}
        testResult={{ ok: true, latencyMs: 123 }}
        testLoading={false}
      />,
    );

    // Expand the card
    fireEvent.click(screen.getByText('Anthropic'));

    expect(screen.getByText('Connected (123ms)')).toBeInTheDocument();
  });

  it('shows error test result badge when test fails', () => {
    render(
      <ProviderCard
        {...defaultProviderCardProps}
        hasKey={true}
        testResult={{ ok: false, error: 'Unauthorized' }}
        testLoading={false}
      />,
    );

    // Expand the card
    fireEvent.click(screen.getByText('Anthropic'));

    expect(screen.getByText('Unauthorized')).toBeInTheDocument();
  });

  it('Azure provider shows Endpoint URL field when expanded', () => {
    const azureConfig = {
      id: 'azure' as const,
      modelParams: { temperature: 0.7, maxTokens: 4096 },
    };

    render(
      <ProviderCard
        {...defaultProviderCardProps}
        provider="azure"
        config={azureConfig}
      />,
    );

    // Expand the card
    fireEvent.click(screen.getByText('Azure OpenAI'));

    expect(screen.getByText('Endpoint URL')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('https://my-resource.openai.azure.com'),
    ).toBeInTheDocument();
  });

  it('Azure provider shows Deployment Name text input instead of model dropdown', () => {
    const azureConfig = {
      id: 'azure' as const,
      modelParams: { temperature: 0.7, maxTokens: 4096 },
    };

    render(
      <ProviderCard
        {...defaultProviderCardProps}
        provider="azure"
        config={azureConfig}
      />,
    );

    // Expand the card
    fireEvent.click(screen.getByText('Azure OpenAI'));

    expect(screen.getByText('Deployment Name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('my-gpt-4o-deployment')).toBeInTheDocument();
    // Should not show a <select> for model
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// EnvironmentSection (T09)
// ---------------------------------------------------------------------------

describe('EnvironmentSection (T09)', () => {
  it('renders all environment field labels', () => {
    render(
      <EnvironmentSection settings={DEFAULT_SETTINGS} onChange={vi.fn()} />,
    );

    expect(screen.getByText('Docker Socket Path')).toBeInTheDocument();
    expect(screen.getByText('Default Repo Mount Path')).toBeInTheDocument();
    expect(screen.getByText('Workspace Directory')).toBeInTheDocument();
    expect(screen.getByText('Agent Timeout')).toBeInTheDocument();
  });

  it('Docker socket path shows default value from settings', () => {
    render(
      <EnvironmentSection settings={DEFAULT_SETTINGS} onChange={vi.fn()} />,
    );

    const input = screen.getByDisplayValue('/var/run/docker.sock');
    expect(input).toBeInTheDocument();
  });

  it('Agent timeout onChange clamps to min 30', () => {
    const onChange = vi.fn();
    render(<EnvironmentSection settings={DEFAULT_SETTINGS} onChange={onChange} />);

    const agentLabel = screen.getByText('Agent Timeout');
    const agentFieldDiv = agentLabel.parentElement!;
    const timeoutInput = agentFieldDiv.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(timeoutInput, { target: { value: '5' } });

    expect(onChange).toHaveBeenCalledWith('agentTimeoutSeconds', 30);
  });

  it('Agent timeout onChange clamps to max 3600', () => {
    const onChange = vi.fn();
    render(<EnvironmentSection settings={DEFAULT_SETTINGS} onChange={onChange} />);

    const agentLabel = screen.getByText('Agent Timeout');
    const agentFieldDiv = agentLabel.parentElement!;
    const timeoutInput = agentFieldDiv.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(timeoutInput, { target: { value: '9999' } });

    expect(onChange).toHaveBeenCalledWith('agentTimeoutSeconds', 3600);
  });

  it('Execution mode checkbox toggles and calls onChange', () => {
    const onChange = vi.fn();
    // DEFAULT_SETTINGS has executionMockMode: false
    render(<EnvironmentSection settings={DEFAULT_SETTINGS} onChange={onChange} />);

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith('executionMockMode', true);
  });

  it('Browse button calls dialog.openDirectory', async () => {
    const mockOpenDirectory = vi.fn().mockResolvedValue('/selected/path');
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
        cli: {
          getDockerStatus: vi.fn(),
        },
        dialog: {
          openDirectory: mockOpenDirectory,
        },
      },
      writable: true,
      configurable: true,
    });

    render(<EnvironmentSection settings={DEFAULT_SETTINGS} onChange={vi.fn()} />);

    const browseButtons = screen.getAllByText('Browse');
    // Click the first Browse button (Docker Socket Path)
    fireEvent.click(browseButtons[0]);

    // Allow the async handler to resolve
    await new Promise((r) => setTimeout(r, 0));

    expect(mockOpenDirectory).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// EnvironmentSection — New Settings Fields (F13-T01)
// ---------------------------------------------------------------------------

describe('EnvironmentSection new fields (F13-T01)', () => {
  it('renders Work Item Directory field with browse button', () => {
    render(<EnvironmentSection settings={DEFAULT_SETTINGS} onChange={vi.fn()} />);

    expect(screen.getByText('Work Item Directory')).toBeInTheDocument();
    // Should have a browse button for it (one more than before)
    const browseButtons = screen.getAllByText('Browse');
    expect(browseButtons.length).toBeGreaterThanOrEqual(4); // docker, repo, workspace, workItem
  });

  it('renders Telemetry Receiver Port as numeric input with default 9292', () => {
    render(<EnvironmentSection settings={DEFAULT_SETTINGS} onChange={vi.fn()} />);

    expect(screen.getByText('Telemetry Receiver Port')).toBeInTheDocument();
    expect(screen.getByDisplayValue('9292')).toBeInTheDocument();
  });

  it('telemetryReceiverPort onChange clamps to min 1024', () => {
    const onChange = vi.fn();
    render(<EnvironmentSection settings={DEFAULT_SETTINGS} onChange={onChange} />);

    const portInput = screen.getByDisplayValue('9292');
    fireEvent.change(portInput, { target: { value: '80' } });

    expect(onChange).toHaveBeenCalledWith('telemetryReceiverPort', 1024);
  });

  it('telemetryReceiverPort onChange clamps to max 65535', () => {
    const onChange = vi.fn();
    render(<EnvironmentSection settings={DEFAULT_SETTINGS} onChange={onChange} />);

    const portInput = screen.getByDisplayValue('9292');
    fireEvent.change(portInput, { target: { value: '80000' } });

    expect(onChange).toHaveBeenCalledWith('telemetryReceiverPort', 65535);
  });

  it('renders Log Level dropdown with 4 options', () => {
    render(<EnvironmentSection settings={DEFAULT_SETTINGS} onChange={vi.fn()} />);

    expect(screen.getByText('Log Level')).toBeInTheDocument();
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();

    // Check all 4 options exist
    const options = screen.getAllByRole('option');
    const logLevelOptions = options.filter((o) =>
      ['debug', 'info', 'warn', 'error'].includes(o.textContent?.toLowerCase() ?? ''),
    );
    expect(logLevelOptions).toHaveLength(4);
  });

  it('changing logLevel calls onChange with correct value', () => {
    const onChange = vi.fn();
    render(<EnvironmentSection settings={DEFAULT_SETTINGS} onChange={onChange} />);

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'debug' } });

    expect(onChange).toHaveBeenCalledWith('logLevel', 'debug');
  });
});

// ---------------------------------------------------------------------------
// EnvironmentSection — Integration (F13-T04)
// ---------------------------------------------------------------------------

describe('EnvironmentSection integration (F13-T04)', () => {
  it('all 3 new fields render, change, and call onChange with correct keys', () => {
    const onChange = vi.fn();
    render(<EnvironmentSection settings={DEFAULT_SETTINGS} onChange={onChange} />);

    // workItemDirectory
    const workItemInput = screen.getByPlaceholderText('.workitems');
    fireEvent.change(workItemInput, { target: { value: '/my/items' } });
    expect(onChange).toHaveBeenCalledWith('workItemDirectory', '/my/items');

    // telemetryReceiverPort
    const portInput = screen.getByDisplayValue('9292');
    fireEvent.change(portInput, { target: { value: '8080' } });
    expect(onChange).toHaveBeenCalledWith('telemetryReceiverPort', 8080);

    // logLevel
    const logSelect = screen.getByRole('combobox');
    fireEvent.change(logSelect, { target: { value: 'error' } });
    expect(onChange).toHaveBeenCalledWith('logLevel', 'error');
  });

  it('re-renders with updated settings values', () => {
    const customSettings = {
      ...DEFAULT_SETTINGS,
      workItemDirectory: '/custom/items',
      telemetryReceiverPort: 5555,
      logLevel: 'warn' as const,
    };

    render(<EnvironmentSection settings={customSettings} onChange={vi.fn()} />);

    expect(screen.getByDisplayValue('/custom/items')).toBeInTheDocument();
    expect(screen.getByDisplayValue('5555')).toBeInTheDocument();
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('warn');
  });

  it('Docker test button returns result via cli.getDockerStatus', async () => {
    const mockGetDockerStatus = vi.fn().mockResolvedValue({ available: true, version: '25.0.0' });
    Object.defineProperty(window, 'electronAPI', {
      value: {
        settings: { getVersion: vi.fn(), load: vi.fn(), save: vi.fn(), setApiKey: vi.fn(), deleteApiKey: vi.fn(), getKeyStatus: vi.fn(), testProvider: vi.fn() },
        cli: { getDockerStatus: mockGetDockerStatus },
        dialog: { openDirectory: vi.fn() },
      },
      writable: true,
      configurable: true,
    });

    render(<EnvironmentSection settings={DEFAULT_SETTINGS} onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Test Docker' }));

    expect(await screen.findByText('Connected (v25.0.0)')).toBeInTheDocument();
    expect(mockGetDockerStatus).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// EnvironmentSection — Validation Edge Cases (F13-T03)
// ---------------------------------------------------------------------------

describe('EnvironmentSection validation (F13-T03)', () => {
  it('telemetryReceiverPort 0 is rejected (clamped to 1024)', () => {
    const onChange = vi.fn();
    render(<EnvironmentSection settings={DEFAULT_SETTINGS} onChange={onChange} />);

    const portInput = screen.getByDisplayValue('9292');
    fireEvent.change(portInput, { target: { value: '0' } });

    expect(onChange).toHaveBeenCalledWith('telemetryReceiverPort', 1024);
  });

  it('logLevel only accepts valid enum values', () => {
    const onChange = vi.fn();
    render(<EnvironmentSection settings={DEFAULT_SETTINGS} onChange={onChange} />);

    const select = screen.getByRole('combobox');

    // Valid value
    fireEvent.change(select, { target: { value: 'warn' } });
    expect(onChange).toHaveBeenCalledWith('logLevel', 'warn');

    // The select only has 4 valid options, so invalid values
    // can't be selected through the UI (HTML select constraint)
    const options = select.querySelectorAll('option');
    const optionValues = Array.from(options).map((o) => o.getAttribute('value'));
    expect(optionValues).toEqual(['debug', 'info', 'warn', 'error']);
  });

  it('telemetryReceiverPort NaN input is ignored', () => {
    const onChange = vi.fn();
    render(<EnvironmentSection settings={DEFAULT_SETTINGS} onChange={onChange} />);

    const portInput = screen.getByDisplayValue('9292');
    fireEvent.change(portInput, { target: { value: 'abc' } });

    expect(onChange).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// EnvironmentSection — Docker Test Button (F13-T02)
// ---------------------------------------------------------------------------

describe('EnvironmentSection Docker Test Button (F13-T02)', () => {
  it('renders "Test Docker" button', () => {
    render(<EnvironmentSection settings={DEFAULT_SETTINGS} onChange={vi.fn()} />);

    const btn = screen.getByRole('button', { name: 'Test Docker' });
    expect(btn).toBeInTheDocument();
  });

  it('shows loading state while testing Docker connectivity', async () => {
    const mockGetDockerStatus = vi.fn().mockReturnValue(new Promise(() => {})); // never resolves
    Object.defineProperty(window, 'electronAPI', {
      value: {
        settings: { getVersion: vi.fn(), load: vi.fn(), save: vi.fn(), setApiKey: vi.fn(), deleteApiKey: vi.fn(), getKeyStatus: vi.fn(), testProvider: vi.fn() },
        cli: { getDockerStatus: mockGetDockerStatus },
        dialog: { openDirectory: vi.fn() },
      },
      writable: true,
      configurable: true,
    });

    render(<EnvironmentSection settings={DEFAULT_SETTINGS} onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Test Docker' }));

    expect(await screen.findByRole('button', { name: 'Testing...' })).toBeInTheDocument();
  });

  it('shows "Connected (vX.X.X)" on successful Docker test', async () => {
    const mockGetDockerStatus = vi.fn().mockResolvedValue({ available: true, version: '24.0.7' });
    Object.defineProperty(window, 'electronAPI', {
      value: {
        settings: { getVersion: vi.fn(), load: vi.fn(), save: vi.fn(), setApiKey: vi.fn(), deleteApiKey: vi.fn(), getKeyStatus: vi.fn(), testProvider: vi.fn() },
        cli: { getDockerStatus: mockGetDockerStatus },
        dialog: { openDirectory: vi.fn() },
      },
      writable: true,
      configurable: true,
    });

    render(<EnvironmentSection settings={DEFAULT_SETTINGS} onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Test Docker' }));

    expect(await screen.findByText('Connected (v24.0.7)')).toBeInTheDocument();
  });

  it('shows error message on failed Docker test', async () => {
    const mockGetDockerStatus = vi.fn().mockResolvedValue({ available: false });
    Object.defineProperty(window, 'electronAPI', {
      value: {
        settings: { getVersion: vi.fn(), load: vi.fn(), save: vi.fn(), setApiKey: vi.fn(), deleteApiKey: vi.fn(), getKeyStatus: vi.fn(), testProvider: vi.fn() },
        cli: { getDockerStatus: mockGetDockerStatus },
        dialog: { openDirectory: vi.fn() },
      },
      writable: true,
      configurable: true,
    });

    render(<EnvironmentSection settings={DEFAULT_SETTINGS} onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Test Docker' }));

    expect(await screen.findByText('Docker unavailable')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// EnvironmentSection — Container Settings (F09-T03)
// ---------------------------------------------------------------------------

describe('EnvironmentSection container settings (F09-T03)', () => {
  it('renders Container Image input with default value "asdlc-agent:1.0.0"', () => {
    render(<EnvironmentSection settings={DEFAULT_SETTINGS} onChange={vi.fn()} />);

    expect(screen.getByText('Container Image')).toBeInTheDocument();
    expect(screen.getByDisplayValue('asdlc-agent:1.0.0')).toBeInTheDocument();
  });

  it('renders Dormancy Timeout input with default value 300 (seconds, converted from 300000ms)', () => {
    render(<EnvironmentSection settings={DEFAULT_SETTINGS} onChange={vi.fn()} />);

    const dormancyLabel = screen.getByText('Dormancy Timeout (seconds)');
    expect(dormancyLabel).toBeInTheDocument();
    const dormancyFieldDiv = dormancyLabel.parentElement!;
    const dormancyInput = dormancyFieldDiv.querySelector('input[type="number"]') as HTMLInputElement;
    expect(dormancyInput.value).toBe('300');
  });

  it('changing container image updates the settings state', () => {
    const onChange = vi.fn();
    render(<EnvironmentSection settings={DEFAULT_SETTINGS} onChange={onChange} />);

    const imageInput = screen.getByDisplayValue('asdlc-agent:1.0.0');
    fireEvent.change(imageInput, { target: { value: 'my-registry/agent:2.0.0' } });

    expect(onChange).toHaveBeenCalledWith('containerImage', 'my-registry/agent:2.0.0');
  });

  it('invalid container image reference shows validation error (empty string)', () => {
    const onChange = vi.fn();
    render(<EnvironmentSection settings={{ ...DEFAULT_SETTINGS, containerImage: '' }} onChange={onChange} />);

    expect(screen.getByText(/invalid container image/i)).toBeInTheDocument();
  });

  it('invalid container image reference shows validation error (string with spaces)', () => {
    const onChange = vi.fn();
    render(<EnvironmentSection settings={{ ...DEFAULT_SETTINGS, containerImage: 'bad image name' }} onChange={onChange} />);

    expect(screen.getByText(/invalid container image/i)).toBeInTheDocument();
  });

  it('valid container image reference does not show validation error', () => {
    render(<EnvironmentSection settings={DEFAULT_SETTINGS} onChange={vi.fn()} />);

    expect(screen.queryByText(/invalid container image/i)).not.toBeInTheDocument();
  });

  it('dormancy timeout onChange converts seconds to ms and calls onChange', () => {
    const onChange = vi.fn();
    render(<EnvironmentSection settings={DEFAULT_SETTINGS} onChange={onChange} />);

    const dormancyLabel = screen.getByText('Dormancy Timeout (seconds)');
    const dormancyFieldDiv = dormancyLabel.parentElement!;
    const dormancyInput = dormancyFieldDiv.querySelector('input[type="number"]') as HTMLInputElement;

    fireEvent.change(dormancyInput, { target: { value: '60' } });

    expect(onChange).toHaveBeenCalledWith('dormancyTimeoutMs', 60_000);
  });

  it('dormancy timeout clamps to min 30 seconds', () => {
    const onChange = vi.fn();
    render(<EnvironmentSection settings={DEFAULT_SETTINGS} onChange={onChange} />);

    const dormancyLabel = screen.getByText('Dormancy Timeout (seconds)');
    const dormancyFieldDiv = dormancyLabel.parentElement!;
    const dormancyInput = dormancyFieldDiv.querySelector('input[type="number"]') as HTMLInputElement;

    fireEvent.change(dormancyInput, { target: { value: '5' } });

    expect(onChange).toHaveBeenCalledWith('dormancyTimeoutMs', 30_000);
  });

  it('dormancy timeout clamps to max 3600 seconds', () => {
    const onChange = vi.fn();
    render(<EnvironmentSection settings={DEFAULT_SETTINGS} onChange={onChange} />);

    const dormancyLabel = screen.getByText('Dormancy Timeout (seconds)');
    const dormancyFieldDiv = dormancyLabel.parentElement!;
    const dormancyInput = dormancyFieldDiv.querySelector('input[type="number"]') as HTMLInputElement;

    fireEvent.change(dormancyInput, { target: { value: '9999' } });

    expect(onChange).toHaveBeenCalledWith('dormancyTimeoutMs', 3_600_000);
  });

  it('dormancy timeout renders custom ms value as seconds', () => {
    render(
      <EnvironmentSection
        settings={{ ...DEFAULT_SETTINGS, dormancyTimeoutMs: 120_000 }}
        onChange={vi.fn()}
      />,
    );

    // 120000ms = 120 seconds
    const dormancyLabel = screen.getByText('Dormancy Timeout (seconds)');
    const dormancyFieldDiv = dormancyLabel.parentElement!;
    const dormancyInput = dormancyFieldDiv.querySelector('input[type="number"]') as HTMLInputElement;

    expect(dormancyInput.value).toBe('120');
  });
});
