/**
 * Tests for RunInputsTab component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RunInputsTab, { type RunInputs } from './RunInputsTab';

describe('RunInputsTab', () => {
  const defaultInputs: RunInputs = {
    artifacts: [
      { id: 'art-1', name: 'requirements.md', type: 'document', size: 2048 },
      { id: 'art-2', name: 'context.json', type: 'data', size: 1024 },
    ],
    contextPack: {
      id: 'ctx-1',
      name: 'Discovery Context',
      tokenCount: 15000,
      files: ['src/main.ts', 'src/utils.ts', 'README.md'],
    },
    configuration: {
      model: 'claude-3-opus',
      maxTokens: 4096,
      temperature: 0.7,
      systemPrompt: 'You are a helpful assistant...',
    },
    environment: {
      name: 'Production',
      branch: 'main',
      sha: 'abc123def456',
    },
  };

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<RunInputsTab inputs={defaultInputs} />);
      expect(screen.getByTestId('run-inputs-tab')).toBeInTheDocument();
    });

    it('renders section title', () => {
      render(<RunInputsTab inputs={defaultInputs} />);
      expect(screen.getByText(/inputs/i)).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<RunInputsTab inputs={defaultInputs} className="my-custom-class" />);
      expect(screen.getByTestId('run-inputs-tab')).toHaveClass('my-custom-class');
    });
  });

  describe('Input Artifacts Section', () => {
    it('shows artifacts section', () => {
      render(<RunInputsTab inputs={defaultInputs} />);
      expect(screen.getByTestId('artifacts-section')).toBeInTheDocument();
    });

    it('lists all artifacts', () => {
      render(<RunInputsTab inputs={defaultInputs} />);
      expect(screen.getByText('requirements.md')).toBeInTheDocument();
      expect(screen.getByText('context.json')).toBeInTheDocument();
    });

    it('shows artifact type', () => {
      render(<RunInputsTab inputs={defaultInputs} />);
      const artifact = screen.getByTestId('artifact-art-1');
      expect(artifact).toHaveTextContent(/document/i);
    });

    it('shows artifact size', () => {
      render(<RunInputsTab inputs={defaultInputs} />);
      const artifact = screen.getByTestId('artifact-art-1');
      expect(artifact).toHaveTextContent('2 KB');
    });

    it('calls onArtifactClick when artifact is clicked', () => {
      const onClick = vi.fn();
      render(<RunInputsTab inputs={defaultInputs} onArtifactClick={onClick} />);

      fireEvent.click(screen.getByTestId('artifact-art-1'));

      expect(onClick).toHaveBeenCalledWith('art-1');
    });
  });

  describe('Context Pack Section', () => {
    it('shows context pack section', () => {
      render(<RunInputsTab inputs={defaultInputs} />);
      expect(screen.getByTestId('context-pack-section')).toBeInTheDocument();
    });

    it('displays context pack name', () => {
      render(<RunInputsTab inputs={defaultInputs} />);
      expect(screen.getByText('Discovery Context')).toBeInTheDocument();
    });

    it('displays token count', () => {
      render(<RunInputsTab inputs={defaultInputs} />);
      expect(screen.getByTestId('token-count')).toHaveTextContent('15,000');
    });

    it('shows token count with warning if high', () => {
      const highTokenInputs = {
        ...defaultInputs,
        contextPack: { ...defaultInputs.contextPack, tokenCount: 150000 },
      };
      render(<RunInputsTab inputs={highTokenInputs} tokenWarningThreshold={100000} />);

      expect(screen.getByTestId('token-warning')).toBeInTheDocument();
    });

    it('lists included files', () => {
      render(<RunInputsTab inputs={defaultInputs} />);
      expect(screen.getByText('src/main.ts')).toBeInTheDocument();
      expect(screen.getByText('src/utils.ts')).toBeInTheDocument();
      expect(screen.getByText('README.md')).toBeInTheDocument();
    });

    it('shows file count badge', () => {
      render(<RunInputsTab inputs={defaultInputs} />);
      expect(screen.getByTestId('file-count')).toHaveTextContent('3 files');
    });
  });

  describe('Configuration Section', () => {
    it('shows configuration section', () => {
      render(<RunInputsTab inputs={defaultInputs} />);
      expect(screen.getByTestId('config-section')).toBeInTheDocument();
    });

    it('displays model name', () => {
      render(<RunInputsTab inputs={defaultInputs} />);
      expect(screen.getByText('claude-3-opus')).toBeInTheDocument();
    });

    it('displays max tokens', () => {
      render(<RunInputsTab inputs={defaultInputs} />);
      expect(screen.getByTestId('config-maxTokens')).toHaveTextContent('4096');
    });

    it('displays temperature', () => {
      render(<RunInputsTab inputs={defaultInputs} />);
      expect(screen.getByTestId('config-temperature')).toHaveTextContent('0.7');
    });

    it('shows system prompt preview', () => {
      render(<RunInputsTab inputs={defaultInputs} />);
      expect(screen.getByText(/helpful assistant/)).toBeInTheDocument();
    });

    it('truncates long system prompts', () => {
      const longPromptInputs = {
        ...defaultInputs,
        configuration: {
          ...defaultInputs.configuration,
          systemPrompt: 'A'.repeat(500),
        },
      };
      render(<RunInputsTab inputs={longPromptInputs} />);

      const promptPreview = screen.getByTestId('system-prompt-preview');
      expect(promptPreview.textContent!.length).toBeLessThan(500);
    });

    it('shows full prompt on expand', () => {
      const longPromptInputs = {
        ...defaultInputs,
        configuration: {
          ...defaultInputs.configuration,
          systemPrompt: 'A'.repeat(500),
        },
      };
      render(<RunInputsTab inputs={longPromptInputs} />);

      fireEvent.click(screen.getByTestId('expand-prompt'));

      const expandedPrompt = screen.getByTestId('system-prompt-full');
      expect(expandedPrompt.textContent).toHaveLength(500);
    });
  });

  describe('Environment Section', () => {
    it('shows environment section', () => {
      render(<RunInputsTab inputs={defaultInputs} />);
      expect(screen.getByTestId('environment-section')).toBeInTheDocument();
    });

    it('displays environment name', () => {
      render(<RunInputsTab inputs={defaultInputs} />);
      expect(screen.getByText('Production')).toBeInTheDocument();
    });

    it('displays branch', () => {
      render(<RunInputsTab inputs={defaultInputs} />);
      expect(screen.getByText('main')).toBeInTheDocument();
    });

    it('displays SHA', () => {
      render(<RunInputsTab inputs={defaultInputs} />);
      expect(screen.getByText('abc123d')).toBeInTheDocument();
    });
  });

  describe('Empty States', () => {
    it('shows empty message when no artifacts', () => {
      const noArtifacts = { ...defaultInputs, artifacts: [] };
      render(<RunInputsTab inputs={noArtifacts} />);

      expect(screen.getByText(/no input artifacts/i)).toBeInTheDocument();
    });

    it('shows empty message when no context pack', () => {
      const noContext = { ...defaultInputs, contextPack: undefined };
      render(<RunInputsTab inputs={noContext} />);

      expect(screen.getByText(/no context pack/i)).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading state', () => {
      render(<RunInputsTab inputs={defaultInputs} isLoading />);
      expect(screen.getByTestId('inputs-loading')).toBeInTheDocument();
    });

    it('shows skeleton sections when loading', () => {
      render(<RunInputsTab inputs={defaultInputs} isLoading />);
      expect(screen.getAllByTestId('section-skeleton').length).toBeGreaterThan(0);
    });
  });

  describe('Collapsible Sections', () => {
    it('sections can be collapsed', () => {
      render(<RunInputsTab inputs={defaultInputs} />);

      fireEvent.click(screen.getByTestId('collapse-artifacts'));

      expect(screen.queryByText('requirements.md')).not.toBeInTheDocument();
    });

    it('sections can be expanded', () => {
      render(<RunInputsTab inputs={defaultInputs} />);

      fireEvent.click(screen.getByTestId('collapse-artifacts'));
      fireEvent.click(screen.getByTestId('collapse-artifacts'));

      expect(screen.getByText('requirements.md')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper section headings', () => {
      render(<RunInputsTab inputs={defaultInputs} />);
      expect(screen.getAllByRole('heading').length).toBeGreaterThan(0);
    });

    it('collapse buttons have aria-expanded', () => {
      render(<RunInputsTab inputs={defaultInputs} />);
      const collapseBtn = screen.getByTestId('collapse-artifacts');
      expect(collapseBtn).toHaveAttribute('aria-expanded');
    });

    it('artifacts are keyboard accessible', () => {
      render(<RunInputsTab inputs={defaultInputs} onArtifactClick={vi.fn()} />);
      const artifact = screen.getByTestId('artifact-art-1');
      expect(artifact).toHaveAttribute('tabIndex', '0');
    });
  });
});
