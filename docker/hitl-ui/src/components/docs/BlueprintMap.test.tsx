/**
 * Tests for BlueprintMap component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BlueprintMap, { type Cluster, type ClusterItem } from './BlueprintMap';

describe('BlueprintMap', () => {
  const defaultClusters: Cluster[] = [
    {
      id: 'discovery',
      name: 'Discovery',
      description: 'Requirements gathering and acceptance criteria',
      color: 'teal',
      items: [
        { id: 'prd-agent', name: 'PRD Agent', type: 'agent' },
        { id: 'acceptance-agent', name: 'Acceptance Agent', type: 'agent' },
        { id: 'prd-artifact', name: 'PRD Document', type: 'artifact' },
        { id: 'requirements-gate', name: 'Requirements Gate', type: 'gate' },
      ],
    },
    {
      id: 'design',
      name: 'Design',
      description: 'Architecture and technical design',
      color: 'purple',
      items: [
        { id: 'surveyor-agent', name: 'Surveyor Agent', type: 'agent' },
        { id: 'architect-agent', name: 'Architect Agent', type: 'agent' },
        { id: 'tdd-artifact', name: 'TDD Document', type: 'artifact' },
        { id: 'design-gate', name: 'Design Gate', type: 'gate' },
      ],
    },
    {
      id: 'development',
      name: 'Development',
      description: 'Coding, testing, and review',
      color: 'blue',
      items: [
        { id: 'utest-agent', name: 'UTest Agent', type: 'agent' },
        { id: 'coding-agent', name: 'Coding Agent', type: 'agent' },
        { id: 'debugger-agent', name: 'Debugger Agent', type: 'agent' },
        { id: 'reviewer-agent', name: 'Reviewer Agent', type: 'agent' },
        { id: 'code-artifact', name: 'Source Code', type: 'artifact' },
        { id: 'code-review-gate', name: 'Code Review Gate', type: 'gate' },
      ],
    },
    {
      id: 'validation',
      name: 'Validation',
      description: 'Testing and deployment',
      color: 'green',
      items: [
        { id: 'validation-agent', name: 'Validation Agent', type: 'agent' },
        { id: 'deployment-agent', name: 'Deployment Agent', type: 'agent' },
        { id: 'test-results', name: 'Test Results', type: 'artifact' },
        { id: 'deployment-gate', name: 'Deployment Gate', type: 'gate' },
      ],
    },
  ];

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<BlueprintMap clusters={defaultClusters} />);
      expect(screen.getByTestId('blueprint-map')).toBeInTheDocument();
    });

    it('renders all clusters', () => {
      render(<BlueprintMap clusters={defaultClusters} />);
      expect(screen.getByTestId('cluster-discovery')).toBeInTheDocument();
      expect(screen.getByTestId('cluster-design')).toBeInTheDocument();
      expect(screen.getByTestId('cluster-development')).toBeInTheDocument();
      expect(screen.getByTestId('cluster-validation')).toBeInTheDocument();
    });

    it('renders cluster names', () => {
      render(<BlueprintMap clusters={defaultClusters} />);
      expect(screen.getByText('Discovery')).toBeInTheDocument();
      expect(screen.getByText('Design')).toBeInTheDocument();
      expect(screen.getByText('Development')).toBeInTheDocument();
      expect(screen.getByText('Validation')).toBeInTheDocument();
    });

    it('renders cluster descriptions', () => {
      render(<BlueprintMap clusters={defaultClusters} />);
      expect(screen.getByText('Requirements gathering and acceptance criteria')).toBeInTheDocument();
      expect(screen.getByText('Architecture and technical design')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<BlueprintMap clusters={defaultClusters} className="my-custom-class" />);
      expect(screen.getByTestId('blueprint-map')).toHaveClass('my-custom-class');
    });
  });

  describe('Cluster Expansion', () => {
    it('clusters are collapsed by default', () => {
      render(<BlueprintMap clusters={defaultClusters} />);
      expect(screen.queryByTestId('cluster-items-discovery')).not.toBeInTheDocument();
    });

    it('expands cluster on click', () => {
      render(<BlueprintMap clusters={defaultClusters} />);
      fireEvent.click(screen.getByTestId('cluster-discovery'));
      expect(screen.getByTestId('cluster-items-discovery')).toBeInTheDocument();
    });

    it('collapses cluster on second click', () => {
      render(<BlueprintMap clusters={defaultClusters} />);
      fireEvent.click(screen.getByTestId('cluster-discovery'));
      expect(screen.getByTestId('cluster-items-discovery')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('cluster-discovery'));
      expect(screen.queryByTestId('cluster-items-discovery')).not.toBeInTheDocument();
    });

    it('shows cluster items when expanded', () => {
      render(<BlueprintMap clusters={defaultClusters} />);
      fireEvent.click(screen.getByTestId('cluster-discovery'));

      expect(screen.getByText('PRD Agent')).toBeInTheDocument();
      expect(screen.getByText('Acceptance Agent')).toBeInTheDocument();
      expect(screen.getByText('PRD Document')).toBeInTheDocument();
      expect(screen.getByText('Requirements Gate')).toBeInTheDocument();
    });

    it('allows multiple clusters to be expanded', () => {
      render(<BlueprintMap clusters={defaultClusters} />);
      fireEvent.click(screen.getByTestId('cluster-discovery'));
      fireEvent.click(screen.getByTestId('cluster-design'));

      expect(screen.getByTestId('cluster-items-discovery')).toBeInTheDocument();
      expect(screen.getByTestId('cluster-items-design')).toBeInTheDocument();
    });

    it('shows expand icon when collapsed', () => {
      render(<BlueprintMap clusters={defaultClusters} />);
      const cluster = screen.getByTestId('cluster-discovery');
      expect(cluster.querySelector('[data-testid="expand-icon"]')).toBeInTheDocument();
    });

    it('shows collapse icon when expanded', () => {
      render(<BlueprintMap clusters={defaultClusters} />);
      fireEvent.click(screen.getByTestId('cluster-discovery'));
      const cluster = screen.getByTestId('cluster-discovery');
      expect(cluster.querySelector('[data-testid="collapse-icon"]')).toBeInTheDocument();
    });
  });

  describe('Item Types', () => {
    it('displays agent items with agent icon', () => {
      render(<BlueprintMap clusters={defaultClusters} />);
      fireEvent.click(screen.getByTestId('cluster-discovery'));

      const agentItem = screen.getByTestId('item-prd-agent');
      expect(agentItem.querySelector('[data-testid="agent-icon"]')).toBeInTheDocument();
    });

    it('displays artifact items with artifact icon', () => {
      render(<BlueprintMap clusters={defaultClusters} />);
      fireEvent.click(screen.getByTestId('cluster-discovery'));

      const artifactItem = screen.getByTestId('item-prd-artifact');
      expect(artifactItem.querySelector('[data-testid="artifact-icon"]')).toBeInTheDocument();
    });

    it('displays gate items with gate icon', () => {
      render(<BlueprintMap clusters={defaultClusters} />);
      fireEvent.click(screen.getByTestId('cluster-discovery'));

      const gateItem = screen.getByTestId('item-requirements-gate');
      expect(gateItem.querySelector('[data-testid="gate-icon"]')).toBeInTheDocument();
    });

    it('groups items by type', () => {
      render(<BlueprintMap clusters={defaultClusters} />);
      fireEvent.click(screen.getByTestId('cluster-discovery'));

      expect(screen.getByTestId('group-agents')).toBeInTheDocument();
      expect(screen.getByTestId('group-artifacts')).toBeInTheDocument();
      expect(screen.getByTestId('group-gates')).toBeInTheDocument();
    });
  });

  describe('Navigation Links', () => {
    it('calls onItemClick when item is clicked', () => {
      const onItemClick = vi.fn();
      render(<BlueprintMap clusters={defaultClusters} onItemClick={onItemClick} />);

      fireEvent.click(screen.getByTestId('cluster-discovery'));
      fireEvent.click(screen.getByTestId('item-prd-agent'));

      expect(onItemClick).toHaveBeenCalledWith('prd-agent', 'agent');
    });

    it('calls onClusterClick when cluster is clicked', () => {
      const onClusterClick = vi.fn();
      render(<BlueprintMap clusters={defaultClusters} onClusterClick={onClusterClick} />);

      fireEvent.click(screen.getByTestId('cluster-discovery'));

      expect(onClusterClick).toHaveBeenCalledWith('discovery');
    });

    it('items have navigation links', () => {
      render(<BlueprintMap clusters={defaultClusters} />);
      fireEvent.click(screen.getByTestId('cluster-discovery'));

      const item = screen.getByTestId('item-prd-agent');
      expect(item.tagName).toBe('BUTTON');
    });
  });

  describe('Cluster Colors', () => {
    it('applies teal color to discovery cluster', () => {
      render(<BlueprintMap clusters={defaultClusters} />);
      const cluster = screen.getByTestId('cluster-discovery');
      expect(cluster).toHaveClass('border-accent-teal');
    });

    it('applies purple color to design cluster', () => {
      render(<BlueprintMap clusters={defaultClusters} />);
      const cluster = screen.getByTestId('cluster-design');
      expect(cluster).toHaveClass('border-accent-purple');
    });

    it('applies blue color to development cluster', () => {
      render(<BlueprintMap clusters={defaultClusters} />);
      const cluster = screen.getByTestId('cluster-development');
      expect(cluster).toHaveClass('border-accent-blue');
    });

    it('applies green color to validation cluster', () => {
      render(<BlueprintMap clusters={defaultClusters} />);
      const cluster = screen.getByTestId('cluster-validation');
      expect(cluster).toHaveClass('border-status-success');
    });
  });

  describe('Responsive Layout', () => {
    it('renders in grid layout', () => {
      render(<BlueprintMap clusters={defaultClusters} />);
      expect(screen.getByTestId('blueprint-map')).toHaveClass('grid');
    });

    it('applies responsive grid classes', () => {
      render(<BlueprintMap clusters={defaultClusters} />);
      const map = screen.getByTestId('blueprint-map');
      expect(map).toHaveClass('md:grid-cols-2');
      expect(map).toHaveClass('lg:grid-cols-4');
    });
  });

  describe('Cluster Flow', () => {
    it('shows flow arrows between clusters', () => {
      render(<BlueprintMap clusters={defaultClusters} showFlow />);
      expect(screen.getAllByTestId('flow-arrow').length).toBeGreaterThan(0);
    });

    it('hides flow arrows when showFlow is false', () => {
      render(<BlueprintMap clusters={defaultClusters} showFlow={false} />);
      expect(screen.queryByTestId('flow-arrow')).not.toBeInTheDocument();
    });
  });

  describe('Item Count', () => {
    it('displays item count on collapsed cluster', () => {
      render(<BlueprintMap clusters={defaultClusters} />);
      // Discovery has 4 items
      expect(screen.getByTestId('cluster-discovery')).toHaveTextContent('4 items');
    });

    it('displays correct count per type', () => {
      render(<BlueprintMap clusters={defaultClusters} />);
      // Discovery: 2 agents, 1 artifact, 1 gate
      expect(screen.getByTestId('cluster-discovery')).toHaveTextContent('2 agents');
      expect(screen.getByTestId('cluster-discovery')).toHaveTextContent('1 artifact');
      expect(screen.getByTestId('cluster-discovery')).toHaveTextContent('1 gate');
    });
  });

  describe('Keyboard Navigation', () => {
    it('clusters are focusable', () => {
      render(<BlueprintMap clusters={defaultClusters} />);
      const cluster = screen.getByTestId('cluster-discovery');
      expect(cluster).toHaveAttribute('tabIndex', '0');
    });

    it('expands cluster on Enter key', () => {
      render(<BlueprintMap clusters={defaultClusters} />);
      const cluster = screen.getByTestId('cluster-discovery');

      fireEvent.keyDown(cluster, { key: 'Enter' });

      expect(screen.getByTestId('cluster-items-discovery')).toBeInTheDocument();
    });

    it('expands cluster on Space key', () => {
      render(<BlueprintMap clusters={defaultClusters} />);
      const cluster = screen.getByTestId('cluster-discovery');

      fireEvent.keyDown(cluster, { key: ' ' });

      expect(screen.getByTestId('cluster-items-discovery')).toBeInTheDocument();
    });

    it('items are focusable', () => {
      render(<BlueprintMap clusters={defaultClusters} />);
      fireEvent.click(screen.getByTestId('cluster-discovery'));

      const item = screen.getByTestId('item-prd-agent');
      expect(item).toHaveAttribute('tabIndex', '0');
    });
  });

  describe('Empty State', () => {
    it('renders empty state when no clusters', () => {
      render(<BlueprintMap clusters={[]} />);
      expect(screen.getByText(/no clusters/i)).toBeInTheDocument();
    });

    it('renders cluster with empty items', () => {
      const emptyCluster: Cluster[] = [
        {
          id: 'empty',
          name: 'Empty Cluster',
          description: 'No items yet',
          color: 'gray',
          items: [],
        },
      ];
      render(<BlueprintMap clusters={emptyCluster} />);
      expect(screen.getByTestId('cluster-empty')).toBeInTheDocument();
      expect(screen.getByText('0 items')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has aria-expanded on clusters', () => {
      render(<BlueprintMap clusters={defaultClusters} />);
      const cluster = screen.getByTestId('cluster-discovery');
      expect(cluster).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(cluster);
      expect(cluster).toHaveAttribute('aria-expanded', 'true');
    });

    it('has aria-label on clusters', () => {
      render(<BlueprintMap clusters={defaultClusters} />);
      const cluster = screen.getByTestId('cluster-discovery');
      expect(cluster).toHaveAttribute('aria-label', 'Discovery cluster');
    });

    it('has role attribute on items list', () => {
      render(<BlueprintMap clusters={defaultClusters} />);
      fireEvent.click(screen.getByTestId('cluster-discovery'));

      const itemsList = screen.getByTestId('cluster-items-discovery');
      expect(itemsList).toHaveAttribute('role', 'list');
    });
  });
});
