import type { ExecutionEvent, ExecutionEventType } from '../../shared/types/execution';

// ---------------------------------------------------------------------------
// FormattedEvent shape for EventLogPanel
// ---------------------------------------------------------------------------

export interface FormattedEvent {
  timestamp: string;
  icon: string;
  text: string;
  nodeId?: string;
}

// ---------------------------------------------------------------------------
// Icon map per event type
// ---------------------------------------------------------------------------

const EVENT_ICONS: Record<ExecutionEventType, string> = {
  execution_started: '\u25B6',       // play
  execution_paused: '\u23F8',        // pause
  execution_resumed: '\u25B6',       // play
  execution_completed: '\u2714',     // checkmark
  execution_failed: '\u2718',        // cross
  execution_aborted: '\u26D4',       // stop
  node_started: '\u25B6',            // play
  node_completed: '\u2714',          // checkmark
  node_failed: '\u2718',             // cross
  node_skipped: '\u23ED',            // skip
  gate_waiting: '\u23F3',            // hourglass
  gate_decided: '\u2714',            // checkmark
  cli_output: '\u25B8',              // right arrow
  cli_error: '\u26A0',               // warning
  cli_exit: '\u23F9',                // stop
  variable_updated: '\u270E',        // pencil
  tool_call: '\u2699',               // gear
  bash_command: '$',                 // dollar
  block_gate_open: '\u{1F6AA}',      // door
  block_revision: '\u{1F504}',       // cycle arrows
};

// ---------------------------------------------------------------------------
// Timestamp formatter
// ---------------------------------------------------------------------------

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-GB', { hour12: false });
  } catch {
    return '--:--:--';
  }
}

// ---------------------------------------------------------------------------
// Public formatter
// ---------------------------------------------------------------------------

/**
 * Format an ExecutionEvent into a display-friendly shape for the EventLogPanel.
 *
 * @param event      The raw execution event.
 * @param nodeLabel  Optional human-readable label for the node (used to enrich text).
 * @returns          A FormattedEvent with timestamp, icon, text, and optional nodeId.
 */
export function formatEvent(
  event: ExecutionEvent,
  nodeLabel?: string,
): FormattedEvent {
  const icon = EVENT_ICONS[event.type] ?? '\u2022'; // bullet fallback

  // Build display text -- use the event message directly
  const text = event.message;

  return {
    timestamp: formatTimestamp(event.timestamp),
    icon,
    text,
    nodeId: event.nodeId,
  };
}
