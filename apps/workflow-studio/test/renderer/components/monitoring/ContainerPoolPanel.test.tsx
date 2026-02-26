import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { ContainerRecord } from '../../../../src/shared/types/execution';

// ---------------------------------------------------------------------------
// Mock usePoolStatus hook
// ---------------------------------------------------------------------------

let mockContainers: ContainerRecord[] = [];

vi.mock('../../../../src/renderer/hooks/usePoolStatus', () => ({
  usePoolStatus: () => mockContainers,
}));

import ContainerPoolPanel from '../../../../src/renderer/components/monitoring/ContainerPoolPanel';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeRecord(overrides: Partial<ContainerRecord> = {}): ContainerRecord {
  return {
    id: 'container-abc123def456',
    state: 'idle',
    blockId: null,
    port: 49200,
    agentUrl: 'http://localhost:49200',
    createdAt: Date.now() - 60000,
    dormantSince: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('T15: ContainerPoolPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContainers = [];
  });

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------

  it('renders empty state when no containers', () => {
    mockContainers = [];
    render(<ContainerPoolPanel />);

    expect(screen.getByText(/no containers/i)).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Table rendering
  // -------------------------------------------------------------------------

  it('renders a table when containers exist', () => {
    mockContainers = [makeRecord()];
    render(<ContainerPoolPanel />);

    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('renders table headers for container properties', () => {
    mockContainers = [makeRecord()];
    render(<ContainerPoolPanel />);

    // Use getAllByRole to check column headers exist
    const headers = screen.getAllByRole('columnheader');
    const headerTexts = headers.map((h) => h.textContent);
    expect(headerTexts).toContain('Container');
    expect(headerTexts).toContain('State');
    expect(headerTexts).toContain('Block');
    expect(headerTexts).toContain('Port');
  });

  // -------------------------------------------------------------------------
  // Container ID truncation
  // -------------------------------------------------------------------------

  it('truncates long container IDs', () => {
    mockContainers = [makeRecord({ id: 'container-abc123def456789xyz' })];
    render(<ContainerPoolPanel />);

    // Should show truncated ID (first 12 chars)
    expect(screen.getByText('container-ab')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // State badges (color-coded)
  // -------------------------------------------------------------------------

  it('renders idle state with a badge', () => {
    mockContainers = [makeRecord({ state: 'idle' })];
    render(<ContainerPoolPanel />);

    const badge = screen.getByText('idle');
    expect(badge).toBeInTheDocument();
  });

  it('renders running state with a badge', () => {
    mockContainers = [makeRecord({ state: 'running', blockId: 'block-1' })];
    render(<ContainerPoolPanel />);

    expect(screen.getByText('running')).toBeInTheDocument();
  });

  it('renders dormant state with a badge', () => {
    mockContainers = [makeRecord({ state: 'dormant', dormantSince: Date.now() })];
    render(<ContainerPoolPanel />);

    expect(screen.getByText('dormant')).toBeInTheDocument();
  });

  it('renders terminated state with a badge', () => {
    mockContainers = [makeRecord({ state: 'terminated' })];
    render(<ContainerPoolPanel />);

    expect(screen.getByText('terminated')).toBeInTheDocument();
  });

  it('renders starting state with a badge', () => {
    mockContainers = [makeRecord({ state: 'starting' })];
    render(<ContainerPoolPanel />);

    expect(screen.getByText('starting')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Block ID display
  // -------------------------------------------------------------------------

  it('displays block ID when container is assigned', () => {
    mockContainers = [makeRecord({ state: 'running', blockId: 'design-node' })];
    render(<ContainerPoolPanel />);

    expect(screen.getByText('design-node')).toBeInTheDocument();
  });

  it('displays dash when no block is assigned', () => {
    mockContainers = [makeRecord({ blockId: null })];
    render(<ContainerPoolPanel />);

    // Look for the dash character in block column
    const cells = screen.getAllByRole('cell');
    const blockCell = cells.find((c) => c.textContent === '-');
    expect(blockCell).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Port display
  // -------------------------------------------------------------------------

  it('displays the port number', () => {
    mockContainers = [makeRecord({ port: 49205 })];
    render(<ContainerPoolPanel />);

    expect(screen.getByText('49205')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Multiple containers
  // -------------------------------------------------------------------------

  it('renders multiple containers as table rows', () => {
    mockContainers = [
      makeRecord({ id: 'c1', state: 'idle', port: 49200 }),
      makeRecord({ id: 'c2', state: 'running', blockId: 'block-a', port: 49201 }),
      makeRecord({ id: 'c3', state: 'terminated', port: 49202 }),
    ];
    render(<ContainerPoolPanel />);

    const rows = screen.getAllByRole('row');
    // 1 header row + 3 data rows = 4
    expect(rows.length).toBe(4);
  });

  // -------------------------------------------------------------------------
  // Elapsed time
  // -------------------------------------------------------------------------

  it('displays elapsed time for running containers', () => {
    mockContainers = [
      makeRecord({
        state: 'running',
        blockId: 'block-1',
        createdAt: Date.now() - 120000, // 2 minutes ago
      }),
    ];
    render(<ContainerPoolPanel />);

    // Should show some form of elapsed time
    expect(screen.getByText(/elapsed/i)).toBeInTheDocument();
  });
});
