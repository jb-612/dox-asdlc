/**
 * Tests for mermaid configuration
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock mermaid before importing the module
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({ svg: '<svg></svg>' }),
  },
}));

describe('mermaid configuration', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('initializes mermaid with correct settings', async () => {
    const mermaid = await import('mermaid');
    const { initMermaid, getMermaidConfig } = await import('./mermaid');

    initMermaid();

    expect(mermaid.default.initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        startOnLoad: false,
        securityLevel: 'strict',
      })
    );
  });

  it('exports getMermaidConfig that returns configuration object', async () => {
    const { getMermaidConfig } = await import('./mermaid');
    const config = getMermaidConfig();

    expect(config).toHaveProperty('startOnLoad', false);
    expect(config).toHaveProperty('theme');
    expect(config).toHaveProperty('securityLevel', 'strict');
    expect(config).toHaveProperty('fontFamily');
  });

  it('supports dark theme configuration', async () => {
    const { getMermaidConfig } = await import('./mermaid');
    const config = getMermaidConfig('dark');

    expect(config.theme).toBe('base');
  });

  it('supports light theme configuration', async () => {
    const { getMermaidConfig } = await import('./mermaid');
    const config = getMermaidConfig('light');

    expect(config.theme).toBe('base');
  });

  it('includes themeVariables for dark theme', async () => {
    const { getMermaidConfig } = await import('./mermaid');
    const config = getMermaidConfig('dark');
    expect(config.themeVariables).toBeDefined();
    expect(config.themeVariables?.primaryTextColor).toBe('#FBFCFC');
    expect(config.themeVariables?.nodeTextColor).toBe('#FBFCFC');
  });

  it('includes themeVariables for light theme', async () => {
    const { getMermaidConfig } = await import('./mermaid');
    const config = getMermaidConfig('light');
    expect(config.themeVariables).toBeDefined();
    expect(config.themeVariables?.primaryTextColor).toBe('#0F172A');
  });

  it('uses base theme to allow custom themeVariables', async () => {
    const { getMermaidConfig } = await import('./mermaid');
    const config = getMermaidConfig('dark');
    expect(config.theme).toBe('base');
  });
});
