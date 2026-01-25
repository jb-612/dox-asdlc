/**
 * NetworkingPanel - Kubernetes Services and Ingresses display
 *
 * Displays:
 * - Services grouped by namespace (ClusterIP, NodePort, LoadBalancer)
 * - Ingress rules with hosts and paths
 * - Service-to-ingress visual connections
 * - Namespace filter
 * - Collapsible sections
 */

import { useState, useMemo } from 'react';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  GlobeAltIcon,
  ServerStackIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import type { K8sService, K8sIngress, ServiceType } from '../../api/types/kubernetes';

export interface NetworkingPanelProps {
  /** Services to display */
  services: K8sService[];
  /** Ingresses to display */
  ingresses: K8sIngress[];
  /** Loading state */
  isLoading?: boolean;
  /** Custom class name */
  className?: string;
}

// Service type badge colors
const serviceTypeColors: Record<ServiceType, string> = {
  ClusterIP: 'bg-accent-blue/10 text-accent-blue border-accent-blue/30',
  NodePort: 'bg-accent-purple/10 text-accent-purple border-accent-purple/30',
  LoadBalancer: 'bg-status-success/10 text-status-success border-status-success/30',
  ExternalName: 'bg-status-warning/10 text-status-warning border-status-warning/30',
};

// ============================================================================
// Service Card Component
// ============================================================================

interface ServiceCardProps {
  service: K8sService;
  linkedIngresses: K8sIngress[];
}

function ServiceCard({ service, linkedIngresses }: ServiceCardProps) {
  return (
    <div
      className="p-4 bg-bg-tertiary/50 rounded-lg border border-border-primary"
      data-testid={`service-${service.name}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <ServerStackIcon className="h-5 w-5 text-text-muted" />
          <div>
            <h4 className="font-medium text-text-primary" data-testid="service-name">
              {service.name}
            </h4>
            <p className="text-xs text-text-muted">
              {service.namespace}
            </p>
          </div>
        </div>
        <span
          className={clsx(
            'px-2 py-1 rounded-full text-xs font-medium border',
            serviceTypeColors[service.type]
          )}
          data-testid="service-type"
        >
          {service.type}
        </span>
      </div>

      {/* Ports */}
      <div className="mb-3">
        <p className="text-xs text-text-muted mb-1">Ports</p>
        <div className="flex flex-wrap gap-2" data-testid="service-ports">
          {service.ports.map((port, index) => (
            <span
              key={`${port.name || index}-${port.port}`}
              className="inline-flex items-center px-2 py-1 rounded bg-bg-secondary text-xs font-mono"
            >
              {port.name && (
                <span className="text-text-muted mr-1">{port.name}:</span>
              )}
              <span className="text-text-primary">{port.port}</span>
              {port.targetPort && (
                <span className="text-text-muted">:{port.targetPort}</span>
              )}
              <span className="text-text-muted ml-1">/{port.protocol}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Cluster IP */}
      {service.clusterIP && service.clusterIP !== 'None' && (
        <div className="mb-3">
          <p className="text-xs text-text-muted mb-1">Cluster IP</p>
          <span className="font-mono text-xs text-text-primary" data-testid="cluster-ip">
            {service.clusterIP}
          </span>
        </div>
      )}

      {/* External IPs / LoadBalancer */}
      {service.externalIPs && service.externalIPs.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-text-muted mb-1">External IP{service.externalIPs.length > 1 ? 's' : ''}</p>
          <span className="font-mono text-xs text-accent-blue" data-testid="external-ip">
            {service.externalIPs.join(', ')}
          </span>
        </div>
      )}

      {/* Selector */}
      {service.selector && Object.keys(service.selector).length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-text-muted mb-1">Selector</p>
          <div className="flex flex-wrap gap-1" data-testid="service-selector">
            {Object.entries(service.selector).map(([key, value]) => (
              <span
                key={key}
                className="inline-flex px-1.5 py-0.5 rounded bg-bg-secondary text-xs"
              >
                <span className="text-text-muted">{key}=</span>
                <span className="text-text-primary">{value}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Linked Ingresses */}
      {linkedIngresses.length > 0 && (
        <div className="pt-3 border-t border-border-primary">
          <p className="text-xs text-text-muted mb-2 flex items-center gap-1">
            <GlobeAltIcon className="h-3 w-3" />
            Linked Ingresses
          </p>
          <div className="space-y-1" data-testid="linked-ingresses">
            {linkedIngresses.map((ingress) => (
              <div
                key={ingress.name}
                className="text-xs flex items-center gap-2"
              >
                <span className="text-accent-blue">{ingress.name}</span>
                {ingress.hosts.slice(0, 2).map((host, i) => (
                  <span key={i} className="text-text-muted">
                    {host}
                  </span>
                ))}
                {ingress.hosts.length > 2 && (
                  <span className="text-text-muted">
                    +{ingress.hosts.length - 2} more
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Ingress Card Component
// ============================================================================

interface IngressCardProps {
  ingress: K8sIngress;
}

function IngressCard({ ingress }: IngressCardProps) {
  // Group paths by host for display
  const pathsByHost = useMemo(() => {
    const groups: Record<string, typeof ingress.paths> = {};
    ingress.paths.forEach((path) => {
      const host = path.host || '*';
      if (!groups[host]) {
        groups[host] = [];
      }
      groups[host].push(path);
    });
    return groups;
  }, [ingress.paths]);

  const hosts = Object.keys(pathsByHost);

  return (
    <div
      className="p-4 bg-bg-tertiary/50 rounded-lg border border-border-primary"
      data-testid={`ingress-${ingress.name}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <GlobeAltIcon className="h-5 w-5 text-text-muted" />
          <div>
            <h4 className="font-medium text-text-primary" data-testid="ingress-name">
              {ingress.name}
            </h4>
            <p className="text-xs text-text-muted">
              {ingress.namespace}
            </p>
          </div>
        </div>
      </div>

      {/* Hosts */}
      {ingress.hosts.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-text-muted mb-1">Hosts</p>
          <div className="flex flex-wrap gap-1">
            {ingress.hosts.map((host, i) => (
              <span
                key={i}
                className="font-mono text-sm text-accent-blue"
                data-testid="ingress-host"
              >
                {host}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Paths grouped by host */}
      <div className="space-y-2" data-testid="ingress-rules">
        {hosts.map((host, hostIndex) => (
          <div
            key={`${host}-${hostIndex}`}
            className="p-2 rounded bg-bg-secondary"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-sm text-accent-blue">
                {host}
              </span>
            </div>
            <div className="space-y-1 pl-2 border-l-2 border-border-primary">
              {pathsByHost[host].map((path, pathIndex) => (
                <div
                  key={`${path.path}-${pathIndex}`}
                  className="flex items-center gap-2 text-xs"
                  data-testid={`ingress-path-${pathIndex}`}
                >
                  <span className="font-mono text-text-primary">{path.path}</span>
                  <span className="text-text-muted">-&gt;</span>
                  <span className="text-accent-blue">
                    {path.serviceName}:{path.servicePort}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* TLS */}
      {ingress.tls && (
        <div className="mt-3 pt-3 border-t border-border-primary">
          <p className="text-xs text-text-muted mb-1">TLS Enabled</p>
          <div className="flex flex-wrap gap-1">
            {ingress.hosts.map((host, i) => (
              <span
                key={i}
                className="inline-flex items-center px-2 py-0.5 rounded bg-status-success/10 text-status-success text-xs"
              >
                {host}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Collapsible Namespace Section
// ============================================================================

interface NamespaceSectionProps {
  namespace: string;
  services: K8sService[];
  ingresses: K8sIngress[];
  defaultExpanded?: boolean;
}

function NamespaceSection({
  namespace,
  services,
  ingresses,
  defaultExpanded = true,
}: NamespaceSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Find linked ingresses for each service
  const getLinkedIngresses = (service: K8sService): K8sIngress[] => {
    return ingresses.filter((ingress) =>
      ingress.paths.some((path) => path.serviceName === service.name)
    );
  };

  return (
    <div className="border border-border-primary rounded-lg overflow-hidden" data-testid={`namespace-section-${namespace}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-bg-tertiary hover:bg-bg-tertiary/80 transition-colors"
        data-testid={`namespace-toggle-${namespace}`}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDownIcon className="h-4 w-4 text-text-muted" />
          ) : (
            <ChevronRightIcon className="h-4 w-4 text-text-muted" />
          )}
          <span className="font-medium text-text-primary">{namespace}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-text-muted">
          <span>{services.length} services</span>
          <span>{ingresses.length} ingresses</span>
        </div>
      </button>

      {isExpanded && (
        <div className="p-4 space-y-6">
          {/* Services */}
          {services.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-text-secondary mb-3 flex items-center gap-2">
                <ServerStackIcon className="h-4 w-4" />
                Services
              </h4>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3" data-testid="services-grid">
                {services.map((service) => (
                  <ServiceCard
                    key={service.name}
                    service={service}
                    linkedIngresses={getLinkedIngresses(service)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Ingresses */}
          {ingresses.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-text-secondary mb-3 flex items-center gap-2">
                <GlobeAltIcon className="h-4 w-4" />
                Ingresses
              </h4>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3" data-testid="ingresses-grid">
                {ingresses.map((ingress) => (
                  <IngressCard key={ingress.name} ingress={ingress} />
                ))}
              </div>
            </div>
          )}

          {/* Empty state for namespace */}
          {services.length === 0 && ingresses.length === 0 && (
            <p className="text-text-muted text-sm text-center py-4">
              No services or ingresses in this namespace
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main NetworkingPanel Component
// ============================================================================

export default function NetworkingPanel({
  services,
  ingresses,
  isLoading = false,
  className,
}: NetworkingPanelProps) {
  const [namespaceFilter, setNamespaceFilter] = useState<string>('all');

  // Get unique namespaces from both services and ingresses
  const namespaces = useMemo(() => {
    const serviceNs = services.map((s) => s.namespace);
    const ingressNs = ingresses.map((i) => i.namespace);
    const unique = [...new Set([...serviceNs, ...ingressNs])];
    return unique.sort();
  }, [services, ingresses]);

  // Filter by namespace
  const filteredServices = useMemo(() => {
    if (namespaceFilter === 'all') return services;
    return services.filter((s) => s.namespace === namespaceFilter);
  }, [services, namespaceFilter]);

  const filteredIngresses = useMemo(() => {
    if (namespaceFilter === 'all') return ingresses;
    return ingresses.filter((i) => i.namespace === namespaceFilter);
  }, [ingresses, namespaceFilter]);

  // Group by namespace
  const groupedByNamespace = useMemo(() => {
    const groups: Record<string, { services: K8sService[]; ingresses: K8sIngress[] }> = {};

    filteredServices.forEach((service) => {
      if (!groups[service.namespace]) {
        groups[service.namespace] = { services: [], ingresses: [] };
      }
      groups[service.namespace].services.push(service);
    });

    filteredIngresses.forEach((ingress) => {
      if (!groups[ingress.namespace]) {
        groups[ingress.namespace] = { services: [], ingresses: [] };
      }
      groups[ingress.namespace].ingresses.push(ingress);
    });

    return groups;
  }, [filteredServices, filteredIngresses]);

  const sortedNamespaces = Object.keys(groupedByNamespace).sort();

  // Loading state
  if (isLoading && services.length === 0 && ingresses.length === 0) {
    return (
      <div className={clsx('space-y-4', className)} data-testid="networking-panel-loading">
        <div className="h-10 w-48 bg-bg-tertiary rounded animate-pulse" />
        {[1, 2].map((i) => (
          <div key={i} className="h-48 bg-bg-tertiary rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  // Empty state
  if (services.length === 0 && ingresses.length === 0) {
    return (
      <div
        className={clsx('p-8 text-center bg-bg-tertiary/30 rounded-lg', className)}
        data-testid="networking-panel-empty"
      >
        <ServerStackIcon className="h-12 w-12 mx-auto mb-2 text-text-muted opacity-50" />
        <p className="text-text-muted">No services or ingresses found</p>
      </div>
    );
  }

  return (
    <div className={className} data-testid="networking-panel">
      {/* Namespace Filter */}
      <div className="flex items-center gap-2 mb-4" data-testid="namespace-filter-container">
        <FunnelIcon className="h-4 w-4 text-text-muted" />
        <select
          value={namespaceFilter}
          onChange={(e) => setNamespaceFilter(e.target.value)}
          className="bg-bg-tertiary rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue"
          data-testid="namespace-filter"
        >
          <option value="all">All Namespaces ({namespaces.length})</option>
          {namespaces.map((ns) => (
            <option key={ns} value={ns}>
              {ns}
            </option>
          ))}
        </select>
        <span className="text-xs text-text-muted ml-auto">
          {filteredServices.length} services, {filteredIngresses.length} ingresses
        </span>
      </div>

      {/* Namespace Sections */}
      <div className="space-y-4" data-testid="namespace-sections">
        {sortedNamespaces.length === 0 ? (
          <div className="p-4 text-center text-text-muted bg-bg-tertiary/30 rounded-lg">
            No resources match the selected filter
          </div>
        ) : (
          sortedNamespaces.map((namespace) => (
            <NamespaceSection
              key={namespace}
              namespace={namespace}
              services={groupedByNamespace[namespace].services}
              ingresses={groupedByNamespace[namespace].ingresses}
              defaultExpanded={sortedNamespaces.length <= 3}
            />
          ))
        )}
      </div>
    </div>
  );
}
