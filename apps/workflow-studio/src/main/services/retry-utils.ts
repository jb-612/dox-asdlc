/**
 * Compute exponential backoff delay with jitter (P15-F14).
 * Formula: baseMs * 2^attempt + random(0, baseMs)
 */
const MAX_BACKOFF_MS = 60_000;

export function computeBackoffMs(attempt: number, baseMs: number): number {
  if (baseMs === 0) return 0;
  const exponential = baseMs * Math.pow(2, attempt);
  const jitter = Math.random() * baseMs;
  return Math.min(Math.floor(exponential + jitter), MAX_BACKOFF_MS);
}

// ---------------------------------------------------------------------------
// Timeout utilities (P15-F14)
// ---------------------------------------------------------------------------

/** Compute progressive timeout: +50% per retry attempt, capped at 2x original. */
export function computeProgressiveTimeout(baseTimeoutMs: number, attempt: number): number {
  const multiplier = Math.min(1 + attempt * 0.5, 2);
  return Math.floor(baseTimeoutMs * multiplier);
}

export interface WorkflowTimeoutParams {
  sequentialTimeoutMs: number;
  maxParallelTimeoutMs: number;
  overrideSeconds?: number;
}

/** Compute workflow-level timeout: override or auto = sum(seq) + max(parallel) + 20%. */
export function computeWorkflowTimeout(params: WorkflowTimeoutParams): number {
  if (params.overrideSeconds != null) {
    return params.overrideSeconds * 1000;
  }
  const autoMs = params.sequentialTimeoutMs + params.maxParallelTimeoutMs;
  return Math.floor(autoMs * 1.2);
}

// ---------------------------------------------------------------------------
// executeWithRetry (P15-F14)
// ---------------------------------------------------------------------------

export interface RetryPolicy {
  maxRetries: number;
  retryableExitCodes: number[];
  backoffBaseMs: number;
  nodeId: string;
}

export interface RetryCallbacks {
  emitEvent: (type: string, data?: unknown) => void;
  isAborted: () => boolean;
  sleep: (ms: number) => Promise<void>;
}

export interface AttemptResult {
  exitCode: number;
}

function isRetryable(exitCode: number, retryableExitCodes: number[]): boolean {
  if (exitCode === 0) return false;
  if (exitCode === -1) return true; // timeout
  return retryableExitCodes.includes(exitCode);
}

/**
 * Execute an attempt function with retry logic (P15-F14). CC=4
 */
export async function executeWithRetry(
  attemptFn: () => Promise<AttemptResult>,
  policy: RetryPolicy,
  callbacks: RetryCallbacks,
): Promise<AttemptResult> {
  let lastResult: AttemptResult = { exitCode: -1 };

  for (let attempt = 0; attempt <= policy.maxRetries; attempt++) {
    if (callbacks.isAborted()) break;

    lastResult = await attemptFn();

    if (!isRetryable(lastResult.exitCode, policy.retryableExitCodes)) break;
    if (attempt >= policy.maxRetries) {
      callbacks.emitEvent('node_retry_exhausted', { nodeId: policy.nodeId, attempts: attempt + 1 });
      break;
    }

    const delayMs = computeBackoffMs(attempt, policy.backoffBaseMs);
    await callbacks.sleep(delayMs);

    if (callbacks.isAborted()) break;

    callbacks.emitEvent('node_retry', { attempt: attempt + 1, maxRetries: policy.maxRetries, nodeId: policy.nodeId });
  }

  return lastResult;
}
