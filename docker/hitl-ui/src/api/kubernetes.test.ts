/**
 * Tests for Kubernetes API client functions (P06-F07)
 *
 * Tests API functions, mock data fallback, and query keys.
 * React Query hooks are tested implicitly through component tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  k8sQueryKeys,
  getClusterHealth,
  getNodes,
  getPods,
  getPodsWithTotal,
  isCommandAllowed,
  getCommandValidationError,
} from './kubernetes';
import type { K8sPodsQueryParams } from './types/kubernetes';

// Mock the apiClient
vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// Mock import.meta.env
const originalEnv = import.meta.env;

describe('kubernetes API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment to use mocks
    vi.stubEnv('VITE_USE_MOCKS', 'true');
    vi.stubEnv('DEV', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('k8sQueryKeys', () => {
    it('has all() key for bulk invalidation', () => {
      expect(k8sQueryKeys.all()).toEqual(['k8s']);
    });

    it('has clusterHealth() key', () => {
      expect(k8sQueryKeys.clusterHealth()).toEqual(['k8s', 'health']);
    });

    it('has namespaces() key', () => {
      expect(k8sQueryKeys.namespaces()).toEqual(['k8s', 'namespaces']);
    });

    it('has nodes() key', () => {
      expect(k8sQueryKeys.nodes()).toEqual(['k8s', 'nodes']);
    });

    it('has node(name) key', () => {
      expect(k8sQueryKeys.node('node-1')).toEqual(['k8s', 'nodes', 'node-1']);
    });

    it('has pods(params) key with undefined params', () => {
      expect(k8sQueryKeys.pods()).toEqual(['k8s', 'pods', undefined]);
    });

    it('has pods(params) key with params', () => {
      const params: K8sPodsQueryParams = { namespace: 'dox-asdlc', status: 'Running' };
      expect(k8sQueryKeys.pods(params)).toEqual(['k8s', 'pods', params]);
    });

    it('has pod(namespace, name) key', () => {
      expect(k8sQueryKeys.pod('dox-asdlc', 'my-pod')).toEqual([
        'k8s',
        'pods',
        'dox-asdlc',
        'my-pod',
      ]);
    });

    it('has podLogs(namespace, name, container) key', () => {
      expect(k8sQueryKeys.podLogs('dox-asdlc', 'my-pod', 'main')).toEqual([
        'k8s',
        'pods',
        'dox-asdlc',
        'my-pod',
        'logs',
        'main',
      ]);
    });

    it('has services(namespace) key', () => {
      expect(k8sQueryKeys.services('dox-asdlc')).toEqual([
        'k8s',
        'services',
        { namespace: 'dox-asdlc' },
      ]);
    });

    it('has ingresses(namespace) key', () => {
      expect(k8sQueryKeys.ingresses('dox-asdlc')).toEqual([
        'k8s',
        'ingresses',
        { namespace: 'dox-asdlc' },
      ]);
    });

    it('has metricsHistory(interval) key', () => {
      expect(k8sQueryKeys.metricsHistory('5m')).toEqual(['k8s', 'metrics', 'history', '5m']);
    });

    it('has healthChecks() key', () => {
      expect(k8sQueryKeys.healthChecks()).toEqual(['k8s', 'health-checks']);
    });
  });

  describe('getClusterHealth', () => {
    it('returns mock data in development mode', async () => {
      const health = await getClusterHealth();

      expect(health).toBeDefined();
      expect(health.status).toBe('healthy');
      expect(health.nodesReady).toBeDefined();
      expect(health.nodesTotal).toBeDefined();
      expect(health.podsRunning).toBeDefined();
      expect(health.podsTotal).toBeDefined();
      expect(health.cpuUsagePercent).toBeDefined();
      expect(health.memoryUsagePercent).toBeDefined();
      expect(health.lastUpdated).toBeDefined();
    });

    it('returns fresh lastUpdated timestamp', async () => {
      const before = new Date().toISOString();
      const health = await getClusterHealth();
      const after = new Date().toISOString();

      expect(health.lastUpdated >= before).toBe(true);
      expect(health.lastUpdated <= after).toBe(true);
    });
  });

  describe('getNodes', () => {
    it('returns mock nodes in development mode', async () => {
      const nodes = await getNodes();

      expect(Array.isArray(nodes)).toBe(true);
      expect(nodes.length).toBeGreaterThan(0);

      const node = nodes[0];
      expect(node.name).toBeDefined();
      expect(node.status).toBeDefined();
      expect(node.roles).toBeDefined();
      expect(node.version).toBeDefined();
      expect(node.capacity).toBeDefined();
      expect(node.usage).toBeDefined();
    });

    it('includes Ready and NotReady nodes', async () => {
      const nodes = await getNodes();

      const readyNodes = nodes.filter((n) => n.status === 'Ready');
      const notReadyNodes = nodes.filter((n) => n.status === 'NotReady');

      expect(readyNodes.length).toBeGreaterThan(0);
      expect(notReadyNodes.length).toBeGreaterThan(0);
    });
  });

  describe('getPods', () => {
    it('returns mock pods in development mode', async () => {
      const pods = await getPods();

      expect(Array.isArray(pods)).toBe(true);
      expect(pods.length).toBeGreaterThan(0);

      const pod = pods[0];
      expect(pod.name).toBeDefined();
      expect(pod.namespace).toBeDefined();
      expect(pod.status).toBeDefined();
      expect(pod.nodeName).toBeDefined();
      expect(pod.containers).toBeDefined();
    });

    it('filters by namespace', async () => {
      const pods = await getPods({ namespace: 'dox-asdlc' });

      expect(pods.every((p) => p.namespace === 'dox-asdlc')).toBe(true);
    });

    it('filters by status', async () => {
      const pods = await getPods({ status: 'Running' });

      expect(pods.every((p) => p.status === 'Running')).toBe(true);
    });

    it('filters by nodeName', async () => {
      const pods = await getPods({ nodeName: 'node-1' });

      expect(pods.every((p) => p.nodeName === 'node-1' || p.nodeName === '')).toBe(true);
    });

    it('filters by search term', async () => {
      const pods = await getPods({ search: 'orchestrator' });

      expect(pods.every((p) => p.name.toLowerCase().includes('orchestrator'))).toBe(true);
    });

    it('applies pagination with limit', async () => {
      const pods = await getPods({ limit: 3 });

      expect(pods.length).toBeLessThanOrEqual(3);
    });

    it('applies pagination with offset', async () => {
      const allPods = await getPods();
      const offsetPods = await getPods({ offset: 2 });

      // With offset, we should get pods starting from index 2
      if (allPods.length > 2) {
        expect(offsetPods[0].name).toBe(allPods[2].name);
      }
    });

    it('combines multiple filters', async () => {
      const pods = await getPods({
        namespace: 'dox-asdlc',
        status: 'Running',
        limit: 5,
      });

      expect(pods.length).toBeLessThanOrEqual(5);
      expect(pods.every((p) => p.namespace === 'dox-asdlc' && p.status === 'Running')).toBe(true);
    });
  });

  describe('getPodsWithTotal', () => {
    it('returns pods and total count', async () => {
      const result = await getPodsWithTotal();

      expect(result.pods).toBeDefined();
      expect(Array.isArray(result.pods)).toBe(true);
      expect(typeof result.total).toBe('number');
      expect(result.total).toBeGreaterThanOrEqual(result.pods.length);
    });

    it('returns correct total with filters', async () => {
      const result = await getPodsWithTotal({
        namespace: 'dox-asdlc',
        limit: 2,
      });

      // Total should be all matching pods, not just the limited ones
      expect(result.pods.length).toBeLessThanOrEqual(2);
      expect(result.total).toBeGreaterThanOrEqual(result.pods.length);
    });

    it('applies pagination correctly', async () => {
      const page1 = await getPodsWithTotal({ limit: 3, offset: 0 });
      const page2 = await getPodsWithTotal({ limit: 3, offset: 3 });

      // Total should be the same for both pages
      expect(page1.total).toBe(page2.total);

      // Pages should have different pods (if there are enough)
      if (page1.pods.length > 0 && page2.pods.length > 0) {
        expect(page1.pods[0].name).not.toBe(page2.pods[0].name);
      }
    });
  });

  describe('isCommandAllowed', () => {
    it('allows kubectl get commands', () => {
      expect(isCommandAllowed('kubectl get pods')).toBe(true);
      expect(isCommandAllowed('kubectl get nodes')).toBe(true);
      expect(isCommandAllowed('kubectl get services -n default')).toBe(true);
    });

    it('allows kubectl describe commands', () => {
      expect(isCommandAllowed('kubectl describe pod my-pod')).toBe(true);
      expect(isCommandAllowed('kubectl describe node node-1')).toBe(true);
    });

    it('allows kubectl logs commands', () => {
      expect(isCommandAllowed('kubectl logs my-pod')).toBe(true);
      expect(isCommandAllowed('kubectl logs my-pod -c container')).toBe(true);
    });

    it('allows kubectl top commands', () => {
      expect(isCommandAllowed('kubectl top pods')).toBe(true);
      expect(isCommandAllowed('kubectl top nodes')).toBe(true);
    });

    it('allows docker ps commands', () => {
      expect(isCommandAllowed('docker ps')).toBe(true);
      expect(isCommandAllowed('docker ps -a')).toBe(true);
    });

    it('allows docker logs commands', () => {
      expect(isCommandAllowed('docker logs my-container')).toBe(true);
    });

    it('allows docker stats commands', () => {
      expect(isCommandAllowed('docker stats')).toBe(true);
    });

    it('rejects kubectl delete commands', () => {
      expect(isCommandAllowed('kubectl delete pod my-pod')).toBe(false);
    });

    it('rejects kubectl apply commands', () => {
      expect(isCommandAllowed('kubectl apply -f manifest.yaml')).toBe(false);
    });

    it('rejects docker rm commands', () => {
      expect(isCommandAllowed('docker rm my-container')).toBe(false);
    });

    it('rejects arbitrary commands', () => {
      expect(isCommandAllowed('rm -rf /')).toBe(false);
      expect(isCommandAllowed('echo hello')).toBe(false);
    });

    it('is case insensitive', () => {
      expect(isCommandAllowed('KUBECTL GET PODS')).toBe(true);
      expect(isCommandAllowed('Docker PS')).toBe(true);
    });

    it('trims whitespace', () => {
      expect(isCommandAllowed('  kubectl get pods  ')).toBe(true);
    });
  });

  describe('getCommandValidationError', () => {
    it('returns error for empty command', () => {
      expect(getCommandValidationError('')).toBe('Please enter a command');
      expect(getCommandValidationError('   ')).toBe('Please enter a command');
    });

    it('returns error for disallowed commands', () => {
      const error = getCommandValidationError('kubectl delete pod my-pod');
      expect(error).toContain('Only read-only commands are allowed');
    });

    it('returns null for allowed commands', () => {
      expect(getCommandValidationError('kubectl get pods')).toBeNull();
      expect(getCommandValidationError('docker ps')).toBeNull();
    });
  });
});
