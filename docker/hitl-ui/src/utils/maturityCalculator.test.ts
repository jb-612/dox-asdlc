/**
 * Tests for maturity calculation algorithm (P05-F11 T03)
 */

import { describe, it, expect } from 'vitest';
import {
  calculateMaturity,
  getMaturityLevel,
  identifyGaps,
  createInitialCategories,
} from './maturityCalculator';
import type { CategoryMaturity, MaturityLevel, Gap } from '../types/ideation';

describe('maturityCalculator', () => {
  describe('calculateMaturity', () => {
    it('should return 0 for empty categories', () => {
      const result = calculateMaturity([]);
      expect(result).toBe(0);
    });

    it('should return 0 when all categories have score 0', () => {
      const categories = createInitialCategories();
      const result = calculateMaturity(categories);
      expect(result).toBe(0);
    });

    it('should calculate weighted score correctly', () => {
      // Categories with known weights: problem=15, users=10, functional=25, nfr=15, scope=15, success=10, risks=10
      const categories: CategoryMaturity[] = [
        { id: 'problem', name: 'Problem Statement', score: 100, weight: 15, requiredForSubmit: true, sections: [] },
        { id: 'users', name: 'Target Users', score: 100, weight: 10, requiredForSubmit: true, sections: [] },
        { id: 'functional', name: 'Functional Requirements', score: 100, weight: 25, requiredForSubmit: true, sections: [] },
        { id: 'nfr', name: 'Non-Functional Requirements', score: 0, weight: 15, requiredForSubmit: false, sections: [] },
        { id: 'scope', name: 'Scope & Constraints', score: 0, weight: 15, requiredForSubmit: true, sections: [] },
        { id: 'success', name: 'Success Criteria', score: 0, weight: 10, requiredForSubmit: false, sections: [] },
        { id: 'risks', name: 'Risks & Assumptions', score: 0, weight: 10, requiredForSubmit: false, sections: [] },
      ];

      // Expected: (100*15 + 100*10 + 100*25) / 100 = 50
      const result = calculateMaturity(categories);
      expect(result).toBe(50);
    });

    it('should return 100 when all categories have score 100', () => {
      const categories: CategoryMaturity[] = [
        { id: 'problem', name: 'Problem Statement', score: 100, weight: 15, requiredForSubmit: true, sections: [] },
        { id: 'users', name: 'Target Users', score: 100, weight: 10, requiredForSubmit: true, sections: [] },
        { id: 'functional', name: 'Functional Requirements', score: 100, weight: 25, requiredForSubmit: true, sections: [] },
        { id: 'nfr', name: 'Non-Functional Requirements', score: 100, weight: 15, requiredForSubmit: false, sections: [] },
        { id: 'scope', name: 'Scope & Constraints', score: 100, weight: 15, requiredForSubmit: true, sections: [] },
        { id: 'success', name: 'Success Criteria', score: 100, weight: 10, requiredForSubmit: false, sections: [] },
        { id: 'risks', name: 'Risks & Assumptions', score: 100, weight: 10, requiredForSubmit: false, sections: [] },
      ];

      const result = calculateMaturity(categories);
      expect(result).toBe(100);
    });

    it('should handle partial scores correctly', () => {
      const categories: CategoryMaturity[] = [
        { id: 'problem', name: 'Problem Statement', score: 50, weight: 15, requiredForSubmit: true, sections: [] },
        { id: 'users', name: 'Target Users', score: 50, weight: 10, requiredForSubmit: true, sections: [] },
        { id: 'functional', name: 'Functional Requirements', score: 50, weight: 25, requiredForSubmit: true, sections: [] },
        { id: 'nfr', name: 'Non-Functional Requirements', score: 50, weight: 15, requiredForSubmit: false, sections: [] },
        { id: 'scope', name: 'Scope & Constraints', score: 50, weight: 15, requiredForSubmit: true, sections: [] },
        { id: 'success', name: 'Success Criteria', score: 50, weight: 10, requiredForSubmit: false, sections: [] },
        { id: 'risks', name: 'Risks & Assumptions', score: 50, weight: 10, requiredForSubmit: false, sections: [] },
      ];

      // Expected: 50 * (15+10+25+15+15+10+10) / 100 = 50
      const result = calculateMaturity(categories);
      expect(result).toBe(50);
    });

    it('should round to nearest integer', () => {
      const categories: CategoryMaturity[] = [
        { id: 'problem', name: 'Problem Statement', score: 33, weight: 15, requiredForSubmit: true, sections: [] },
        { id: 'users', name: 'Target Users', score: 0, weight: 10, requiredForSubmit: true, sections: [] },
        { id: 'functional', name: 'Functional Requirements', score: 0, weight: 25, requiredForSubmit: true, sections: [] },
        { id: 'nfr', name: 'Non-Functional Requirements', score: 0, weight: 15, requiredForSubmit: false, sections: [] },
        { id: 'scope', name: 'Scope & Constraints', score: 0, weight: 15, requiredForSubmit: true, sections: [] },
        { id: 'success', name: 'Success Criteria', score: 0, weight: 10, requiredForSubmit: false, sections: [] },
        { id: 'risks', name: 'Risks & Assumptions', score: 0, weight: 10, requiredForSubmit: false, sections: [] },
      ];

      // Expected: 33 * 15 / 100 = 4.95 -> rounds to 5
      const result = calculateMaturity(categories);
      expect(result).toBe(5);
    });
  });

  describe('getMaturityLevel', () => {
    it('should return concept for score 0', () => {
      const level = getMaturityLevel(0);
      expect(level.level).toBe('concept');
      expect(level.label).toBe('General Concept');
    });

    it('should return concept for score 19', () => {
      const level = getMaturityLevel(19);
      expect(level.level).toBe('concept');
    });

    it('should return exploration for score 20', () => {
      const level = getMaturityLevel(20);
      expect(level.level).toBe('exploration');
      expect(level.label).toBe('Exploration');
    });

    it('should return exploration for score 39', () => {
      const level = getMaturityLevel(39);
      expect(level.level).toBe('exploration');
    });

    it('should return defined for score 40', () => {
      const level = getMaturityLevel(40);
      expect(level.level).toBe('defined');
      expect(level.label).toBe('Firm Understanding');
    });

    it('should return refined for score 60', () => {
      const level = getMaturityLevel(60);
      expect(level.level).toBe('refined');
      expect(level.label).toBe('Refined');
    });

    it('should return complete for score 80', () => {
      const level = getMaturityLevel(80);
      expect(level.level).toBe('complete');
      expect(level.label).toBe('Tightly Defined');
    });

    it('should return complete for score 100', () => {
      const level = getMaturityLevel(100);
      expect(level.level).toBe('complete');
    });

    it('should clamp negative scores to concept', () => {
      const level = getMaturityLevel(-10);
      expect(level.level).toBe('concept');
    });

    it('should clamp scores above 100 to complete', () => {
      const level = getMaturityLevel(150);
      expect(level.level).toBe('complete');
    });
  });

  describe('identifyGaps', () => {
    it('should return empty array when all categories are complete', () => {
      const categories: CategoryMaturity[] = [
        { id: 'problem', name: 'Problem Statement', score: 100, weight: 15, requiredForSubmit: true, sections: [] },
        { id: 'users', name: 'Target Users', score: 100, weight: 10, requiredForSubmit: true, sections: [] },
        { id: 'functional', name: 'Functional Requirements', score: 100, weight: 25, requiredForSubmit: true, sections: [] },
        { id: 'nfr', name: 'Non-Functional Requirements', score: 100, weight: 15, requiredForSubmit: false, sections: [] },
        { id: 'scope', name: 'Scope & Constraints', score: 100, weight: 15, requiredForSubmit: true, sections: [] },
        { id: 'success', name: 'Success Criteria', score: 100, weight: 10, requiredForSubmit: false, sections: [] },
        { id: 'risks', name: 'Risks & Assumptions', score: 100, weight: 10, requiredForSubmit: false, sections: [] },
      ];

      const gaps = identifyGaps(categories);
      expect(gaps).toHaveLength(0);
    });

    it('should identify critical gaps for required categories with score 0', () => {
      const categories: CategoryMaturity[] = [
        { id: 'problem', name: 'Problem Statement', score: 0, weight: 15, requiredForSubmit: true, sections: [] },
        { id: 'users', name: 'Target Users', score: 100, weight: 10, requiredForSubmit: true, sections: [] },
        { id: 'functional', name: 'Functional Requirements', score: 100, weight: 25, requiredForSubmit: true, sections: [] },
        { id: 'nfr', name: 'Non-Functional Requirements', score: 100, weight: 15, requiredForSubmit: false, sections: [] },
        { id: 'scope', name: 'Scope & Constraints', score: 100, weight: 15, requiredForSubmit: true, sections: [] },
        { id: 'success', name: 'Success Criteria', score: 100, weight: 10, requiredForSubmit: false, sections: [] },
        { id: 'risks', name: 'Risks & Assumptions', score: 100, weight: 10, requiredForSubmit: false, sections: [] },
      ];

      const gaps = identifyGaps(categories);
      expect(gaps).toHaveLength(1);
      expect(gaps[0].categoryId).toBe('problem');
      expect(gaps[0].severity).toBe('critical');
      expect(gaps[0].suggestedQuestions.length).toBeGreaterThan(0);
    });

    it('should identify moderate gaps for categories with score below 50', () => {
      const categories: CategoryMaturity[] = [
        { id: 'problem', name: 'Problem Statement', score: 30, weight: 15, requiredForSubmit: true, sections: [] },
        { id: 'users', name: 'Target Users', score: 100, weight: 10, requiredForSubmit: true, sections: [] },
        { id: 'functional', name: 'Functional Requirements', score: 100, weight: 25, requiredForSubmit: true, sections: [] },
        { id: 'nfr', name: 'Non-Functional Requirements', score: 100, weight: 15, requiredForSubmit: false, sections: [] },
        { id: 'scope', name: 'Scope & Constraints', score: 100, weight: 15, requiredForSubmit: true, sections: [] },
        { id: 'success', name: 'Success Criteria', score: 100, weight: 10, requiredForSubmit: false, sections: [] },
        { id: 'risks', name: 'Risks & Assumptions', score: 100, weight: 10, requiredForSubmit: false, sections: [] },
      ];

      const gaps = identifyGaps(categories);
      expect(gaps).toHaveLength(1);
      expect(gaps[0].severity).toBe('moderate');
    });

    it('should identify minor gaps for optional categories with score below 80', () => {
      const categories: CategoryMaturity[] = [
        { id: 'problem', name: 'Problem Statement', score: 100, weight: 15, requiredForSubmit: true, sections: [] },
        { id: 'users', name: 'Target Users', score: 100, weight: 10, requiredForSubmit: true, sections: [] },
        { id: 'functional', name: 'Functional Requirements', score: 100, weight: 25, requiredForSubmit: true, sections: [] },
        { id: 'nfr', name: 'Non-Functional Requirements', score: 60, weight: 15, requiredForSubmit: false, sections: [] },
        { id: 'scope', name: 'Scope & Constraints', score: 100, weight: 15, requiredForSubmit: true, sections: [] },
        { id: 'success', name: 'Success Criteria', score: 100, weight: 10, requiredForSubmit: false, sections: [] },
        { id: 'risks', name: 'Risks & Assumptions', score: 100, weight: 10, requiredForSubmit: false, sections: [] },
      ];

      const gaps = identifyGaps(categories);
      expect(gaps).toHaveLength(1);
      expect(gaps[0].categoryId).toBe('nfr');
      expect(gaps[0].severity).toBe('minor');
    });

    it('should sort gaps by severity (critical first)', () => {
      const categories: CategoryMaturity[] = [
        { id: 'problem', name: 'Problem Statement', score: 0, weight: 15, requiredForSubmit: true, sections: [] },
        { id: 'users', name: 'Target Users', score: 30, weight: 10, requiredForSubmit: true, sections: [] },
        { id: 'functional', name: 'Functional Requirements', score: 60, weight: 25, requiredForSubmit: true, sections: [] },
        { id: 'nfr', name: 'Non-Functional Requirements', score: 100, weight: 15, requiredForSubmit: false, sections: [] },
        { id: 'scope', name: 'Scope & Constraints', score: 100, weight: 15, requiredForSubmit: true, sections: [] },
        { id: 'success', name: 'Success Criteria', score: 100, weight: 10, requiredForSubmit: false, sections: [] },
        { id: 'risks', name: 'Risks & Assumptions', score: 100, weight: 10, requiredForSubmit: false, sections: [] },
      ];

      const gaps = identifyGaps(categories);
      expect(gaps.length).toBeGreaterThanOrEqual(2);
      expect(gaps[0].severity).toBe('critical');
      expect(gaps[1].severity).toBe('moderate');
    });

    it('should return suggested questions for each gap', () => {
      const categories: CategoryMaturity[] = [
        { id: 'problem', name: 'Problem Statement', score: 0, weight: 15, requiredForSubmit: true, sections: [] },
        { id: 'users', name: 'Target Users', score: 100, weight: 10, requiredForSubmit: true, sections: [] },
        { id: 'functional', name: 'Functional Requirements', score: 100, weight: 25, requiredForSubmit: true, sections: [] },
        { id: 'nfr', name: 'Non-Functional Requirements', score: 100, weight: 15, requiredForSubmit: false, sections: [] },
        { id: 'scope', name: 'Scope & Constraints', score: 100, weight: 15, requiredForSubmit: true, sections: [] },
        { id: 'success', name: 'Success Criteria', score: 100, weight: 10, requiredForSubmit: false, sections: [] },
        { id: 'risks', name: 'Risks & Assumptions', score: 100, weight: 10, requiredForSubmit: false, sections: [] },
      ];

      const gaps = identifyGaps(categories);
      expect(gaps[0].suggestedQuestions.length).toBeGreaterThan(0);
      expect(typeof gaps[0].suggestedQuestions[0]).toBe('string');
    });
  });

  describe('createInitialCategories', () => {
    it('should create all required categories', () => {
      const categories = createInitialCategories();
      expect(categories).toHaveLength(7);
    });

    it('should initialize all scores to 0', () => {
      const categories = createInitialCategories();
      categories.forEach(cat => {
        expect(cat.score).toBe(0);
      });
    });

    it('should have weights that sum to 100', () => {
      const categories = createInitialCategories();
      const totalWeight = categories.reduce((sum, cat) => sum + cat.weight, 0);
      expect(totalWeight).toBe(100);
    });

    it('should have correct required flags', () => {
      const categories = createInitialCategories();
      const requiredCategories = categories.filter(c => c.requiredForSubmit);
      expect(requiredCategories.length).toBe(4);
      expect(requiredCategories.map(c => c.id)).toContain('problem');
      expect(requiredCategories.map(c => c.id)).toContain('users');
      expect(requiredCategories.map(c => c.id)).toContain('functional');
      expect(requiredCategories.map(c => c.id)).toContain('scope');
    });
  });
});
