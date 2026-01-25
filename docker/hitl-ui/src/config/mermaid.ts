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
  themeVariables?: Record<string, string>;
}

/**
 * Get mermaid configuration based on theme preference
 *
 * @param theme - 'light' or 'dark' theme preference
 * @returns Mermaid configuration object
 */
export function getMermaidConfig(theme: 'light' | 'dark' = 'dark'): MermaidConfig {
  const isDark = theme === 'dark';

  return {
    startOnLoad: false,
    theme: isDark ? 'dark' : 'default',
    securityLevel: 'loose',
    flowchart: { htmlLabels: true },
    fontFamily: 'Inter, system-ui, sans-serif',
    logLevel: 3, // Error level only
    themeVariables: isDark ? {
      primaryColor: '#1E5160',
      primaryTextColor: '#FBFCFC',
      primaryBorderColor: '#2A7A8C',
      secondaryColor: '#141414',
      secondaryTextColor: '#FBFCFC',
      tertiaryColor: '#0a0a0a',
      tertiaryTextColor: '#A09E9D',
      lineColor: '#A09E9D',
      textColor: '#FBFCFC',
      mainBkg: '#0a0a0a',
      nodeBorder: '#2A7A8C',
      nodeTextColor: '#FBFCFC',
      edgeLabelBackground: '#141414',
      clusterBkg: '#141414',
      clusterBorder: '#2A7A8C',
      titleColor: '#FBFCFC',
      // Additional text color variables for visibility
      labelTextColor: '#FBFCFC',
      actorTextColor: '#FBFCFC',
      signalTextColor: '#FBFCFC',
      loopTextColor: '#FBFCFC',
      noteBkgColor: '#141414',
      noteTextColor: '#FBFCFC',
      activationBkgColor: '#1E5160',
      sequenceNumberColor: '#FBFCFC',
      sectionBkgColor: '#141414',
      altSectionBkgColor: '#0a0a0a',
      sectionBkgColor2: '#1E5160',
      taskTextColor: '#FBFCFC',
      taskTextDarkColor: '#FBFCFC',
      taskTextOutsideColor: '#FBFCFC',
      taskTextLightColor: '#FBFCFC',
    } : {
      primaryColor: '#0D9488',
      primaryTextColor: '#0F172A',
      primaryBorderColor: '#14B8A6',
      secondaryColor: '#F8FAFC',
      secondaryTextColor: '#0F172A',
      tertiaryColor: '#E2E8F0',
      tertiaryTextColor: '#64748B',
      lineColor: '#64748B',
      textColor: '#0F172A',
      mainBkg: '#FFFFFF',
      nodeBorder: '#14B8A6',
      nodeTextColor: '#0F172A',
      edgeLabelBackground: '#F8FAFC',
      clusterBkg: '#F8FAFC',
      clusterBorder: '#14B8A6',
      titleColor: '#0F172A',
    },
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
