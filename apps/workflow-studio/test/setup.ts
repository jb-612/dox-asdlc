import { vi } from 'vitest';

// Global mock for react-diff-viewer-continued — the library's ESM bundle
// references a workerBundle that doesn't resolve in jsdom/Node environments.
vi.mock('react-diff-viewer-continued', () => ({
  default: ({
    oldValue,
    newValue,
    splitView,
  }: {
    oldValue: string;
    newValue: string;
    splitView: boolean;
  }) => {
    const React = require('react');
    return React.createElement(
      'div',
      { 'data-testid': 'mock-react-diff-viewer' },
      React.createElement('span', { 'data-testid': 'rdv-old' }, oldValue),
      React.createElement('span', { 'data-testid': 'rdv-new' }, newValue),
      React.createElement(
        'span',
        { 'data-testid': 'rdv-split' },
        splitView ? 'split' : 'unified',
      ),
    );
  },
}));
