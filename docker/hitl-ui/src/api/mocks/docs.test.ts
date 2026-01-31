/**
 * Tests for documentation mock data
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  mockDocuments,
  mockDiagrams,
  getMockDocumentContent,
  getMockDiagramContent,
} from './docs';

describe('docs mock data', () => {
  describe('mockDocuments', () => {
    it('exports mockDocuments with required fields', () => {
      expect(mockDocuments.length).toBeGreaterThanOrEqual(4);
      mockDocuments.forEach((doc) => {
        expect(doc).toHaveProperty('id');
        expect(doc).toHaveProperty('title');
        expect(doc).toHaveProperty('path');
        expect(doc).toHaveProperty('category');
        expect(doc).toHaveProperty('description');
      });
    });

    it('has valid categories', () => {
      const validCategories = ['system', 'feature', 'architecture', 'workflow'];
      mockDocuments.forEach((doc) => {
        expect(validCategories).toContain(doc.category);
      });
    });

    it('includes System_Design document', () => {
      const systemDesign = mockDocuments.find(
        (doc) => doc.path === 'System_Design.md'
      );
      expect(systemDesign).toBeDefined();
      expect(systemDesign?.id).toBe('system-design');
      expect(systemDesign?.category).toBe('system');
    });

    it('includes Main_Features document', () => {
      const mainFeatures = mockDocuments.find(
        (doc) => doc.path === 'Main_Features.md'
      );
      expect(mainFeatures).toBeDefined();
      expect(mainFeatures?.id).toBe('main-features');
      expect(mainFeatures?.category).toBe('feature');
    });
  });

  describe('mockDiagrams', () => {
    it('exports mockDiagrams with expected entries', () => {
      expect(mockDiagrams.length).toBeGreaterThanOrEqual(14);
    });

    it('has required fields on all diagrams', () => {
      mockDiagrams.forEach((diagram) => {
        expect(diagram).toHaveProperty('id');
        expect(diagram).toHaveProperty('title');
        expect(diagram).toHaveProperty('filename');
        expect(diagram).toHaveProperty('category');
        expect(diagram).toHaveProperty('description');
      });
    });

    it('has valid categories', () => {
      const validCategories = ['architecture', 'flow', 'sequence', 'decision'];
      mockDiagrams.forEach((diagram) => {
        expect(validCategories).toContain(diagram.category);
      });
    });

    it('includes System Architecture diagram', () => {
      const sysArch = mockDiagrams.find(
        (d) => d.id === '01-system-architecture'
      );
      expect(sysArch).toBeDefined();
      expect(sysArch?.filename).toBe('01-system-architecture.mmd');
      expect(sysArch?.category).toBe('architecture');
    });

    it('filenames end with .mmd extension', () => {
      mockDiagrams.forEach((diagram) => {
        expect(diagram.filename).toMatch(/\.mmd$/);
      });
    });
  });

  describe('getMockDocumentContent', () => {
    it('returns content for system-design', () => {
      const result = getMockDocumentContent('system-design');
      expect(result).toBeDefined();
      expect(result?.meta.id).toBe('system-design');
      expect(result?.content).toContain('# aSDLC System Design');
    });

    it('returns content for main-features', () => {
      const result = getMockDocumentContent('main-features');
      expect(result).toBeDefined();
      expect(result?.meta.id).toBe('main-features');
      expect(result?.content).toContain('# aSDLC Main Features');
    });

    it('returns null for unknown document', () => {
      const result = getMockDocumentContent('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('getMockDiagramContent', () => {
    beforeEach(() => {
      // Mock fetch for diagram content tests
      global.fetch = vi.fn();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('returns content for system-architecture diagram when fetch succeeds', async () => {
      const mockMermaidContent = 'graph TB\n  A[System] --> B[Component]';
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockMermaidContent),
      });

      const result = await getMockDiagramContent('01-system-architecture');
      expect(result).toBeDefined();
      expect(result?.meta.id).toBe('01-system-architecture');
      expect(result?.content).toBe(mockMermaidContent);
      expect(global.fetch).toHaveBeenCalledWith('/docs/diagrams/01-system-architecture.mmd');
    });

    it('returns fallback content when fetch fails', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await getMockDiagramContent('01-system-architecture');
      expect(result).toBeDefined();
      expect(result?.meta.id).toBe('01-system-architecture');
      expect(result?.content).toContain('Loading Failed');
    });

    it('returns null for unknown diagram', async () => {
      const result = await getMockDiagramContent('nonexistent');
      expect(result).toBeNull();
    });
  });
});
