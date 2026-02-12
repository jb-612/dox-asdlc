/**
 * Unit tests for costs API client (P13-F01)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getCostSummary,
  getCostRecords,
  getSessionCosts,
  getPricing,
  costsQueryKeys,
} from './costs';
import { apiClient } from './client';
import type {
  CostSummaryResponse,
  CostRecordsResponse,
  SessionCostBreakdown,
  PricingResponse,
} from '../types/costs';

// Mock the API client
vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

// Mock areMocksEnabled to return false (test real API path)
vi.mock('./mocks/index', () => ({
  areMocksEnabled: vi.fn(() => false),
  getMockCostSummary: vi.fn(),
  getMockCostRecords: vi.fn(),
  getMockSessionCosts: vi.fn(),
  getMockPricing: vi.fn(),
  simulateCostDelay: vi.fn().mockResolvedValue(undefined),
}));

describe('costs API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getCostSummary', () => {
    it('fetches cost summary from API with date bounds', async () => {
      const mockResponse: CostSummaryResponse = {
        groups: [
          {
            key: 'pm',
            total_input_tokens: 150000,
            total_output_tokens: 85000,
            total_cost_usd: 8.625,
            record_count: 120,
          },
        ],
        total_cost_usd: 8.625,
        total_input_tokens: 150000,
        total_output_tokens: 85000,
        period: {
          date_from: '2026-02-09T00:00:00Z',
          date_to: '2026-02-10T00:00:00Z',
        },
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });

      const result = await getCostSummary('agent', '24h');

      expect(apiClient.get).toHaveBeenCalledWith('/costs/summary', {
        params: expect.objectContaining({ group_by: 'agent' }),
      });
      // Should send date_from and date_to instead of time_range
      const callParams = vi.mocked(apiClient.get).mock.calls[0][1]?.params;
      expect(callParams).toHaveProperty('date_from');
      expect(callParams).toHaveProperty('date_to');
      expect(callParams).not.toHaveProperty('time_range');
      expect(result).toEqual(mockResponse);
    });

    it('sends no date bounds for "all" time range', async () => {
      const mockResponse: CostSummaryResponse = {
        groups: [],
        total_cost_usd: 0,
        total_input_tokens: 0,
        total_output_tokens: 0,
        period: null,
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });

      await getCostSummary('agent', 'all');

      const callParams = vi.mocked(apiClient.get).mock.calls[0][1]?.params;
      expect(callParams).toEqual({ group_by: 'agent' });
    });

    it('throws on error', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('Network error'));

      await expect(getCostSummary('agent', '24h')).rejects.toThrow('Network error');
    });
  });

  describe('getCostRecords', () => {
    it('fetches cost records from API with default params', async () => {
      const mockResponse: CostRecordsResponse = {
        records: [
          {
            id: 1,
            session_id: 'sess-abc123',
            agent_id: 'pm',
            model: 'claude-opus-4-6',
            input_tokens: 1500,
            output_tokens: 800,
            estimated_cost_usd: 0.0825,
            timestamp: 1739180400,
            tool_name: 'Read',
            hook_event_id: 42,
          },
        ],
        total: 1,
        page: 1,
        page_size: 50,
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });

      const result = await getCostRecords();

      expect(apiClient.get).toHaveBeenCalledWith('/costs', {
        params: {},
      });
      expect(result).toEqual(mockResponse);
    });

    it('passes filter params to API', async () => {
      const mockResponse: CostRecordsResponse = {
        records: [],
        total: 0,
        page: 1,
        page_size: 20,
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });

      await getCostRecords({
        agent: 'backend-dev',
        model: 'claude-opus-4-6',
        page: 2,
        pageSize: 20,
      });

      expect(apiClient.get).toHaveBeenCalledWith('/costs', {
        params: {
          agent_id: 'backend-dev',
          model: 'claude-opus-4-6',
          page: 2,
          page_size: 20,
        },
      });
    });

    it('throws on error', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('Network error'));

      await expect(getCostRecords()).rejects.toThrow('Network error');
    });
  });

  describe('getSessionCosts', () => {
    it('fetches session cost breakdown from API', async () => {
      const mockResponse: SessionCostBreakdown = {
        session_id: 'sess-abc123',
        model_breakdown: [
          {
            model: 'claude-opus-4-6',
            input_tokens: 50000,
            output_tokens: 25000,
            cost_usd: 2.625,
          },
        ],
        tool_breakdown: [
          {
            tool_name: 'Read',
            call_count: 15,
            total_cost_usd: 0.85,
          },
        ],
        total_cost_usd: 2.625,
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });

      const result = await getSessionCosts('sess-abc123');

      expect(apiClient.get).toHaveBeenCalledWith('/costs/sessions/sess-abc123');
      expect(result).toEqual(mockResponse);
    });

    it('throws on error', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('Network error'));

      await expect(getSessionCosts('sess-abc123')).rejects.toThrow('Network error');
    });
  });

  describe('getPricing', () => {
    it('fetches pricing from API', async () => {
      const mockResponse: PricingResponse = {
        models: [
          { model_prefix: 'claude-opus-4', input_rate_per_million: 15.0, output_rate_per_million: 75.0 },
          { model_prefix: 'claude-sonnet-4', input_rate_per_million: 3.0, output_rate_per_million: 15.0 },
          { model_prefix: 'claude-haiku-4', input_rate_per_million: 0.8, output_rate_per_million: 4.0 },
        ],
      };

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse });

      const result = await getPricing();

      expect(apiClient.get).toHaveBeenCalledWith('/costs/pricing');
      expect(result).toEqual(mockResponse);
    });

    it('throws on error', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('Network error'));

      await expect(getPricing()).rejects.toThrow('Network error');
    });
  });

  describe('costsQueryKeys', () => {
    it('generates correct base key', () => {
      expect(costsQueryKeys.all).toEqual(['costs']);
    });

    it('generates correct summary key', () => {
      expect(costsQueryKeys.summary('agent', '24h')).toEqual([
        'costs',
        'summary',
        'agent',
        '24h',
      ]);
    });

    it('generates correct records key without filters', () => {
      expect(costsQueryKeys.records()).toEqual(['costs', 'records', undefined]);
    });

    it('generates correct records key with filters', () => {
      const filters = { agent: 'pm', page: 2 };
      expect(costsQueryKeys.records(filters)).toEqual(['costs', 'records', filters]);
    });

    it('generates correct session key', () => {
      expect(costsQueryKeys.session('sess-abc123')).toEqual([
        'costs',
        'session',
        'sess-abc123',
      ]);
    });

    it('generates correct pricing key', () => {
      expect(costsQueryKeys.pricing()).toEqual(['costs', 'pricing']);
    });

    it('generates unique keys for different params', () => {
      const key1 = costsQueryKeys.summary('agent', '24h');
      const key2 = costsQueryKeys.summary('model', '7d');
      expect(key1).not.toEqual(key2);
    });
  });

  describe('mock mode', () => {
    it('returns mock data when mocks enabled', async () => {
      const { areMocksEnabled, getMockCostSummary, simulateCostDelay } = await import('./mocks/index');
      vi.mocked(areMocksEnabled).mockReturnValue(true);
      const mockSummary: CostSummaryResponse = {
        groups: [],
        total_cost_usd: 0,
        total_input_tokens: 0,
        total_output_tokens: 0,
        period: null,
      };
      vi.mocked(getMockCostSummary).mockReturnValue(mockSummary);

      const result = await getCostSummary('agent', '24h');

      expect(simulateCostDelay).toHaveBeenCalled();
      expect(getMockCostSummary).toHaveBeenCalledWith('agent', '24h');
      expect(result).toEqual(mockSummary);
      expect(apiClient.get).not.toHaveBeenCalled();
    });
  });
});
