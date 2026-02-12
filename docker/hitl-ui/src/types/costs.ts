/**
 * TypeScript types for Agent Cost Tracker (P13-F01)
 *
 * Aligned with backend Pydantic models in
 * src/orchestrator/api/models/costs.py
 */

// ============================================================================
// Core data types
// ============================================================================

export interface CostRecord {
  id: number;
  session_id: string | null;
  agent_id: string | null;
  model: string | null;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number;
  timestamp: number; // Unix seconds (float) from backend
  tool_name: string | null;
  hook_event_id: number | null;
}

export interface CostSummaryGroup {
  key: string | null;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_usd: number;
  record_count: number;
}

export interface CostSummaryResponse {
  groups: CostSummaryGroup[];
  total_cost_usd: number;
  total_input_tokens: number;
  total_output_tokens: number;
  period: { date_from: string; date_to: string } | null;
}

export interface CostRecordsResponse {
  records: CostRecord[];
  total: number;
  page: number;
  page_size: number;
}

// ============================================================================
// Session breakdown
// ============================================================================

export interface SessionCostBreakdown {
  session_id: string;
  model_breakdown: Array<{
    model: string | null;
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
  }>;
  tool_breakdown: Array<{
    tool_name: string | null;
    call_count: number;
    total_cost_usd: number;
  }>;
  total_cost_usd: number;
}

// ============================================================================
// Pricing
// ============================================================================

export interface ModelPricingEntry {
  model_prefix: string;
  input_rate_per_million: number;
  output_rate_per_million: number;
}

export interface PricingResponse {
  models: ModelPricingEntry[];
}

// ============================================================================
// Filter / query types
// ============================================================================

export type CostGroupBy = 'agent' | 'model' | 'day';

export type CostTimeRange = '1h' | '24h' | '7d' | '30d' | 'all';
