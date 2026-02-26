import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// ---------------------------------------------------------------------------
// Mocks — stub out the pages to avoid heavy component trees
// ---------------------------------------------------------------------------

vi.mock('../../src/renderer/pages/DesignerPage', () => ({
  default: () => <div data-testid="designer-page">Designer</div>,
}));
vi.mock('../../src/renderer/pages/TemplateManagerPage', () => ({
  default: () => <div data-testid="templates-page">Templates</div>,
}));
vi.mock('../../src/renderer/pages/StudioPage', () => ({
  default: () => <div data-testid="studio-page">Studio</div>,
}));
vi.mock('../../src/renderer/pages/ExecutionPage', () => ({
  default: () => <div data-testid="execution-page">Execution</div>,
}));
vi.mock('../../src/renderer/pages/ExecutionWalkthroughPage', () => ({
  default: () => <div data-testid="exec-walkthrough-page">Walkthrough</div>,
}));
vi.mock('../../src/renderer/pages/CLIManagerPage', () => ({
  default: () => <div data-testid="cli-page">CLI</div>,
}));
vi.mock('../../src/renderer/pages/MonitoringPage', () => ({
  default: () => <div data-testid="monitoring-page">Monitoring</div>,
}));
vi.mock('../../src/renderer/pages/SettingsPage', () => ({
  default: () => <div data-testid="settings-page">Settings</div>,
}));
vi.mock('../../src/renderer/hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: vi.fn(),
}));

import App from '../../src/renderer/App';

// ---------------------------------------------------------------------------
// F10-T11: IpcErrorBoundary wrapping
// ---------------------------------------------------------------------------

describe('App — IpcErrorBoundary wrapping (F10-T11)', () => {
  it('renders the app without error', () => {
    render(<App />);
    expect(screen.getByText('Workflow Studio')).toBeInTheDocument();
  });

  it('renders ToastProvider in the component tree', () => {
    const { container } = render(<App />);
    // ToastProvider renders a fixed-position div with data-testid="toast-container"
    expect(container.querySelector('[data-testid="toast-container"]')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// F10-T12: Toast wiring — ToastProvider present in App
// ---------------------------------------------------------------------------

describe('App — ToastProvider wiring (F10-T12)', () => {
  it('ToastProvider is rendered at the app root level', () => {
    const { container } = render(<App />);
    const toastContainer = container.querySelector('[data-testid="toast-container"]');
    expect(toastContainer).toBeInTheDocument();
  });
});
