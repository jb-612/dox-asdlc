/**
 * Tests for SearchInput component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import SearchInput from './SearchInput';

describe('SearchInput', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<SearchInput />);
      expect(screen.getByTestId('search-input')).toBeInTheDocument();
    });

    it('renders search icon', () => {
      render(<SearchInput />);
      expect(screen.getByTestId('search-icon')).toBeInTheDocument();
    });

    it('renders input field', () => {
      render(<SearchInput />);
      expect(screen.getByTestId('search-input-field')).toBeInTheDocument();
    });

    it('displays placeholder text', () => {
      render(<SearchInput placeholder="Search items..." />);
      expect(screen.getByPlaceholderText('Search items...')).toBeInTheDocument();
    });

    it('displays initial value', () => {
      render(<SearchInput initialValue="test query" />);
      expect(screen.getByTestId('search-input-field')).toHaveValue('test query');
    });

    it('applies custom className', () => {
      render(<SearchInput className="my-custom-class" />);
      expect(screen.getByTestId('search-input')).toHaveClass('my-custom-class');
    });
  });

  describe('Size Variants', () => {
    it('renders sm size correctly', () => {
      render(<SearchInput size="sm" />);
      expect(screen.getByTestId('search-input-field')).toHaveClass('h-8');
    });

    it('renders md size correctly', () => {
      render(<SearchInput size="md" />);
      expect(screen.getByTestId('search-input-field')).toHaveClass('h-10');
    });

    it('renders lg size correctly', () => {
      render(<SearchInput size="lg" />);
      expect(screen.getByTestId('search-input-field')).toHaveClass('h-12');
    });
  });

  describe('Disabled State', () => {
    it('disables input when disabled prop is true', () => {
      render(<SearchInput disabled />);
      expect(screen.getByTestId('search-input-field')).toBeDisabled();
    });

    it('applies disabled styling', () => {
      render(<SearchInput disabled />);
      expect(screen.getByTestId('search-input-field')).toHaveClass('opacity-50');
    });
  });

  describe('Clear Button', () => {
    it('shows clear button when there is input value', () => {
      render(<SearchInput initialValue="test" />);
      expect(screen.getByTestId('clear-button')).toBeInTheDocument();
    });

    it('hides clear button when input is empty', () => {
      render(<SearchInput />);
      expect(screen.queryByTestId('clear-button')).not.toBeInTheDocument();
    });

    it('hides clear button when showClear is false', () => {
      render(<SearchInput initialValue="test" showClear={false} />);
      expect(screen.queryByTestId('clear-button')).not.toBeInTheDocument();
    });

    it('clears input when clear button is clicked', async () => {
      render(<SearchInput initialValue="test" />);
      const clearButton = screen.getByTestId('clear-button');

      fireEvent.click(clearButton);

      expect(screen.getByTestId('search-input-field')).toHaveValue('');
    });

    it('calls onClear when clear button is clicked', () => {
      const onClear = vi.fn();
      render(<SearchInput initialValue="test" onClear={onClear} />);

      fireEvent.click(screen.getByTestId('clear-button'));

      expect(onClear).toHaveBeenCalled();
    });

    it('calls onChange with empty string when cleared', () => {
      const onChange = vi.fn();
      render(<SearchInput initialValue="test" onChange={onChange} />);

      fireEvent.click(screen.getByTestId('clear-button'));

      expect(onChange).toHaveBeenCalledWith('');
    });
  });

  describe('Loading State', () => {
    it('shows loading indicator when isLoading is true', () => {
      render(<SearchInput isLoading />);
      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    });

    it('hides clear button when loading', () => {
      render(<SearchInput initialValue="test" isLoading />);
      expect(screen.queryByTestId('clear-button')).not.toBeInTheDocument();
    });
  });

  describe('onChange Callback', () => {
    it('calls onChange immediately when input changes', () => {
      const onChange = vi.fn();
      render(<SearchInput onChange={onChange} />);

      fireEvent.change(screen.getByTestId('search-input-field'), {
        target: { value: 'test' },
      });

      expect(onChange).toHaveBeenCalledWith('test');
    });

    it('calls onChange on every change', () => {
      const onChange = vi.fn();
      render(<SearchInput onChange={onChange} />);

      fireEvent.change(screen.getByTestId('search-input-field'), {
        target: { value: 't' },
      });
      fireEvent.change(screen.getByTestId('search-input-field'), {
        target: { value: 'te' },
      });
      fireEvent.change(screen.getByTestId('search-input-field'), {
        target: { value: 'tes' },
      });

      expect(onChange).toHaveBeenCalledTimes(3);
    });
  });

  describe('Debounced onSearch Callback', () => {
    it('calls onSearch after debounce delay', async () => {
      const onSearch = vi.fn();
      render(<SearchInput onSearch={onSearch} debounceMs={300} />);

      fireEvent.change(screen.getByTestId('search-input-field'), {
        target: { value: 'test' },
      });

      // Not called immediately
      expect(onSearch).not.toHaveBeenCalled();

      // Fast forward timers
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(onSearch).toHaveBeenCalledWith('test');
    });

    it('only calls onSearch once for rapid input', async () => {
      const onSearch = vi.fn();
      render(<SearchInput onSearch={onSearch} debounceMs={300} />);

      fireEvent.change(screen.getByTestId('search-input-field'), {
        target: { value: 't' },
      });
      act(() => {
        vi.advanceTimersByTime(100);
      });

      fireEvent.change(screen.getByTestId('search-input-field'), {
        target: { value: 'te' },
      });
      act(() => {
        vi.advanceTimersByTime(100);
      });

      fireEvent.change(screen.getByTestId('search-input-field'), {
        target: { value: 'tes' },
      });
      act(() => {
        vi.advanceTimersByTime(100);
      });

      fireEvent.change(screen.getByTestId('search-input-field'), {
        target: { value: 'test' },
      });

      // Advance to trigger debounce
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Should only be called once with final value
      expect(onSearch).toHaveBeenCalledTimes(1);
      expect(onSearch).toHaveBeenCalledWith('test');
    });

    it('uses custom debounce delay', async () => {
      const onSearch = vi.fn();
      render(<SearchInput onSearch={onSearch} debounceMs={500} />);

      fireEvent.change(screen.getByTestId('search-input-field'), {
        target: { value: 'test' },
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(onSearch).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(onSearch).toHaveBeenCalledWith('test');
    });
  });

  describe('Keyboard Navigation', () => {
    it('calls onSubmit when Enter is pressed', () => {
      const onSubmit = vi.fn();
      render(<SearchInput initialValue="test" onSubmit={onSubmit} />);

      fireEvent.keyDown(screen.getByTestId('search-input-field'), {
        key: 'Enter',
      });

      expect(onSubmit).toHaveBeenCalledWith('test');
    });

    it('clears input when Escape is pressed', () => {
      render(<SearchInput initialValue="test" />);

      fireEvent.keyDown(screen.getByTestId('search-input-field'), {
        key: 'Escape',
      });

      expect(screen.getByTestId('search-input-field')).toHaveValue('');
    });
  });

  describe('Initial Value Updates', () => {
    it('updates value when initialValue prop changes', () => {
      const { rerender } = render(<SearchInput initialValue="first" />);
      expect(screen.getByTestId('search-input-field')).toHaveValue('first');

      rerender(<SearchInput initialValue="second" />);
      expect(screen.getByTestId('search-input-field')).toHaveValue('second');
    });
  });
});
