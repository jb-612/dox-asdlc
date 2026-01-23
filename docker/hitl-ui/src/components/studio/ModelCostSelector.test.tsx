/**
 * Tests for ModelCostSelector component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ModelCostSelector, { type ModelOption } from './ModelCostSelector';

describe('ModelCostSelector', () => {
  const defaultModels: ModelOption[] = [
    {
      id: 'claude-3-opus',
      name: 'Claude 3 Opus',
      description: 'Most capable model for complex tasks',
      costPerToken: 0.000075,
      maxTokens: 200000,
    },
    {
      id: 'claude-3-sonnet',
      name: 'Claude 3 Sonnet',
      description: 'Balanced performance and cost',
      costPerToken: 0.000015,
      maxTokens: 200000,
    },
    {
      id: 'claude-3-haiku',
      name: 'Claude 3 Haiku',
      description: 'Fast and efficient for simple tasks',
      costPerToken: 0.000005,
      maxTokens: 200000,
    },
  ];

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<ModelCostSelector models={defaultModels} selectedModel="claude-3-opus" />);
      expect(screen.getByTestId('model-cost-selector')).toBeInTheDocument();
    });

    it('renders selector label', () => {
      render(<ModelCostSelector models={defaultModels} selectedModel="claude-3-opus" />);
      expect(screen.getByText(/model/i)).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(
        <ModelCostSelector
          models={defaultModels}
          selectedModel="claude-3-opus"
          className="my-custom-class"
        />
      );
      expect(screen.getByTestId('model-cost-selector')).toHaveClass('my-custom-class');
    });
  });

  describe('Model Selection', () => {
    it('displays selected model name', () => {
      render(<ModelCostSelector models={defaultModels} selectedModel="claude-3-opus" />);
      expect(screen.getByText('Claude 3 Opus')).toBeInTheDocument();
    });

    it('opens dropdown on click', () => {
      render(<ModelCostSelector models={defaultModels} selectedModel="claude-3-opus" />);

      fireEvent.click(screen.getByTestId('model-dropdown-trigger'));

      expect(screen.getByTestId('model-dropdown')).toBeInTheDocument();
    });

    it('shows all model options in dropdown', () => {
      render(<ModelCostSelector models={defaultModels} selectedModel="claude-3-opus" />);
      fireEvent.click(screen.getByTestId('model-dropdown-trigger'));

      expect(screen.getByTestId('model-option-claude-3-opus')).toBeInTheDocument();
      expect(screen.getByTestId('model-option-claude-3-sonnet')).toBeInTheDocument();
      expect(screen.getByTestId('model-option-claude-3-haiku')).toBeInTheDocument();
    });

    it('shows model descriptions in dropdown', () => {
      render(<ModelCostSelector models={defaultModels} selectedModel="claude-3-opus" />);
      fireEvent.click(screen.getByTestId('model-dropdown-trigger'));

      expect(screen.getByText(/balanced performance/i)).toBeInTheDocument();
    });

    it('calls onModelChange when option selected', () => {
      const onChange = vi.fn();
      render(
        <ModelCostSelector
          models={defaultModels}
          selectedModel="claude-3-opus"
          onModelChange={onChange}
        />
      );

      fireEvent.click(screen.getByTestId('model-dropdown-trigger'));
      fireEvent.click(screen.getByTestId('model-option-claude-3-sonnet'));

      expect(onChange).toHaveBeenCalledWith('claude-3-sonnet');
    });

    it('closes dropdown after selection', () => {
      const onChange = vi.fn();
      render(
        <ModelCostSelector
          models={defaultModels}
          selectedModel="claude-3-opus"
          onModelChange={onChange}
        />
      );

      fireEvent.click(screen.getByTestId('model-dropdown-trigger'));
      fireEvent.click(screen.getByTestId('model-option-claude-3-sonnet'));

      expect(screen.queryByTestId('model-dropdown')).not.toBeInTheDocument();
    });
  });

  describe('Cost Estimate', () => {
    it('displays cost estimate', () => {
      render(
        <ModelCostSelector
          models={defaultModels}
          selectedModel="claude-3-opus"
          estimatedTokens={10000}
        />
      );
      expect(screen.getByTestId('cost-estimate')).toBeInTheDocument();
    });

    it('calculates cost correctly', () => {
      // 10000 tokens * 0.000075 = $0.75
      render(
        <ModelCostSelector
          models={defaultModels}
          selectedModel="claude-3-opus"
          estimatedTokens={10000}
        />
      );
      expect(screen.getByTestId('cost-estimate')).toHaveTextContent('$0.75');
    });

    it('updates cost when model changes', () => {
      const { rerender } = render(
        <ModelCostSelector
          models={defaultModels}
          selectedModel="claude-3-opus"
          estimatedTokens={10000}
        />
      );
      expect(screen.getByTestId('cost-estimate')).toHaveTextContent('$0.75');

      rerender(
        <ModelCostSelector
          models={defaultModels}
          selectedModel="claude-3-haiku"
          estimatedTokens={10000}
        />
      );
      // 10000 * 0.000005 = $0.05
      expect(screen.getByTestId('cost-estimate')).toHaveTextContent('$0.05');
    });

    it('shows cost per token info', () => {
      render(
        <ModelCostSelector
          models={defaultModels}
          selectedModel="claude-3-opus"
          showCostPerToken
        />
      );
      expect(screen.getByTestId('cost-per-token')).toBeInTheDocument();
    });
  });

  describe('RLM Mode Toggle', () => {
    it('shows RLM toggle', () => {
      render(
        <ModelCostSelector
          models={defaultModels}
          selectedModel="claude-3-opus"
          showRLMToggle
        />
      );
      expect(screen.getByTestId('rlm-toggle')).toBeInTheDocument();
    });

    it('hides RLM toggle by default', () => {
      render(<ModelCostSelector models={defaultModels} selectedModel="claude-3-opus" />);
      expect(screen.queryByTestId('rlm-toggle')).not.toBeInTheDocument();
    });

    it('shows RLM mode label', () => {
      render(
        <ModelCostSelector
          models={defaultModels}
          selectedModel="claude-3-opus"
          showRLMToggle
        />
      );
      expect(screen.getByText(/rlm mode/i)).toBeInTheDocument();
    });

    it('toggle is off by default', () => {
      render(
        <ModelCostSelector
          models={defaultModels}
          selectedModel="claude-3-opus"
          showRLMToggle
          rlmEnabled={false}
        />
      );
      const toggle = screen.getByTestId('rlm-toggle');
      expect(toggle).toHaveAttribute('aria-checked', 'false');
    });

    it('toggle can be on', () => {
      render(
        <ModelCostSelector
          models={defaultModels}
          selectedModel="claude-3-opus"
          showRLMToggle
          rlmEnabled={true}
        />
      );
      const toggle = screen.getByTestId('rlm-toggle');
      expect(toggle).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('RLM Confirmation Modal', () => {
    it('shows confirmation modal when enabling RLM', () => {
      const onRLMChange = vi.fn();
      render(
        <ModelCostSelector
          models={defaultModels}
          selectedModel="claude-3-opus"
          showRLMToggle
          rlmEnabled={false}
          onRLMChange={onRLMChange}
        />
      );

      fireEvent.click(screen.getByTestId('rlm-toggle'));

      expect(screen.getByTestId('rlm-confirmation-modal')).toBeInTheDocument();
    });

    it('shows warning message in modal', () => {
      render(
        <ModelCostSelector
          models={defaultModels}
          selectedModel="claude-3-opus"
          showRLMToggle
          rlmEnabled={false}
        />
      );

      fireEvent.click(screen.getByTestId('rlm-toggle'));

      // Check for multiple cost-related elements
      const costTexts = screen.getAllByText(/higher cost/i);
      expect(costTexts.length).toBeGreaterThan(0);
    });

    it('calls onRLMChange when confirmed', () => {
      const onRLMChange = vi.fn();
      render(
        <ModelCostSelector
          models={defaultModels}
          selectedModel="claude-3-opus"
          showRLMToggle
          rlmEnabled={false}
          onRLMChange={onRLMChange}
        />
      );

      fireEvent.click(screen.getByTestId('rlm-toggle'));
      fireEvent.click(screen.getByRole('button', { name: /enable rlm/i }));

      expect(onRLMChange).toHaveBeenCalledWith(true);
    });

    it('closes modal without change when cancelled', () => {
      const onRLMChange = vi.fn();
      render(
        <ModelCostSelector
          models={defaultModels}
          selectedModel="claude-3-opus"
          showRLMToggle
          rlmEnabled={false}
          onRLMChange={onRLMChange}
        />
      );

      fireEvent.click(screen.getByTestId('rlm-toggle'));
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      expect(onRLMChange).not.toHaveBeenCalled();
      expect(screen.queryByTestId('rlm-confirmation-modal')).not.toBeInTheDocument();
    });

    it('does not show modal when disabling RLM', () => {
      const onRLMChange = vi.fn();
      render(
        <ModelCostSelector
          models={defaultModels}
          selectedModel="claude-3-opus"
          showRLMToggle
          rlmEnabled={true}
          onRLMChange={onRLMChange}
        />
      );

      fireEvent.click(screen.getByTestId('rlm-toggle'));

      expect(screen.queryByTestId('rlm-confirmation-modal')).not.toBeInTheDocument();
      expect(onRLMChange).toHaveBeenCalledWith(false);
    });
  });

  describe('Disabled State', () => {
    it('disables selector when disabled', () => {
      render(
        <ModelCostSelector
          models={defaultModels}
          selectedModel="claude-3-opus"
          disabled
        />
      );
      expect(screen.getByTestId('model-dropdown-trigger')).toBeDisabled();
    });

    it('disables RLM toggle when disabled', () => {
      render(
        <ModelCostSelector
          models={defaultModels}
          selectedModel="claude-3-opus"
          showRLMToggle
          disabled
        />
      );
      expect(screen.getByTestId('rlm-toggle')).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('dropdown trigger has proper aria attributes', () => {
      render(<ModelCostSelector models={defaultModels} selectedModel="claude-3-opus" />);
      const trigger = screen.getByTestId('model-dropdown-trigger');
      expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    });

    it('dropdown options have proper role', () => {
      render(<ModelCostSelector models={defaultModels} selectedModel="claude-3-opus" />);
      fireEvent.click(screen.getByTestId('model-dropdown-trigger'));

      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });
  });
});
