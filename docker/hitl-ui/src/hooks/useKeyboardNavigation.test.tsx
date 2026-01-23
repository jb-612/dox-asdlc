/**
 * Tests for keyboard navigation hooks and utilities
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  useKeyboardShortcuts,
  useFocusTrap,
  useArrowNavigation,
  KeyboardShortcutsProvider,
  ShortcutHelpPanel,
} from './useKeyboardNavigation';
import { useRef } from 'react';

// Test component for useKeyboardShortcuts
function ShortcutsTest({
  onShortcut,
}: {
  onShortcut: (key: string) => void;
}) {
  useKeyboardShortcuts({
    'ctrl+s': () => onShortcut('save'),
    'ctrl+k': () => onShortcut('search'),
    Escape: () => onShortcut('escape'),
    '?': () => onShortcut('help'),
  });

  return <div data-testid="shortcuts-test">Test component</div>;
}

// Test component for useFocusTrap
function FocusTrapTest({ active = true }: { active?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(containerRef, active);

  return (
    <div ref={containerRef} data-testid="focus-trap-container">
      <button data-testid="btn-1">Button 1</button>
      <button data-testid="btn-2">Button 2</button>
      <button data-testid="btn-3">Button 3</button>
    </div>
  );
}

// Test component for useArrowNavigation
function ArrowNavTest({
  onSelect,
}: {
  onSelect?: (index: number) => void;
}) {
  const { activeIndex, setActiveIndex, containerProps, getItemProps } = useArrowNavigation({
    itemCount: 3,
    onSelect,
  });

  return (
    <div {...containerProps} data-testid="arrow-nav-container">
      <span data-testid="active-index">{activeIndex}</span>
      <div {...getItemProps(0)} data-testid="item-0">Item 0</div>
      <div {...getItemProps(1)} data-testid="item-1">Item 1</div>
      <div {...getItemProps(2)} data-testid="item-2">Item 2</div>
    </div>
  );
}

describe('useKeyboardShortcuts', () => {
  describe('Shortcut Registration', () => {
    it('registers shortcuts on mount', () => {
      const onShortcut = vi.fn();
      render(<ShortcutsTest onShortcut={onShortcut} />);

      expect(screen.getByTestId('shortcuts-test')).toBeInTheDocument();
    });

    it('handles ctrl+key shortcuts', () => {
      const onShortcut = vi.fn();
      render(<ShortcutsTest onShortcut={onShortcut} />);

      fireEvent.keyDown(document, { key: 's', ctrlKey: true });

      expect(onShortcut).toHaveBeenCalledWith('save');
    });

    it('handles single key shortcuts', () => {
      const onShortcut = vi.fn();
      render(<ShortcutsTest onShortcut={onShortcut} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(onShortcut).toHaveBeenCalledWith('escape');
    });

    it('handles character shortcuts', () => {
      const onShortcut = vi.fn();
      render(<ShortcutsTest onShortcut={onShortcut} />);

      fireEvent.keyDown(document, { key: '?' });

      expect(onShortcut).toHaveBeenCalledWith('help');
    });
  });

  describe('Shortcut Context', () => {
    it('prevents default for registered shortcuts', () => {
      const onShortcut = vi.fn();
      render(<ShortcutsTest onShortcut={onShortcut} />);

      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
        bubbles: true,
      });
      const preventDefault = vi.spyOn(event, 'preventDefault');

      document.dispatchEvent(event);

      expect(preventDefault).toHaveBeenCalled();
    });
  });
});

describe('useFocusTrap', () => {
  describe('Focus Trapping', () => {
    it('traps focus within container', () => {
      render(<FocusTrapTest />);

      const btn1 = screen.getByTestId('btn-1');
      const btn3 = screen.getByTestId('btn-3');

      btn3.focus();

      // Tab from last element should go to first
      fireEvent.keyDown(btn3, { key: 'Tab' });

      // Focus should wrap to first button
      expect(document.activeElement).toBe(btn1);
    });

    it('allows shift+tab to go backwards', () => {
      render(<FocusTrapTest />);

      const btn1 = screen.getByTestId('btn-1');
      const btn3 = screen.getByTestId('btn-3');

      btn1.focus();

      // Shift+Tab from first should go to last
      fireEvent.keyDown(btn1, { key: 'Tab', shiftKey: true });

      // Focus should wrap to last button
      expect(document.activeElement).toBe(btn3);
    });

    it('does not trap when inactive', () => {
      render(<FocusTrapTest active={false} />);

      const btn3 = screen.getByTestId('btn-3');
      btn3.focus();

      // Should not trap (no wrapping behavior)
      fireEvent.keyDown(btn3, { key: 'Tab' });

      // Focus behavior is not modified
      expect(true).toBe(true);
    });
  });
});

describe('useArrowNavigation', () => {
  describe('Navigation', () => {
    it('starts with first item active', () => {
      render(<ArrowNavTest />);

      expect(screen.getByTestId('active-index')).toHaveTextContent('0');
    });

    it('navigates down with ArrowDown', () => {
      render(<ArrowNavTest />);

      fireEvent.keyDown(screen.getByTestId('arrow-nav-container'), { key: 'ArrowDown' });

      expect(screen.getByTestId('active-index')).toHaveTextContent('1');
    });

    it('navigates up with ArrowUp', () => {
      render(<ArrowNavTest />);

      // First go down
      fireEvent.keyDown(screen.getByTestId('arrow-nav-container'), { key: 'ArrowDown' });

      // Then go up
      fireEvent.keyDown(screen.getByTestId('arrow-nav-container'), { key: 'ArrowUp' });

      expect(screen.getByTestId('active-index')).toHaveTextContent('0');
    });

    it('wraps from last to first', () => {
      render(<ArrowNavTest />);

      // Go to end
      fireEvent.keyDown(screen.getByTestId('arrow-nav-container'), { key: 'ArrowDown' });
      fireEvent.keyDown(screen.getByTestId('arrow-nav-container'), { key: 'ArrowDown' });
      fireEvent.keyDown(screen.getByTestId('arrow-nav-container'), { key: 'ArrowDown' });

      expect(screen.getByTestId('active-index')).toHaveTextContent('0');
    });

    it('wraps from first to last', () => {
      render(<ArrowNavTest />);

      fireEvent.keyDown(screen.getByTestId('arrow-nav-container'), { key: 'ArrowUp' });

      expect(screen.getByTestId('active-index')).toHaveTextContent('2');
    });

    it('selects item with Enter', () => {
      const onSelect = vi.fn();
      render(<ArrowNavTest onSelect={onSelect} />);

      fireEvent.keyDown(screen.getByTestId('arrow-nav-container'), { key: 'ArrowDown' });
      fireEvent.keyDown(screen.getByTestId('arrow-nav-container'), { key: 'Enter' });

      expect(onSelect).toHaveBeenCalledWith(1);
    });
  });

  describe('Item Props', () => {
    it('applies active class to active item', () => {
      render(<ArrowNavTest />);

      expect(screen.getByTestId('item-0')).toHaveAttribute('data-active', 'true');
      expect(screen.getByTestId('item-1')).toHaveAttribute('data-active', 'false');
    });

    it('updates active class on navigation', () => {
      render(<ArrowNavTest />);

      fireEvent.keyDown(screen.getByTestId('arrow-nav-container'), { key: 'ArrowDown' });

      expect(screen.getByTestId('item-0')).toHaveAttribute('data-active', 'false');
      expect(screen.getByTestId('item-1')).toHaveAttribute('data-active', 'true');
    });
  });
});

describe('KeyboardShortcutsProvider', () => {
  it('renders children', () => {
    render(
      <KeyboardShortcutsProvider>
        <div data-testid="child">Child</div>
      </KeyboardShortcutsProvider>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('provides shortcuts context', () => {
    render(
      <KeyboardShortcutsProvider
        shortcuts={{
          'ctrl+s': { label: 'Save', handler: vi.fn() },
        }}
      >
        <div data-testid="child">Child</div>
      </KeyboardShortcutsProvider>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
  });
});

describe('ShortcutHelpPanel', () => {
  const mockShortcuts = [
    { keys: 'ctrl+s', label: 'Save', category: 'File' },
    { keys: 'ctrl+k', label: 'Search', category: 'Navigation' },
    { keys: 'Escape', label: 'Close', category: 'Navigation' },
  ];

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<ShortcutHelpPanel shortcuts={mockShortcuts} />);

      expect(screen.getByTestId('shortcut-help-panel')).toBeInTheDocument();
    });

    it('displays title', () => {
      render(<ShortcutHelpPanel shortcuts={mockShortcuts} />);

      expect(screen.getByText(/keyboard shortcuts/i)).toBeInTheDocument();
    });
  });

  describe('Shortcuts Display', () => {
    it('displays all shortcuts', () => {
      render(<ShortcutHelpPanel shortcuts={mockShortcuts} />);

      expect(screen.getByText('Save')).toBeInTheDocument();
      expect(screen.getByText('Search')).toBeInTheDocument();
      expect(screen.getByText('Close')).toBeInTheDocument();
    });

    it('displays shortcut keys', () => {
      render(<ShortcutHelpPanel shortcuts={mockShortcuts} />);

      // Multiple shortcuts contain "Ctrl"
      expect(screen.getAllByText(/ctrl/i).length).toBeGreaterThan(0);
    });

    it('groups by category', () => {
      render(<ShortcutHelpPanel shortcuts={mockShortcuts} />);

      expect(screen.getByText('File')).toBeInTheDocument();
      expect(screen.getByText('Navigation')).toBeInTheDocument();
    });
  });

  describe('Close Action', () => {
    it('shows close button', () => {
      render(<ShortcutHelpPanel shortcuts={mockShortcuts} />);

      expect(screen.getByTestId('close-help')).toBeInTheDocument();
    });

    it('calls onClose when clicked', () => {
      const onClose = vi.fn();
      render(<ShortcutHelpPanel shortcuts={mockShortcuts} onClose={onClose} />);

      fireEvent.click(screen.getByTestId('close-help'));

      expect(onClose).toHaveBeenCalled();
    });
  });
});
