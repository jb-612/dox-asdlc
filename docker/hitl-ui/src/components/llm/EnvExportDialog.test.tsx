/**
 * EnvExportDialog Component Tests (P05-F13 T30)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EnvExportDialog from './EnvExportDialog';
import type { AgentLLMConfig } from '../../types/llmConfig';

const mockConfigs: AgentLLMConfig[] = [
  {
    role: 'discovery',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    apiKeyId: 'key-123',
    settings: {
      temperature: 0.7,
      maxTokens: 4096,
      topP: 1.0,
    },
    enabled: true,
  },
  {
    role: 'coding',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    apiKeyId: 'key-456',
    settings: {
      temperature: 0.3,
      maxTokens: 8192,
    },
    enabled: false,
  },
];

// Mock clipboard API
const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
};
Object.assign(navigator, { clipboard: mockClipboard });

// Mock URL.createObjectURL
const mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url');
const mockRevokeObjectURL = vi.fn();
Object.assign(URL, {
  createObjectURL: mockCreateObjectURL,
  revokeObjectURL: mockRevokeObjectURL,
});

describe('EnvExportDialog', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when open is false', () => {
    render(
      <EnvExportDialog open={false} onClose={mockOnClose} configs={mockConfigs} />
    );

    expect(screen.queryByTestId('env-export-dialog')).not.toBeInTheDocument();
  });

  it('renders when open is true', () => {
    render(
      <EnvExportDialog open={true} onClose={mockOnClose} configs={mockConfigs} />
    );

    expect(screen.getByTestId('env-export-dialog')).toBeInTheDocument();
    expect(screen.getByText('Export to .env Format')).toBeInTheDocument();
  });

  it('displays generated .env content', () => {
    render(
      <EnvExportDialog open={true} onClose={mockOnClose} configs={mockConfigs} />
    );

    const preview = screen.getByTestId('env-content-preview');
    expect(preview.textContent).toContain('LLM_DISCOVERY_PROVIDER=anthropic');
    expect(preview.textContent).toContain('LLM_DISCOVERY_MODEL=claude-sonnet-4-20250514');
    expect(preview.textContent).toContain('LLM_CODING_PROVIDER=anthropic');
    expect(preview.textContent).toContain('LLM_CODING_ENABLED=false');
  });

  it('displays security note', () => {
    render(
      <EnvExportDialog open={true} onClose={mockOnClose} configs={mockConfigs} />
    );

    expect(screen.getByText('Security Note')).toBeInTheDocument();
    expect(screen.getByText(/API key IDs are exported, but not the actual keys/)).toBeInTheDocument();
  });

  it('copies to clipboard when button clicked', async () => {
    render(
      <EnvExportDialog open={true} onClose={mockOnClose} configs={mockConfigs} />
    );

    const copyButton = screen.getByTestId('copy-to-clipboard-button');
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(mockClipboard.writeText).toHaveBeenCalled();
    });

    const copiedContent = mockClipboard.writeText.mock.calls[0][0];
    expect(copiedContent).toContain('LLM_DISCOVERY_PROVIDER=anthropic');
  });

  it('shows copied confirmation after copy', async () => {
    render(
      <EnvExportDialog open={true} onClose={mockOnClose} configs={mockConfigs} />
    );

    const copyButton = screen.getByTestId('copy-to-clipboard-button');
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });
  });

  it('triggers download when download button clicked', async () => {
    const mockClick = vi.fn();
    const mockAppendChild = vi.spyOn(document.body, 'appendChild');
    const mockRemoveChild = vi.spyOn(document.body, 'removeChild');

    // Mock createElement to capture the download action
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = originalCreateElement(tagName);
      if (tagName === 'a') {
        element.click = mockClick;
      }
      return element;
    });

    render(
      <EnvExportDialog open={true} onClose={mockOnClose} configs={mockConfigs} />
    );

    const downloadButton = screen.getByTestId('download-file-button');
    fireEvent.click(downloadButton);

    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();

    // Cleanup
    mockAppendChild.mockRestore();
    mockRemoveChild.mockRestore();
  });

  it('calls onClose when close button clicked', async () => {
    render(
      <EnvExportDialog open={true} onClose={mockOnClose} configs={mockConfigs} />
    );

    const closeButton = screen.getByTestId('close-dialog-button');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onClose when escape key pressed', () => {
    render(
      <EnvExportDialog open={true} onClose={mockOnClose} configs={mockConfigs} />
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('includes header comments in .env content', () => {
    render(
      <EnvExportDialog open={true} onClose={mockOnClose} configs={mockConfigs} />
    );

    const preview = screen.getByTestId('env-content-preview');
    expect(preview.textContent).toContain('# LLM Configuration - Generated by aSDLC Admin');
    expect(preview.textContent).toContain('# Generated:');
  });

  it('includes API key note in .env content', () => {
    render(
      <EnvExportDialog open={true} onClose={mockOnClose} configs={mockConfigs} />
    );

    const preview = screen.getByTestId('env-content-preview');
    expect(preview.textContent).toContain('# API Keys (IDs only');
    expect(preview.textContent).toContain('# ANTHROPIC_API_KEY=your-key-here');
  });
});
