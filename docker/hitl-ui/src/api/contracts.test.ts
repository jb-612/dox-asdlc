/**
 * Tests for API contract validation
 *
 * Validates that API responses match the expected contract schemas.
 */

import { describe, it, expect } from 'vitest';
import {
  GateSchema,
  GateListSchema,
  GateDecisionSchema,
  RunSchema,
  RunListSchema,
  RunKPIsSchema,
  ArtifactSchema,
  ArtifactListSchema,
  SessionSchema,
  EventSchema,
  EvidenceSchema,
  validateGate,
  validateGateList,
  validateRun,
  validateRunList,
  validateArtifact,
  validateArtifactList,
  validateSession,
  validateEvent,
} from './contracts';

describe('API Contract Validation', () => {
  describe('Gate Schemas', () => {
    it('validates a valid gate object', () => {
      const validGate = {
        id: 'gate-1',
        gate_type: 'approval',
        status: 'pending',
        title: 'Review PRD',
        description: 'Please review the product requirements document',
        created_at: '2026-01-23T10:00:00Z',
        priority: 'high',
        tenant: 'default',
      };

      expect(() => GateSchema.parse(validGate)).not.toThrow();
      expect(validateGate(validGate)).toEqual(validGate);
    });

    it('validates gate with optional fields', () => {
      const gateWithOptional = {
        id: 'gate-2',
        gate_type: 'review',
        status: 'approved',
        title: 'Code Review',
        description: 'Review the code changes',
        created_at: '2026-01-23T10:00:00Z',
        priority: 'medium',
        tenant: 'default',
        resolved_at: '2026-01-23T11:00:00Z',
        resolved_by: 'user-1',
        decision: 'approved',
        evidence: [],
      };

      expect(() => GateSchema.parse(gateWithOptional)).not.toThrow();
    });

    it('rejects invalid gate type', () => {
      const invalidGate = {
        id: 'gate-1',
        gate_type: 'invalid_type',
        status: 'pending',
        title: 'Test',
        description: 'Test',
        created_at: '2026-01-23T10:00:00Z',
        priority: 'high',
        tenant: 'default',
      };

      expect(() => GateSchema.parse(invalidGate)).toThrow();
    });

    it('rejects invalid status', () => {
      const invalidGate = {
        id: 'gate-1',
        gate_type: 'approval',
        status: 'invalid_status',
        title: 'Test',
        description: 'Test',
        created_at: '2026-01-23T10:00:00Z',
        priority: 'high',
        tenant: 'default',
      };

      expect(() => GateSchema.parse(invalidGate)).toThrow();
    });

    it('validates gate list', () => {
      const gateList = {
        items: [
          {
            id: 'gate-1',
            gate_type: 'approval',
            status: 'pending',
            title: 'Test',
            description: 'Test',
            created_at: '2026-01-23T10:00:00Z',
            priority: 'high',
            tenant: 'default',
          },
        ],
        total: 1,
        page: 1,
        page_size: 10,
      };

      expect(() => GateListSchema.parse(gateList)).not.toThrow();
      expect(validateGateList(gateList)).toEqual(gateList);
    });

    it('validates gate decision', () => {
      const decision = {
        gate_id: 'gate-1',
        decision: 'approved',
        comment: 'Looks good',
        feedback: {
          tags: ['quality'],
          severity: 'low',
          summary: 'Minor improvements needed',
        },
      };

      expect(() => GateDecisionSchema.parse(decision)).not.toThrow();
    });
  });

  describe('Run Schemas', () => {
    it('validates a valid run object', () => {
      const validRun = {
        id: 'run-1',
        name: 'Discovery Run',
        status: 'running',
        started_at: '2026-01-23T10:00:00Z',
        agent_type: 'discovery',
      };

      expect(() => RunSchema.parse(validRun)).not.toThrow();
      expect(validateRun(validRun)).toEqual(validRun);
    });

    it('validates run with optional fields', () => {
      const runWithOptional = {
        id: 'run-2',
        name: 'Completed Run',
        status: 'completed',
        started_at: '2026-01-23T10:00:00Z',
        completed_at: '2026-01-23T11:00:00Z',
        agent_type: 'coding',
        duration_seconds: 3600,
        tokens_used: 5000,
        cost: 0.50,
        error: null,
      };

      expect(() => RunSchema.parse(runWithOptional)).not.toThrow();
    });

    it('rejects invalid run status', () => {
      const invalidRun = {
        id: 'run-1',
        name: 'Test',
        status: 'invalid_status',
        started_at: '2026-01-23T10:00:00Z',
        agent_type: 'discovery',
      };

      expect(() => RunSchema.parse(invalidRun)).toThrow();
    });

    it('validates run list', () => {
      const runList = {
        items: [
          {
            id: 'run-1',
            name: 'Test Run',
            status: 'running',
            started_at: '2026-01-23T10:00:00Z',
            agent_type: 'discovery',
          },
        ],
        total: 1,
        page: 1,
        page_size: 10,
      };

      expect(() => RunListSchema.parse(runList)).not.toThrow();
      expect(validateRunList(runList)).toEqual(runList);
    });

    it('validates run KPIs', () => {
      const kpis = {
        total_runs: 100,
        successful_runs: 80,
        failed_runs: 10,
        pending_runs: 10,
        average_duration_seconds: 3600,
        success_rate: 80.0,
      };

      expect(() => RunKPIsSchema.parse(kpis)).not.toThrow();
    });
  });

  describe('Artifact Schemas', () => {
    it('validates a valid artifact object', () => {
      const validArtifact = {
        id: 'art-1',
        artifact_type: 'prd',
        name: 'Product Requirements',
        path: '/docs/prd.md',
        updated_at: '2026-01-23T10:00:00Z',
        status: 'current',
      };

      expect(() => ArtifactSchema.parse(validArtifact)).not.toThrow();
      expect(validateArtifact(validArtifact)).toEqual(validArtifact);
    });

    it('validates artifact with optional fields', () => {
      const artifactWithOptional = {
        id: 'art-2',
        artifact_type: 'design',
        name: 'System Design',
        path: '/docs/design.md',
        updated_at: '2026-01-23T10:00:00Z',
        status: 'current',
        version: '1.0.0',
        size: 1024,
        hash: 'abc123',
        created_by: 'agent-1',
      };

      expect(() => ArtifactSchema.parse(artifactWithOptional)).not.toThrow();
    });

    it('validates artifact list', () => {
      const artifactList = {
        items: [
          {
            id: 'art-1',
            artifact_type: 'prd',
            name: 'Test',
            path: '/test.md',
            updated_at: '2026-01-23T10:00:00Z',
            status: 'current',
          },
        ],
        total: 1,
        page: 1,
        page_size: 10,
      };

      expect(() => ArtifactListSchema.parse(artifactList)).not.toThrow();
      expect(validateArtifactList(artifactList)).toEqual(artifactList);
    });
  });

  describe('Session Schema', () => {
    it('validates a valid session object', () => {
      const validSession = {
        id: 'session-1',
        tenant: 'default',
        environment: 'development',
        created_at: '2026-01-23T10:00:00Z',
        status: 'active',
      };

      expect(() => SessionSchema.parse(validSession)).not.toThrow();
      expect(validateSession(validSession)).toEqual(validSession);
    });

    it('validates session with optional fields', () => {
      const sessionWithOptional = {
        id: 'session-2',
        tenant: 'default',
        environment: 'production',
        created_at: '2026-01-23T10:00:00Z',
        status: 'completed',
        repo_url: 'https://github.com/example/repo',
        epic_id: 'epic-1',
        branch: 'feature/test',
      };

      expect(() => SessionSchema.parse(sessionWithOptional)).not.toThrow();
    });
  });

  describe('Event Schema', () => {
    it('validates a valid event object', () => {
      const validEvent = {
        id: 'event-1',
        type: 'gate.created',
        timestamp: '2026-01-23T10:00:00Z',
        data: { gate_id: 'gate-1' },
      };

      expect(() => EventSchema.parse(validEvent)).not.toThrow();
      expect(validateEvent(validEvent)).toEqual(validEvent);
    });

    it('validates event with optional fields', () => {
      const eventWithOptional = {
        id: 'event-2',
        type: 'run.completed',
        timestamp: '2026-01-23T10:00:00Z',
        data: { run_id: 'run-1', status: 'completed' },
        tenant: 'default',
        session_id: 'session-1',
      };

      expect(() => EventSchema.parse(eventWithOptional)).not.toThrow();
    });
  });

  describe('Evidence Schema', () => {
    it('validates a valid evidence object', () => {
      const validEvidence = {
        id: 'ev-1',
        type: 'artifact',
        title: 'Test Evidence',
        summary: 'Evidence summary',
        timestamp: '2026-01-23T10:00:00Z',
      };

      expect(() => EvidenceSchema.parse(validEvidence)).not.toThrow();
    });

    it('validates evidence with optional fields', () => {
      const evidenceWithOptional = {
        id: 'ev-2',
        type: 'log',
        title: 'Log Evidence',
        summary: 'Log summary',
        timestamp: '2026-01-23T10:00:00Z',
        artifact_id: 'art-1',
        run_id: 'run-1',
        content: 'Log content here',
      };

      expect(() => EvidenceSchema.parse(evidenceWithOptional)).not.toThrow();
    });
  });

  describe('Validation Functions', () => {
    it('validateGate throws on invalid data', () => {
      const invalid = { id: 'test' };
      expect(() => validateGate(invalid)).toThrow();
    });

    it('validateRun throws on invalid data', () => {
      const invalid = { id: 'test' };
      expect(() => validateRun(invalid)).toThrow();
    });

    it('validateArtifact throws on invalid data', () => {
      const invalid = { id: 'test' };
      expect(() => validateArtifact(invalid)).toThrow();
    });

    it('validateSession throws on invalid data', () => {
      const invalid = { id: 'test' };
      expect(() => validateSession(invalid)).toThrow();
    });

    it('validateEvent throws on invalid data', () => {
      const invalid = { id: 'test' };
      expect(() => validateEvent(invalid)).toThrow();
    });
  });
});
