/**
 * Mermaid.js configuration for the aSDLC HITL UI
 *
 * Provides initialization and theme configuration for rendering
 * Mermaid diagrams in the documentation SPA.
 */
import mermaid from 'mermaid';

/**
 * Mermaid configuration type
 */
export interface MermaidConfig {
  startOnLoad: boolean;
  theme: string;
  securityLevel: string;
  fontFamily: string;
  logLevel?: number;
}

/**
 * Get mermaid configuration based on theme preference
 *
 * @param theme - 'light' or 'dark' theme preference
 * @returns Mermaid configuration object
 */
export function getMermaidConfig(theme: 'light' | 'dark' = 'dark'): MermaidConfig {
  return {
    startOnLoad: false,
    theme: theme === 'dark' ? 'dark' : 'default',
    securityLevel: 'strict',
    fontFamily: 'Inter, system-ui, sans-serif',
    logLevel: 3, // Error level only
  };
}

/**
 * Initialize mermaid with the default configuration
 *
 * Should be called once at application startup.
 * Uses 'dark' theme by default.
 *
 * @param theme - Optional theme preference
 */
export function initMermaid(theme: 'light' | 'dark' = 'dark'): void {
  const config = getMermaidConfig(theme);
  mermaid.initialize(config);
}

/**
 * Re-initialize mermaid with a new theme
 *
 * Used when the user switches between light and dark mode.
 *
 * @param theme - The new theme preference
 */
export function updateMermaidTheme(theme: 'light' | 'dark'): void {
  initMermaid(theme);
}

export default {
  initMermaid,
  getMermaidConfig,
  updateMermaidTheme,
};
