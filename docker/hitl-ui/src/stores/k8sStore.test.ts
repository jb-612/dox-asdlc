/**
 * Tests for k8sStore Zustand store
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useK8sStore } from './k8sStore';
import type { K8sPod, K8sNode } from '../api/types/kubernetes';

describe('k8sStore', () => {
  // Reset store before each test
  beforeEach(() => {
    useK8sStore.getState().reset();
  });

  describe('Initial State', () => {
    it('has correct initial values', () => {
      const state = useK8sStore.getState();

      expect(state.selectedNamespace).toBeNull();
      expect(state.selectedPod).toBeNull();
      expect(state.selectedNode).toBeNull();
      expect(state.drawerOpen).toBe(false);
      expect(state.metricsInterval).toBe('5m');
      expect(state.terminalHistory).toEqual([]);
      expect(state.terminalInput).toBe('');
    });
  });

  describe('Namespace Selection', () => {
    it('sets selected namespace', () => {
      useK8sStore.getState().setSelectedNamespace('dox-asdlc');
      expect(useK8sStore.getState().selectedNamespace).toBe('dox-asdlc');
    });

    it('clears selected namespace when set to null', () => {
      useK8sStore.getState().setSelectedNamespace('dox-asdlc');
      useK8sStore.getState().setSelectedNamespace(null);
      expect(useK8sStore.getState().selectedNamespace).toBeNull();
    });
  });

  describe('Pod Selection', () => {
    const mockPod: K8sPod = {
      name: 'test-pod',
      namespace: 'default',
      status: 'Running',
      phase: 'Running',
      nodeName: 'node-1',
      podIP: '10.0.0.1',
      hostIP: '192.168.1.1',
      containers: [],
      restarts: 0,
      age: '1d',
      createdAt: '2026-01-01T00:00:00Z',
      labels: {},
      ownerKind: 'Deployment',
      ownerName: 'test-deployment',
    };

    it('sets selected pod and opens drawer', () => {
      useK8sStore.getState().setSelectedPod(mockPod);

      const state = useK8sStore.getState();
      expect(state.selectedPod).toEqual(mockPod);
      expect(state.drawerOpen).toBe(true);
    });

    it('clears selected pod when set to null', () => {
      useK8sStore.getState().setSelectedPod(mockPod);
      useK8sStore.getState().setSelectedPod(null);

      const state = useK8sStore.getState();
      expect(state.selectedPod).toBeNull();
      // Drawer remains open when pod is set to null directly
      expect(state.drawerOpen).toBe(false);
    });
  });

  describe('Node Selection', () => {
    const mockNode: K8sNode = {
      name: 'node-1',
      status: 'Ready',
      roles: ['worker'],
      version: 'v1.28.0',
      os: 'linux',
      containerRuntime: 'containerd',
      capacity: { cpu: '4', memory: '8Gi', pods: 110 },
      allocatable: { cpu: '4', memory: '8Gi', pods: 110 },
      usage: { cpuPercent: 50, memoryPercent: 60, podsCount: 10 },
      conditions: [],
      createdAt: '2026-01-01T00:00:00Z',
    };

    it('sets selected node', () => {
      useK8sStore.getState().setSelectedNode(mockNode);
      expect(useK8sStore.getState().selectedNode).toEqual(mockNode);
    });

    it('clears selected node when set to null', () => {
      useK8sStore.getState().setSelectedNode(mockNode);
      useK8sStore.getState().setSelectedNode(null);
      expect(useK8sStore.getState().selectedNode).toBeNull();
    });
  });

  describe('Drawer State', () => {
    it('opens drawer', () => {
      useK8sStore.getState().setDrawerOpen(true);
      expect(useK8sStore.getState().drawerOpen).toBe(true);
    });

    it('closes drawer and clears selected pod', () => {
      const mockPod: K8sPod = {
        name: 'test-pod',
        namespace: 'default',
        status: 'Running',
        phase: 'Running',
        nodeName: 'node-1',
        podIP: '10.0.0.1',
        hostIP: '192.168.1.1',
        containers: [],
        restarts: 0,
        age: '1d',
        createdAt: '2026-01-01T00:00:00Z',
        labels: {},
        ownerKind: 'Deployment',
        ownerName: 'test-deployment',
      };

      useK8sStore.getState().setSelectedPod(mockPod);
      useK8sStore.getState().setDrawerOpen(false);

      const state = useK8sStore.getState();
      expect(state.drawerOpen).toBe(false);
      expect(state.selectedPod).toBeNull();
    });
  });

  describe('Metrics Interval', () => {
    it('sets metrics interval', () => {
      useK8sStore.getState().setMetricsInterval('15m');
      expect(useK8sStore.getState().metricsInterval).toBe('15m');
    });

    it('allows all valid intervals', () => {
      const intervals = ['1m', '5m', '15m', '1h'] as const;

      for (const interval of intervals) {
        useK8sStore.getState().setMetricsInterval(interval);
        expect(useK8sStore.getState().metricsInterval).toBe(interval);
      }
    });
  });

  describe('Terminal Commands', () => {
    it('adds command to history', () => {
      useK8sStore.getState().addTerminalCommand(
        'kubectl get pods',
        'NAME\ntest-pod',
        true,
        150
      );

      const history = useK8sStore.getState().terminalHistory;
      expect(history).toHaveLength(1);
      expect(history[0].command).toBe('kubectl get pods');
      expect(history[0].output).toBe('NAME\ntest-pod');
      expect(history[0].success).toBe(true);
      expect(history[0].duration).toBe(150);
    });

    it('clears terminal input after adding command', () => {
      useK8sStore.getState().setTerminalInput('kubectl get pods');
      useK8sStore.getState().addTerminalCommand(
        'kubectl get pods',
        'output',
        true,
        100
      );

      expect(useK8sStore.getState().terminalInput).toBe('');
    });

    it('limits history to 100 entries', () => {
      // Add 105 commands
      for (let i = 0; i < 105; i++) {
        useK8sStore.getState().addTerminalCommand(
          `command-${i}`,
          `output-${i}`,
          true,
          100
        );
      }

      const history = useK8sStore.getState().terminalHistory;
      expect(history).toHaveLength(100);
      // First command should be command-5 (oldest retained)
      expect(history[0].command).toBe('command-5');
      // Last command should be command-104 (newest)
      expect(history[99].command).toBe('command-104');
    });

    it('generates unique IDs for entries', () => {
      useK8sStore.getState().addTerminalCommand('cmd1', 'out1', true, 100);
      useK8sStore.getState().addTerminalCommand('cmd2', 'out2', true, 100);

      const history = useK8sStore.getState().terminalHistory;
      expect(history[0].id).not.toBe(history[1].id);
    });
  });

  describe('Terminal Input', () => {
    it('sets terminal input', () => {
      useK8sStore.getState().setTerminalInput('kubectl get');
      expect(useK8sStore.getState().terminalInput).toBe('kubectl get');
    });

    it('clears terminal input', () => {
      useK8sStore.getState().setTerminalInput('kubectl get');
      useK8sStore.getState().setTerminalInput('');
      expect(useK8sStore.getState().terminalInput).toBe('');
    });
  });

  describe('Clear Terminal', () => {
    it('clears history and input', () => {
      useK8sStore.getState().setTerminalInput('kubectl get pods');
      useK8sStore.getState().addTerminalCommand('cmd1', 'out1', true, 100);
      useK8sStore.getState().addTerminalCommand('cmd2', 'out2', true, 100);

      useK8sStore.getState().clearTerminal();

      const state = useK8sStore.getState();
      expect(state.terminalHistory).toEqual([]);
      expect(state.terminalInput).toBe('');
    });
  });

  describe('Get Command History', () => {
    it('returns array of command strings', () => {
      useK8sStore.getState().addTerminalCommand('cmd1', 'out1', true, 100);
      useK8sStore.getState().addTerminalCommand('cmd2', 'out2', true, 100);
      useK8sStore.getState().addTerminalCommand('cmd3', 'out3', true, 100);

      const commands = useK8sStore.getState().getCommandHistory();
      expect(commands).toEqual(['cmd1', 'cmd2', 'cmd3']);
    });

    it('returns empty array when no history', () => {
      const commands = useK8sStore.getState().getCommandHistory();
      expect(commands).toEqual([]);
    });
  });

  describe('Reset', () => {
    it('resets all state to initial values', () => {
      // Set various state
      useK8sStore.getState().setSelectedNamespace('dox-asdlc');
      useK8sStore.getState().setMetricsInterval('1h');
      useK8sStore.getState().setTerminalInput('kubectl');
      useK8sStore.getState().addTerminalCommand('cmd', 'out', true, 100);

      // Reset
      useK8sStore.getState().reset();

      // Verify initial state
      const state = useK8sStore.getState();
      expect(state.selectedNamespace).toBeNull();
      expect(state.selectedPod).toBeNull();
      expect(state.selectedNode).toBeNull();
      expect(state.drawerOpen).toBe(false);
      expect(state.metricsInterval).toBe('5m');
      expect(state.terminalHistory).toEqual([]);
      expect(state.terminalInput).toBe('');
    });
  });
});
