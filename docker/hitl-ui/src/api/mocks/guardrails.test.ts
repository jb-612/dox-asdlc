/**
 * Tests for guardrails mock data (P11-F01, T18)
 *
 * Validates mock data structure, category coverage, and helper functions.
 */
import { describe, it, expect } from 'vitest';
import type { GuidelineCategory } from '../types/guardrails';

// ============================================================================
// Mock data structure tests
// ============================================================================

describe('guardrails mock data', () => {
  describe('mockGuidelines', () => {
    it('exports mockGuidelines with at least 8 entries', async () => {
      const { mockGuidelines } = await import('./guardrailsData');
      expect(mockGuidelines.length).toBeGreaterThanOrEqual(8);
    });

    it('has required fields on all guidelines', async () => {
      const { mockGuidelines } = await import('./guardrailsData');
      mockGuidelines.forEach((gl) => {
        expect(gl).toHaveProperty('id');
        expect(gl).toHaveProperty('name');
        expect(gl).toHaveProperty('description');
        expect(gl).toHaveProperty('category');
        expect(gl).toHaveProperty('priority');
        expect(gl).toHaveProperty('enabled');
        expect(gl).toHaveProperty('condition');
        expect(gl).toHaveProperty('action');
        expect(gl).toHaveProperty('version');
        expect(gl).toHaveProperty('created_at');
        expect(gl).toHaveProperty('updated_at');
      });
    });

    it('has valid categories on all guidelines', async () => {
      const { mockGuidelines } = await import('./guardrailsData');
      const validCategories: GuidelineCategory[] = [
        'cognitive_isolation',
        'tdd_protocol',
        'hitl_gate',
        'tool_restriction',
        'path_restriction',
        'commit_policy',
        'custom',
      ];
      mockGuidelines.forEach((gl) => {
        expect(validCategories).toContain(gl.category);
      });
    });

    it('covers all GuidelineCategory values', async () => {
      const { mockGuidelines } = await import('./guardrailsData');
      const allCategories: GuidelineCategory[] = [
        'cognitive_isolation',
        'tdd_protocol',
        'hitl_gate',
        'tool_restriction',
        'path_restriction',
        'commit_policy',
        'custom',
      ];
      const presentCategories = new Set(mockGuidelines.map((gl) => gl.category));
      allCategories.forEach((cat) => {
        expect(presentCategories.has(cat)).toBe(true);
      });
    });

    it('includes at least one disabled guideline', async () => {
      const { mockGuidelines } = await import('./guardrailsData');
      const disabledCount = mockGuidelines.filter((gl) => !gl.enabled).length;
      expect(disabledCount).toBeGreaterThanOrEqual(1);
    });

    it('has unique IDs for all guidelines', async () => {
      const { mockGuidelines } = await import('./guardrailsData');
      const ids = mockGuidelines.map((gl) => gl.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('has valid priority range (0-1000) on all guidelines', async () => {
      const { mockGuidelines } = await import('./guardrailsData');
      mockGuidelines.forEach((gl) => {
        expect(gl.priority).toBeGreaterThanOrEqual(0);
        expect(gl.priority).toBeLessThanOrEqual(1000);
      });
    });

    it('has valid action types on all guidelines', async () => {
      const { mockGuidelines } = await import('./guardrailsData');
      const validActionTypes = ['instruction', 'tool_allow', 'tool_deny', 'hitl_require', 'custom'];
      mockGuidelines.forEach((gl) => {
        expect(validActionTypes).toContain(gl.action.action_type);
      });
    });

    it('has condition objects on all guidelines', async () => {
      const { mockGuidelines } = await import('./guardrailsData');
      mockGuidelines.forEach((gl) => {
        expect(gl.condition).toBeDefined();
        expect(typeof gl.condition).toBe('object');
      });
    });

    it('has ISO-8601 date strings for created_at and updated_at', async () => {
      const { mockGuidelines } = await import('./guardrailsData');
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
      mockGuidelines.forEach((gl) => {
        expect(gl.created_at).toMatch(isoRegex);
        expect(gl.updated_at).toMatch(isoRegex);
      });
    });

    it('has positive version numbers on all guidelines', async () => {
      const { mockGuidelines } = await import('./guardrailsData');
      mockGuidelines.forEach((gl) => {
        expect(gl.version).toBeGreaterThanOrEqual(1);
      });
    });
  });

  // ============================================================================
  // Audit log tests
  // ============================================================================

  describe('mockAuditEntries', () => {
    it('exports mockAuditEntries with at least 5 entries', async () => {
      const { mockAuditEntries } = await import('./guardrailsData');
      expect(mockAuditEntries.length).toBeGreaterThanOrEqual(5);
    });

    it('has required fields on all audit entries', async () => {
      const { mockAuditEntries } = await import('./guardrailsData');
      mockAuditEntries.forEach((entry) => {
        expect(entry).toHaveProperty('id');
        expect(entry).toHaveProperty('event_type');
        expect(entry).toHaveProperty('timestamp');
      });
    });

    it('has valid event types', async () => {
      const { mockAuditEntries } = await import('./guardrailsData');
      const validEventTypes = [
        'guideline_created',
        'guideline_updated',
        'guideline_toggled',
        'guideline_deleted',
        'context_evaluated',
      ];
      mockAuditEntries.forEach((entry) => {
        expect(validEventTypes).toContain(entry.event_type);
      });
    });

    it('has unique IDs for all audit entries', async () => {
      const { mockAuditEntries } = await import('./guardrailsData');
      const ids = mockAuditEntries.map((entry) => entry.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('has ISO-8601 timestamps', async () => {
      const { mockAuditEntries } = await import('./guardrailsData');
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
      mockAuditEntries.forEach((entry) => {
        expect(entry.timestamp).toMatch(isoRegex);
      });
    });

    it('covers at least 3 different event types', async () => {
      const { mockAuditEntries } = await import('./guardrailsData');
      const eventTypes = new Set(mockAuditEntries.map((entry) => entry.event_type));
      expect(eventTypes.size).toBeGreaterThanOrEqual(3);
    });
  });

  // ============================================================================
  // Evaluated context tests
  // ============================================================================

  describe('mockEvaluatedContext', () => {
    it('exports mockEvaluatedContext with required fields', async () => {
      const { mockEvaluatedContext } = await import('./guardrailsData');
      expect(mockEvaluatedContext).toHaveProperty('matched_count');
      expect(mockEvaluatedContext).toHaveProperty('combined_instruction');
      expect(mockEvaluatedContext).toHaveProperty('tools_allowed');
      expect(mockEvaluatedContext).toHaveProperty('tools_denied');
      expect(mockEvaluatedContext).toHaveProperty('hitl_gates');
      expect(mockEvaluatedContext).toHaveProperty('guidelines');
    });

    it('has matched_count matching guidelines array length', async () => {
      const { mockEvaluatedContext } = await import('./guardrailsData');
      expect(mockEvaluatedContext.matched_count).toBe(
        mockEvaluatedContext.guidelines.length
      );
    });

    it('has valid evaluated guidelines with required fields', async () => {
      const { mockEvaluatedContext } = await import('./guardrailsData');
      mockEvaluatedContext.guidelines.forEach((gl) => {
        expect(gl).toHaveProperty('guideline_id');
        expect(gl).toHaveProperty('guideline_name');
        expect(gl).toHaveProperty('priority');
        expect(gl).toHaveProperty('match_score');
        expect(gl).toHaveProperty('matched_fields');
        expect(gl.match_score).toBeGreaterThanOrEqual(0);
        expect(gl.match_score).toBeLessThanOrEqual(1);
        expect(Array.isArray(gl.matched_fields)).toBe(true);
      });
    });

    it('has arrays for tools_allowed and tools_denied', async () => {
      const { mockEvaluatedContext } = await import('./guardrailsData');
      expect(Array.isArray(mockEvaluatedContext.tools_allowed)).toBe(true);
      expect(Array.isArray(mockEvaluatedContext.tools_denied)).toBe(true);
    });

    it('has combined_instruction as a non-empty string', async () => {
      const { mockEvaluatedContext } = await import('./guardrailsData');
      expect(typeof mockEvaluatedContext.combined_instruction).toBe('string');
      expect(mockEvaluatedContext.combined_instruction.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Helper function tests
  // ============================================================================

  describe('simulateGuardrailsDelay', () => {
    it('resolves after simulated delay', async () => {
      const { simulateGuardrailsDelay } = await import('./guardrailsData');
      const start = Date.now();
      await simulateGuardrailsDelay(10, 50);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(9);
    });
  });

  describe('getMockGuidelinesListResponse', () => {
    it('returns a valid list response with defaults', async () => {
      const { getMockGuidelinesListResponse } = await import('./guardrailsData');
      const response = getMockGuidelinesListResponse();
      expect(response).toHaveProperty('guidelines');
      expect(response).toHaveProperty('total');
      expect(response).toHaveProperty('page');
      expect(response).toHaveProperty('page_size');
      expect(response.page).toBe(1);
      expect(response.page_size).toBe(20);
      expect(Array.isArray(response.guidelines)).toBe(true);
    });

    it('filters by category when specified', async () => {
      const { getMockGuidelinesListResponse } = await import('./guardrailsData');
      const response = getMockGuidelinesListResponse({ category: 'tdd_protocol' });
      response.guidelines.forEach((gl) => {
        expect(gl.category).toBe('tdd_protocol');
      });
    });

    it('filters by enabled when specified', async () => {
      const { getMockGuidelinesListResponse } = await import('./guardrailsData');
      const response = getMockGuidelinesListResponse({ enabled: true });
      response.guidelines.forEach((gl) => {
        expect(gl.enabled).toBe(true);
      });
    });

    it('handles pagination', async () => {
      const { getMockGuidelinesListResponse } = await import('./guardrailsData');
      const page1 = getMockGuidelinesListResponse({ page: 1, page_size: 3 });
      const page2 = getMockGuidelinesListResponse({ page: 2, page_size: 3 });
      expect(page1.guidelines.length).toBeLessThanOrEqual(3);
      expect(page1.page).toBe(1);
      expect(page2.page).toBe(2);
      // Page 2 should have different or no items compared to page 1
      if (page1.total > 3) {
        expect(page2.guidelines.length).toBeGreaterThan(0);
      }
    });
  });

  describe('getMockAuditLogResponse', () => {
    it('returns a valid audit log response', async () => {
      const { getMockAuditLogResponse } = await import('./guardrailsData');
      const response = getMockAuditLogResponse();
      expect(response).toHaveProperty('entries');
      expect(response).toHaveProperty('total');
      expect(Array.isArray(response.entries)).toBe(true);
      expect(response.total).toBe(response.entries.length);
    });

    it('filters by guideline_id when specified', async () => {
      const { getMockAuditLogResponse, mockGuidelines } = await import('./guardrailsData');
      const targetId = mockGuidelines[0].id;
      const response = getMockAuditLogResponse({ guideline_id: targetId });
      response.entries.forEach((entry) => {
        expect(entry.guideline_id).toBe(targetId);
      });
    });

    it('filters by event_type when specified', async () => {
      const { getMockAuditLogResponse } = await import('./guardrailsData');
      const response = getMockAuditLogResponse({ event_type: 'guideline_created' });
      response.entries.forEach((entry) => {
        expect(entry.event_type).toBe('guideline_created');
      });
    });
  });
});
