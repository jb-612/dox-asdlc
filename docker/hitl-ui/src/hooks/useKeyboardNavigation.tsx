/**
 * Keyboard navigation hooks and utilities
 *
 * Provides shortcuts, focus trapping, and arrow key navigation.
 */

import {
  useEffect,
  useCallback,
  useState,
  createContext,
  useContext,
  ReactNode,
  RefObject,
} from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

// ============================================================================
// useKeyboardShortcuts
// ============================================================================

type ShortcutHandler = (event: KeyboardEvent) => void;
type ShortcutsMap = Record<string, ShortcutHandler>;

function normalizeKey(event: KeyboardEvent): string {
  const parts: string[] = [];
  if (event.ctrlKey) parts.push('ctrl');
  if (event.altKey) parts.push('alt');
  if (event.shiftKey) parts.push('shift');
  if (event.metaKey) parts.push('meta');

  const key = event.key === ' ' ? 'Space' : event.key;
  parts.push(key.toLowerCase());

  return parts.join('+');
}

export function useKeyboardShortcuts(shortcuts: ShortcutsMap) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Allow Escape in inputs
        if (event.key !== 'Escape') {
          return;
        }
      }

      const normalizedKey = normalizeKey(event);

      // Check for exact match
      if (shortcuts[normalizedKey]) {
        event.preventDefault();
        shortcuts[normalizedKey](event);
        return;
      }

      // Check for key without modifiers
      if (shortcuts[event.key]) {
        event.preventDefault();
        shortcuts[event.key](event);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}

// ============================================================================
// useFocusTrap
// ============================================================================

export function useFocusTrap(
  containerRef: RefObject<HTMLElement>,
  active: boolean = true
) {
  useEffect(() => {
    if (!active || !containerRef.current) return;

    const container = containerRef.current;

    const getFocusableElements = () => {
      return container.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey) {
        // Shift+Tab: if on first element, go to last
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: if on last element, go to first
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    // Focus first element on mount
    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }

    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [containerRef, active]);
}

// ============================================================================
// useArrowNavigation
// ============================================================================

interface ArrowNavigationOptions {
  itemCount: number;
  onSelect?: (index: number) => void;
  initialIndex?: number;
  horizontal?: boolean;
}

export function useArrowNavigation({
  itemCount,
  onSelect,
  initialIndex = 0,
  horizontal = false,
}: ArrowNavigationOptions) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const nextKey = horizontal ? 'ArrowRight' : 'ArrowDown';
      const prevKey = horizontal ? 'ArrowLeft' : 'ArrowUp';

      switch (event.key) {
        case nextKey:
          event.preventDefault();
          setActiveIndex((prev) => (prev + 1) % itemCount);
          break;
        case prevKey:
          event.preventDefault();
          setActiveIndex((prev) => (prev - 1 + itemCount) % itemCount);
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          onSelect?.(activeIndex);
          break;
        case 'Home':
          event.preventDefault();
          setActiveIndex(0);
          break;
        case 'End':
          event.preventDefault();
          setActiveIndex(itemCount - 1);
          break;
      }
    },
    [itemCount, activeIndex, horizontal, onSelect]
  );

  const containerProps = {
    onKeyDown: handleKeyDown,
    role: 'listbox' as const,
    tabIndex: 0,
  };

  const getItemProps = (index: number) => ({
    role: 'option' as const,
    'data-active': String(index === activeIndex),
    'aria-selected': index === activeIndex,
    onClick: () => {
      setActiveIndex(index);
      onSelect?.(index);
    },
  });

  return {
    activeIndex,
    setActiveIndex,
    containerProps,
    getItemProps,
  };
}

// ============================================================================
// KeyboardShortcutsProvider
// ============================================================================

interface ShortcutConfig {
  label: string;
  handler: () => void;
  category?: string;
}

interface ShortcutsContextValue {
  shortcuts: Record<string, ShortcutConfig>;
  registerShortcut: (key: string, config: ShortcutConfig) => void;
  unregisterShortcut: (key: string) => void;
}

const ShortcutsContext = createContext<ShortcutsContextValue | null>(null);

interface KeyboardShortcutsProviderProps {
  children: ReactNode;
  shortcuts?: Record<string, ShortcutConfig>;
}

export function KeyboardShortcutsProvider({
  children,
  shortcuts: initialShortcuts = {},
}: KeyboardShortcutsProviderProps) {
  const [shortcuts, setShortcuts] = useState(initialShortcuts);

  const registerShortcut = useCallback((key: string, config: ShortcutConfig) => {
    setShortcuts((prev) => ({ ...prev, [key]: config }));
  }, []);

  const unregisterShortcut = useCallback((key: string) => {
    setShortcuts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  // Convert to handlers map
  const handlers = Object.fromEntries(
    Object.entries(shortcuts).map(([key, config]) => [key, config.handler])
  );

  useKeyboardShortcuts(handlers);

  return (
    <ShortcutsContext.Provider value={{ shortcuts, registerShortcut, unregisterShortcut }}>
      {children}
    </ShortcutsContext.Provider>
  );
}

export function useShortcutsContext() {
  const context = useContext(ShortcutsContext);
  if (!context) {
    throw new Error('useShortcutsContext must be used within KeyboardShortcutsProvider');
  }
  return context;
}

// ============================================================================
// ShortcutHelpPanel
// ============================================================================

interface ShortcutHelp {
  keys: string;
  label: string;
  category?: string;
}

interface ShortcutHelpPanelProps {
  shortcuts: ShortcutHelp[];
  onClose?: () => void;
}

export function ShortcutHelpPanel({ shortcuts, onClose }: ShortcutHelpPanelProps) {
  // Group shortcuts by category
  const grouped = shortcuts.reduce(
    (acc, shortcut) => {
      const category = shortcut.category || 'General';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(shortcut);
      return acc;
    },
    {} as Record<string, ShortcutHelp[]>
  );

  return (
    <div
      data-testid="shortcut-help-panel"
      className="bg-bg-secondary border border-bg-tertiary rounded-lg p-6 max-w-md"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-text-primary">Keyboard Shortcuts</h2>
        <button
          data-testid="close-help"
          onClick={onClose}
          className="p-1 text-text-tertiary hover:text-text-primary transition-colors"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-4">
        {Object.entries(grouped).map(([category, categoryShortcuts]) => (
          <div key={category}>
            <h3 className="text-sm font-medium text-text-secondary mb-2">{category}</h3>
            <div className="space-y-2">
              {categoryShortcuts.map((shortcut) => (
                <div
                  key={shortcut.keys}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-text-secondary">{shortcut.label}</span>
                  <kbd className="px-2 py-1 bg-bg-tertiary rounded text-xs font-mono text-text-primary">
                    {shortcut.keys.replace('ctrl+', 'Ctrl + ').replace('alt+', 'Alt + ')}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
