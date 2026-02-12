/**
 * Mock data for Agent Cost Tracker (P13-F01)
 *
 * Provides realistic cost data for development without a backend.
 * Enable with VITE_USE_MOCKS=true in .env.local
 */

import type {
  CostRecord,
  CostSummaryResponse,
  CostSummaryGroup,
  CostRecordsResponse,
  SessionCostBreakdown,
  PricingResponse,
  CostGroupBy,
  CostTimeRange,
} from '../../types/costs';

// ============================================================================
// Constants
// ============================================================================

const AGENTS = ['pm', 'backend-dev', 'frontend-dev', 'reviewer', 'orchestrator'] as const;

const MODELS = ['claude-opus-4-6', 'claude-sonnet-4-5', 'claude-haiku-4-5'] as const;

const TOOLS = ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob', 'Task', 'SendMessage'] as const;

const PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4-6': { input: 15.0, output: 75.0 },
  'claude-sonnet-4-5': { input: 3.0, output: 15.0 },
  'claude-haiku-4-5': { input: 0.8, output: 4.0 },
};

// ============================================================================
// Helpers
// ============================================================================

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function generateSessionId(index: number): string {
  const hex = (index * 7919 + 0xa3b5).toString(16).slice(0, 6);
  return `sess-${hex}`;
}

function timeRangeToMs(range: CostTimeRange): number {
  switch (range) {
    case '1h':
      return 60 * 60 * 1000;
    case '24h':
      return 24 * 60 * 60 * 1000;
    case '7d':
      return 7 * 24 * 60 * 60 * 1000;
    case '30d':
      return 30 * 24 * 60 * 60 * 1000;
    case 'all':
      return 90 * 24 * 60 * 60 * 1000;
  }
}

function computeCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const rates = PRICING[model] ?? PRICING['claude-opus-4-6'];
  return (inputTokens * rates.input + outputTokens * rates.output) / 1_000_000;
}

// ============================================================================
// Mock record generation
// ============================================================================

const SESSION_COUNT = 15;
const RECORDS_PER_SESSION_MIN = 5;
const RECORDS_PER_SESSION_MAX = 25;

interface SessionMeta {
  sessionId: string;
  agentId: string;
  startedAt: Date;
  durationMinutes: number;
}

function buildSessionMetas(): SessionMeta[] {
  const now = Date.now();
  const metas: SessionMeta[] = [];
  for (let i = 0; i < SESSION_COUNT; i++) {
    const offset = randomInt(1, 30) * 24 * 60 * 60 * 1000;
    const startedAt = new Date(now - offset + randomInt(0, 8 * 60 * 60 * 1000));
    metas.push({
      sessionId: generateSessionId(i),
      agentId: randomChoice(AGENTS),
      startedAt,
      durationMinutes: randomInt(5, 120),
    });
  }
  return metas;
}

const sessionMetas = buildSessionMetas();

function buildAllRecords(): CostRecord[] {
  const records: CostRecord[] = [];
  let id = 1;

  for (const meta of sessionMetas) {
    const count = randomInt(RECORDS_PER_SESSION_MIN, RECORDS_PER_SESSION_MAX);
    for (let j = 0; j < count; j++) {
      const model = randomChoice(MODELS);
      const inputTokens = randomInt(200, 8000);
      const outputTokens = randomInt(100, 4000);
      const timestampMs =
        meta.startedAt.getTime() + randomInt(0, meta.durationMinutes * 60 * 1000);

      records.push({
        id: id++,
        session_id: meta.sessionId,
        agent_id: meta.agentId,
        model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        estimated_cost_usd: computeCostUsd(model, inputTokens, outputTokens),
        timestamp: timestampMs / 1000, // Unix seconds
        tool_name: Math.random() > 0.15 ? randomChoice(TOOLS) : null,
        hook_event_id: Math.random() > 0.1 ? randomInt(1, 5000) : null,
      });
    }
  }

  records.sort((a, b) => b.timestamp - a.timestamp);
  return records;
}

const allMockRecords = buildAllRecords();

// ============================================================================
// Public mock API functions
// ============================================================================

/**
 * Simulate network delay for mock API calls
 */
export function simulateCostDelay(minMs = 80, maxMs = 200): Promise<void> {
  const delay = randomFloat(minMs, maxMs);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Return a cost summary grouped by the requested dimension.
 */
export function getMockCostSummary(
  groupBy: CostGroupBy,
  timeRange: CostTimeRange
): CostSummaryResponse {
  const nowMs = Date.now();
  const windowMs = timeRangeToMs(timeRange);
  const filtered = allMockRecords.filter(
    (r) => nowMs - r.timestamp * 1000 <= windowMs
  );

  const groupMap = new Map<string, CostSummaryGroup>();

  for (const r of filtered) {
    let key: string;
    switch (groupBy) {
      case 'agent':
        key = r.agent_id ?? 'unknown';
        break;
      case 'model':
        key = r.model ?? 'unknown';
        break;
      case 'day': {
        const d = new Date(r.timestamp * 1000);
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        break;
      }
    }

    const existing = groupMap.get(key);
    if (existing) {
      existing.total_input_tokens += r.input_tokens;
      existing.total_output_tokens += r.output_tokens;
      existing.total_cost_usd += r.estimated_cost_usd;
      existing.record_count += 1;
    } else {
      groupMap.set(key, {
        key,
        total_input_tokens: r.input_tokens,
        total_output_tokens: r.output_tokens,
        total_cost_usd: r.estimated_cost_usd,
        record_count: 1,
      });
    }
  }

  const groups = Array.from(groupMap.values()).sort(
    (a, b) => b.total_cost_usd - a.total_cost_usd
  );

  const totalCost = groups.reduce((s, g) => s + g.total_cost_usd, 0);
  const totalInput = groups.reduce((s, g) => s + g.total_input_tokens, 0);
  const totalOutput = groups.reduce((s, g) => s + g.total_output_tokens, 0);

  const periodFrom = new Date(nowMs - windowMs).toISOString();
  const periodTo = new Date(nowMs).toISOString();

  return {
    groups,
    total_cost_usd: totalCost,
    total_input_tokens: totalInput,
    total_output_tokens: totalOutput,
    period: { date_from: periodFrom, date_to: periodTo },
  };
}

/**
 * Return a paginated list of cost records.
 */
export function getMockCostRecords(page: number, pageSize: number): CostRecordsResponse {
  const start = (page - 1) * pageSize;
  const records = allMockRecords.slice(start, start + pageSize);
  return {
    records,
    total: allMockRecords.length,
    page,
    page_size: pageSize,
  };
}

/**
 * Return a per-session cost breakdown.
 */
export function getMockSessionCosts(sessionId: string): SessionCostBreakdown {
  const sessionRecords = allMockRecords.filter((r) => r.session_id === sessionId);

  // Model breakdown
  const modelMap = new Map<string, { input: number; output: number; cost: number }>();
  for (const r of sessionRecords) {
    const modelKey = r.model ?? 'unknown';
    const existing = modelMap.get(modelKey);
    if (existing) {
      existing.input += r.input_tokens;
      existing.output += r.output_tokens;
      existing.cost += r.estimated_cost_usd;
    } else {
      modelMap.set(modelKey, {
        input: r.input_tokens,
        output: r.output_tokens,
        cost: r.estimated_cost_usd,
      });
    }
  }

  // Tool breakdown
  const toolMap = new Map<string, { count: number; cost: number }>();
  for (const r of sessionRecords) {
    const toolName = r.tool_name ?? 'unknown';
    const existing = toolMap.get(toolName);
    if (existing) {
      existing.count += 1;
      existing.cost += r.estimated_cost_usd;
    } else {
      toolMap.set(toolName, { count: 1, cost: r.estimated_cost_usd });
    }
  }

  const totalCost = sessionRecords.reduce((s, r) => s + r.estimated_cost_usd, 0);

  return {
    session_id: sessionId,
    model_breakdown: Array.from(modelMap.entries()).map(([model, v]) => ({
      model,
      input_tokens: v.input,
      output_tokens: v.output,
      cost_usd: v.cost,
    })),
    tool_breakdown: Array.from(toolMap.entries()).map(([tool_name, v]) => ({
      tool_name,
      call_count: v.count,
      total_cost_usd: v.cost,
    })),
    total_cost_usd: totalCost,
  };
}

/**
 * Return the model pricing table.
 */
export function getMockPricing(): PricingResponse {
  return {
    models: [
      { model_prefix: 'claude-opus-4', input_rate_per_million: 15.0, output_rate_per_million: 75.0 },
      { model_prefix: 'claude-sonnet-4', input_rate_per_million: 3.0, output_rate_per_million: 15.0 },
      { model_prefix: 'claude-haiku-4', input_rate_per_million: 0.8, output_rate_per_million: 4.0 },
    ],
  };
}
