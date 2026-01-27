/**
 * Tests for ServiceTopologyMap component
 *
 * T14: Visual topology map showing 5 aSDLC services and their connections
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ServiceTopologyMap from './ServiceTopologyMap';
import type { ServiceHealthInfo, ServiceConnection } from '../../api/types/services';

describe('ServiceTopologyMap', () => {
  const mockServices: ServiceHealthInfo[] = [
    {
      name: 'hitl-ui',
      status: 'healthy',
      cpuPercent: 30,
      memoryPercent: 45,
      podCount: 1,
      requestRate: 50,
      latencyP50: 15,
    },
    {
      name: 'orchestrator',
      status: 'healthy',
      cpuPercent: 45,
      memoryPercent: 60,
      podCount: 2,
      requestRate: 150,
      latencyP50: 25,
    },
    {
      name: 'workers',
      status: 'degraded',
      cpuPercent: 75,
      memoryPercent: 70,
      podCount: 3,
      requestRate: 200,
      latencyP50: 50,
    },
    {
      name: 'redis',
      status: 'healthy',
      cpuPercent: 20,
      memoryPercent: 55,
      podCount: 1,
    },
    {
      name: 'elasticsearch',
      status: 'unhealthy',
      cpuPercent: 90,
      memoryPercent: 85,
      podCount: 1,
    },
  ];

  const mockConnections: ServiceConnection[] = [
    { from: 'hitl-ui', to: 'orchestrator', type: 'http' },
    { from: 'orchestrator', to: 'workers', type: 'http' },
    { from: 'orchestrator', to: 'redis', type: 'redis' },
    { from: 'workers', to: 'redis', type: 'redis' },
    { from: 'workers', to: 'elasticsearch', type: 'elasticsearch' },
    { from: 'orchestrator', to: 'elasticsearch', type: 'elasticsearch' },
  ];

  describe('Renders all 5 services', () => {
    it('renders the SVG container', () => {
      render(
        <ServiceTopologyMap
          services={mockServices}
          connections={mockConnections}
        />
      );
      expect(screen.getByTestId('topology-map')).toBeInTheDocument();
    });

    it('renders node for hitl-ui', () => {
      render(
        <ServiceTopologyMap
          services={mockServices}
          connections={mockConnections}
        />
      );
      expect(screen.getByTestId('service-node-hitl-ui')).toBeInTheDocument();
    });

    it('renders node for orchestrator', () => {
      render(
        <ServiceTopologyMap
          services={mockServices}
          connections={mockConnections}
        />
      );
      expect(screen.getByTestId('service-node-orchestrator')).toBeInTheDocument();
    });

    it('renders node for workers', () => {
      render(
        <ServiceTopologyMap
          services={mockServices}
          connections={mockConnections}
        />
      );
      expect(screen.getByTestId('service-node-workers')).toBeInTheDocument();
    });

    it('renders node for redis', () => {
      render(
        <ServiceTopologyMap
          services={mockServices}
          connections={mockConnections}
        />
      );
      expect(screen.getByTestId('service-node-redis')).toBeInTheDocument();
    });

    it('renders node for elasticsearch', () => {
      render(
        <ServiceTopologyMap
          services={mockServices}
          connections={mockConnections}
        />
      );
      expect(screen.getByTestId('service-node-elasticsearch')).toBeInTheDocument();
    });

    it('renders all 5 service labels', () => {
      render(
        <ServiceTopologyMap
          services={mockServices}
          connections={mockConnections}
        />
      );
      expect(screen.getByText('hitl-ui')).toBeInTheDocument();
      expect(screen.getByText('orchestrator')).toBeInTheDocument();
      expect(screen.getByText('workers')).toBeInTheDocument();
      expect(screen.getByText('redis')).toBeInTheDocument();
      expect(screen.getByText('elasticsearch')).toBeInTheDocument();
    });
  });

  describe('Renders connections', () => {
    it('renders connection lines', () => {
      render(
        <ServiceTopologyMap
          services={mockServices}
          connections={mockConnections}
        />
      );
      const connections = screen.getAllByTestId(/^connection-/);
      expect(connections.length).toBe(mockConnections.length);
    });

    it('renders connection from hitl-ui to orchestrator', () => {
      render(
        <ServiceTopologyMap
          services={mockServices}
          connections={mockConnections}
        />
      );
      expect(screen.getByTestId('connection-hitl-ui-orchestrator')).toBeInTheDocument();
    });

    it('renders connection from orchestrator to redis', () => {
      render(
        <ServiceTopologyMap
          services={mockServices}
          connections={mockConnections}
        />
      );
      expect(screen.getByTestId('connection-orchestrator-redis')).toBeInTheDocument();
    });

    it('applies correct color for HTTP connections (blue)', () => {
      render(
        <ServiceTopologyMap
          services={mockServices}
          connections={mockConnections}
        />
      );
      const httpConnection = screen.getByTestId('connection-hitl-ui-orchestrator');
      expect(httpConnection).toHaveAttribute('stroke', expect.stringMatching(/#3B82F6|blue/i));
    });

    it('applies correct color for Redis connections (red)', () => {
      render(
        <ServiceTopologyMap
          services={mockServices}
          connections={mockConnections}
        />
      );
      const redisConnection = screen.getByTestId('connection-orchestrator-redis');
      expect(redisConnection).toHaveAttribute('stroke', expect.stringMatching(/#EF4444|red/i));
    });

    it('applies correct color for Elasticsearch connections (yellow)', () => {
      render(
        <ServiceTopologyMap
          services={mockServices}
          connections={mockConnections}
        />
      );
      const esConnection = screen.getByTestId('connection-workers-elasticsearch');
      expect(esConnection).toHaveAttribute('stroke', expect.stringMatching(/#EAB308|#F59E0B|yellow/i));
    });
  });

  describe('Click handler fires with correct service', () => {
    it('calls onServiceClick when service node is clicked', () => {
      const onServiceClick = vi.fn();
      render(
        <ServiceTopologyMap
          services={mockServices}
          connections={mockConnections}
          onServiceClick={onServiceClick}
        />
      );

      fireEvent.click(screen.getByTestId('service-node-orchestrator'));

      expect(onServiceClick).toHaveBeenCalledTimes(1);
      expect(onServiceClick).toHaveBeenCalledWith('orchestrator');
    });

    it('passes correct service name for each node click', () => {
      const onServiceClick = vi.fn();
      render(
        <ServiceTopologyMap
          services={mockServices}
          connections={mockConnections}
          onServiceClick={onServiceClick}
        />
      );

      fireEvent.click(screen.getByTestId('service-node-redis'));
      expect(onServiceClick).toHaveBeenCalledWith('redis');

      fireEvent.click(screen.getByTestId('service-node-workers'));
      expect(onServiceClick).toHaveBeenCalledWith('workers');
    });

    it('nodes are interactive when onServiceClick provided', () => {
      const onServiceClick = vi.fn();
      render(
        <ServiceTopologyMap
          services={mockServices}
          connections={mockConnections}
          onServiceClick={onServiceClick}
        />
      );

      const node = screen.getByTestId('service-node-orchestrator');
      expect(node).toHaveClass('cursor-pointer');
    });
  });

  describe('Health colors applied correctly', () => {
    it('applies green fill for healthy services', () => {
      render(
        <ServiceTopologyMap
          services={mockServices}
          connections={mockConnections}
        />
      );
      const healthyNode = screen.getByTestId('service-node-hitl-ui');
      // The fill is on the rect child element
      const rect = healthyNode.querySelector('rect');
      expect(rect).toHaveAttribute('fill', expect.stringMatching(/#22C55E|#10B981|green/i));
    });

    it('applies yellow/orange fill for degraded services', () => {
      render(
        <ServiceTopologyMap
          services={mockServices}
          connections={mockConnections}
        />
      );
      const degradedNode = screen.getByTestId('service-node-workers');
      // The fill is on the rect child element
      const rect = degradedNode.querySelector('rect');
      expect(rect).toHaveAttribute('fill', expect.stringMatching(/#F59E0B|#EAB308|yellow|orange/i));
    });

    it('applies red fill for unhealthy services', () => {
      render(
        <ServiceTopologyMap
          services={mockServices}
          connections={mockConnections}
        />
      );
      const unhealthyNode = screen.getByTestId('service-node-elasticsearch');
      // The fill is on the rect child element
      const rect = unhealthyNode.querySelector('rect');
      expect(rect).toHaveAttribute('fill', expect.stringMatching(/#EF4444|#DC2626|red/i));
    });
  });

  describe('Hover effects', () => {
    it('shows hover effect on nodes', () => {
      const onServiceClick = vi.fn();
      render(
        <ServiceTopologyMap
          services={mockServices}
          connections={mockConnections}
          onServiceClick={onServiceClick}
        />
      );

      const node = screen.getByTestId('service-node-orchestrator');
      fireEvent.mouseEnter(node);

      // Node should have hover styling
      expect(node).toHaveClass('hover:opacity-80');
    });
  });

  describe('Responsive sizing', () => {
    it('uses viewBox for scalable SVG', () => {
      render(
        <ServiceTopologyMap
          services={mockServices}
          connections={mockConnections}
        />
      );
      const svg = screen.getByTestId('topology-map');
      expect(svg).toHaveAttribute('viewBox');
    });

    it('container is responsive', () => {
      render(
        <ServiceTopologyMap
          services={mockServices}
          connections={mockConnections}
          className="w-full"
        />
      );
      const container = screen.getByTestId('topology-container');
      expect(container).toHaveClass('w-full');
    });
  });

  describe('Loading state', () => {
    it('shows loading state when isLoading is true', () => {
      render(
        <ServiceTopologyMap
          services={[]}
          connections={[]}
          isLoading
        />
      );
      expect(screen.getByTestId('topology-loading')).toBeInTheDocument();
    });
  });

  describe('Empty state', () => {
    it('shows empty state when no services', () => {
      render(
        <ServiceTopologyMap
          services={[]}
          connections={[]}
        />
      );
      expect(screen.getByTestId('topology-empty')).toBeInTheDocument();
    });
  });

  describe('Legend', () => {
    it('displays connection type legend', () => {
      render(
        <ServiceTopologyMap
          services={mockServices}
          connections={mockConnections}
          showLegend
        />
      );
      const legend = screen.getByTestId('topology-legend');
      expect(legend).toBeInTheDocument();
      // Check within the legend element specifically to avoid conflicts with node labels
      expect(legend).toHaveTextContent(/HTTP/);
      expect(legend).toHaveTextContent(/Redis/);
      expect(legend).toHaveTextContent(/Elasticsearch/);
    });
  });

  describe('Accessibility', () => {
    it('SVG has role img', () => {
      render(
        <ServiceTopologyMap
          services={mockServices}
          connections={mockConnections}
        />
      );
      const svg = screen.getByTestId('topology-map');
      expect(svg).toHaveAttribute('role', 'img');
    });

    it('has aria-label for the diagram', () => {
      render(
        <ServiceTopologyMap
          services={mockServices}
          connections={mockConnections}
        />
      );
      const svg = screen.getByTestId('topology-map');
      expect(svg).toHaveAttribute('aria-label', expect.stringMatching(/service.*topology/i));
    });
  });

  describe('Custom className', () => {
    it('applies custom className to container', () => {
      render(
        <ServiceTopologyMap
          services={mockServices}
          connections={mockConnections}
          className="my-custom-class"
        />
      );
      const container = screen.getByTestId('topology-container');
      expect(container).toHaveClass('my-custom-class');
    });
  });
});
