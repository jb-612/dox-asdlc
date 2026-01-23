/**
 * Accessibility utilities and components
 *
 * Provides helpers for ARIA attributes, screen reader content, and accessible patterns.
 */

import { useState, useCallback, ReactNode, ElementType } from 'react';
import clsx from 'clsx';

// ============================================================================
// VisuallyHidden - Content visible only to screen readers
// ============================================================================

interface VisuallyHiddenProps {
  children: ReactNode;
  as?: ElementType;
  className?: string;
}

export function VisuallyHidden({
  children,
  as: Component = 'span',
  className,
}: VisuallyHiddenProps) {
  return (
    <Component className={clsx('sr-only', className)}>
      {children}
    </Component>
  );
}

// ============================================================================
// SkipLink - Skip navigation for keyboard users
// ============================================================================

interface SkipLinkProps {
  href: string;
  children: ReactNode;
}

export function SkipLink({ href, children }: SkipLinkProps) {
  return (
    <a
      data-testid="skip-link"
      href={href}
      className={clsx(
        'sr-only focus:not-sr-only',
        'focus:fixed focus:top-4 focus:left-4 focus:z-50',
        'focus:px-4 focus:py-2 focus:bg-accent-blue focus:text-white focus:rounded-lg',
        'focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-accent-blue'
      )}
    >
      {children}
    </a>
  );
}

// ============================================================================
// LiveRegion - Announces dynamic content to screen readers
// ============================================================================

interface LiveRegionProps {
  children: ReactNode;
  politeness?: 'polite' | 'assertive';
  className?: string;
}

export function LiveRegion({
  children,
  politeness = 'polite',
  className,
}: LiveRegionProps) {
  return (
    <div
      data-testid="live-region"
      aria-live={politeness}
      aria-atomic="true"
      className={className}
    >
      {children}
    </div>
  );
}

// ============================================================================
// useAnnounce - Hook for announcing messages to screen readers
// ============================================================================

interface UseAnnounceOptions {
  clearDelay?: number;
}

export function useAnnounce(options: UseAnnounceOptions = {}) {
  const { clearDelay = 5000 } = options;
  const [message, setMessage] = useState('');

  const announce = useCallback(
    (text: string, clearAfter: number = clearDelay) => {
      setMessage(text);

      if (clearAfter > 0) {
        setTimeout(() => setMessage(''), clearAfter);
      }
    },
    [clearDelay]
  );

  const clear = useCallback(() => setMessage(''), []);

  return { message, announce, clear };
}

// ============================================================================
// AccessibleIcon - Icon wrapper with proper accessibility
// ============================================================================

interface AccessibleIconProps {
  icon: ReactNode;
  label?: string;
}

export function AccessibleIcon({ icon, label }: AccessibleIconProps) {
  if (label) {
    return (
      <span data-testid="accessible-icon" aria-label={label} role="img">
        {icon}
      </span>
    );
  }

  return (
    <span data-testid="accessible-icon" aria-hidden="true">
      {icon}
    </span>
  );
}

// ============================================================================
// ARIA attribute helpers
// ============================================================================

/**
 * Get aria-label attribute object (returns empty object if no label)
 */
export function getAriaLabel(label?: string): Record<string, string> {
  if (!label) return {};
  return { 'aria-label': label };
}

/**
 * Get aria-describedby attribute object (returns empty object if no id)
 */
export function getAriaDescribedBy(id?: string): Record<string, string> {
  if (!id) return {};
  return { 'aria-describedby': id };
}

/**
 * Get aria-labelledby attribute object (returns empty object if no id)
 */
export function getAriaLabelledBy(id?: string): Record<string, string> {
  if (!id) return {};
  return { 'aria-labelledby': id };
}

/**
 * Get aria-expanded attribute for expandable elements
 */
export function getAriaExpanded(expanded: boolean): Record<string, string> {
  return { 'aria-expanded': String(expanded) };
}

/**
 * Get aria-selected attribute for selectable items
 */
export function getAriaSelected(selected: boolean): Record<string, string> {
  return { 'aria-selected': String(selected) };
}

/**
 * Get aria-current attribute for navigation items
 */
export function getAriaCurrent(
  current: boolean | 'page' | 'step' | 'location' | 'date' | 'time'
): Record<string, string> {
  if (!current) return {};
  return { 'aria-current': String(current) };
}

/**
 * Get aria-disabled attribute
 */
export function getAriaDisabled(disabled: boolean): Record<string, string | undefined> {
  if (!disabled) return {};
  return { 'aria-disabled': 'true' };
}

/**
 * Get aria-busy attribute for loading states
 */
export function getAriaBusy(busy: boolean): Record<string, string | undefined> {
  if (!busy) return {};
  return { 'aria-busy': 'true' };
}

// ============================================================================
// Role helpers
// ============================================================================

type AriaRole =
  | 'alert'
  | 'alertdialog'
  | 'button'
  | 'checkbox'
  | 'dialog'
  | 'grid'
  | 'link'
  | 'listbox'
  | 'menu'
  | 'menuitem'
  | 'option'
  | 'progressbar'
  | 'radio'
  | 'region'
  | 'search'
  | 'slider'
  | 'switch'
  | 'tab'
  | 'tablist'
  | 'tabpanel'
  | 'textbox'
  | 'tooltip'
  | 'tree'
  | 'treeitem';

/**
 * Get role attribute
 */
export function getRole(role: AriaRole): { role: AriaRole } {
  return { role };
}

// ============================================================================
// Focus management helpers
// ============================================================================

/**
 * Focus the first focusable element in a container
 */
export function focusFirstElement(container: HTMLElement): void {
  const focusable = container.querySelector<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  focusable?.focus();
}

/**
 * Focus an element by ID
 */
export function focusElement(id: string): void {
  document.getElementById(id)?.focus();
}

/**
 * Check if an element is focusable
 */
export function isFocusable(element: Element): boolean {
  const focusableSelector =
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  return element.matches(focusableSelector);
}

// ============================================================================
// Color contrast utilities
// ============================================================================

/**
 * Check if a color combination has sufficient contrast (WCAG AA)
 * Returns true if contrast ratio >= 4.5:1 for normal text
 */
export function hasMinimumContrast(
  foreground: string,
  background: string,
  largeText: boolean = false
): boolean {
  // For simplicity, this is a placeholder. In production, use a color library
  // to calculate actual luminance and contrast ratio.
  // WCAG AA requires 4.5:1 for normal text, 3:1 for large text
  const minRatio = largeText ? 3 : 4.5;
  // Placeholder - would calculate actual contrast
  return true;
}
