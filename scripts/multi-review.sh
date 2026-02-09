#!/usr/bin/env bash
# multi-review.sh - Launch parallel AI code reviews via mprocs
#
# Usage:
#   ./scripts/multi-review.sh [--config path/to/config.json] [--dry-run]
#
# Spawns 4 parallel reviewers (2 Gemini, 2 Codex) in mprocs,
# each writing structured review output to a shared timestamped folder.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_FILE="$SCRIPT_DIR/review-config.json"
DRY_RUN=false
FEATURE_NAME="guardrails"
FILES_FROM=""

# ---------- argument parsing ----------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --config)  CONFIG_FILE="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    --feature) FEATURE_NAME="$2"; shift 2 ;;
    --files-from) FILES_FROM="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--config path] [--dry-run] [--feature name] [--files-from path]"
      echo ""
      echo "  --config      Path to reviewer config JSON (default: scripts/review-config.json)"
      echo "  --dry-run     Generate files but don't launch mprocs"
      echo "  --feature     Feature slug for output dir (default: guardrails)"
      echo "  --files-from  Path to file containing list of files to review (one per line)"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ---------- prerequisites ----------
for cmd in mprocs gemini codex python3 jq; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "ERROR: $cmd is required but not found in PATH" >&2
    exit 1
  fi
done

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "ERROR: Config file not found: $CONFIG_FILE" >&2
  exit 1
fi

# ---------- output directory ----------
TIMESTAMP="$(date +%Y-%m-%dT%H-%M)"
OUTPUT_DIR="$PROJECT_ROOT/code-reviews/${TIMESTAMP}-${FEATURE_NAME}"
PROMPT_DIR="$OUTPUT_DIR/prompts"
mkdir -p "$PROMPT_DIR"

echo "=== Multi-Review Launcher ==="
echo "Config:  $CONFIG_FILE"
echo "Output:  $OUTPUT_DIR"
echo "Feature: $FEATURE_NAME"
echo ""

# ---------- collect files to review ----------
if [[ -n "$FILES_FROM" && -f "$FILES_FROM" ]]; then
  # Use externally provided file list
  FILES_TO_REVIEW=$(cat "$FILES_FROM")
elif [[ "$FEATURE_NAME" == "guardrails" ]]; then
  # Default: guardrails-related source and test files
  FILES_TO_REVIEW=$(cd "$PROJECT_ROOT" && find \
    src/core/guardrails \
    src/infrastructure/guardrails \
    src/orchestrator/routes/guardrails_api.py \
    src/orchestrator/api/models/guardrails.py \
    .claude/hooks/guardrails-inject.py \
    .claude/hooks/guardrails-enforce.py \
    .claude/hooks/guardrails-subagent.py \
    scripts/bootstrap_guardrails.py \
    tests/unit/core \
    tests/unit/infrastructure/guardrails \
    tests/unit/hooks \
    tests/unit/orchestrator/routes/test_guardrails_api.py \
    tests/unit/orchestrator/routes/test_guardrails_crud.py \
    tests/unit/orchestrator/routes/test_guardrails_audit_evaluate.py \
    tests/unit/orchestrator/api/models/test_guardrails_models.py \
    tests/unit/scripts/test_bootstrap_guardrails.py \
    tests/integration/guardrails \
    -type f -name '*.py' 2>/dev/null | sort)
else
  # Generic: find all source files for the feature under docker/hitl-ui/src
  FILES_TO_REVIEW=$(cd "$PROJECT_ROOT" && find \
    docker/hitl-ui/src \
    -type f \( -name '*.ts' -o -name '*.tsx' \) 2>/dev/null | sort)
fi

FILE_COUNT=$(echo "$FILES_TO_REVIEW" | wc -l | tr -d ' ')
echo "Files to review: $FILE_COUNT"

# ---------- generate prompts ----------
generate_prompt() {
  local slug="$1"
  local focus="$2"
  local checklist_json="$3"

  # Convert JSON array to numbered checklist
  local checklist
  checklist=$(echo "$checklist_json" | python3 -c "
import sys, json
items = json.load(sys.stdin)
for i, item in enumerate(items, 1):
    print(f'{i}. {item}')
")

  # Select project context based on feature
  local project_context
  if [[ "$FEATURE_NAME" == "guardrails" ]]; then
    project_context="The Guardrails Configuration System (P11-F01) provides contextually-conditional rules
for agent behavior in an agentic software development lifecycle (aSDLC). Guidelines are
stored in Elasticsearch, evaluated at runtime against task context, and injected into
agent sessions via Claude Code hooks.

Key components:
- Core models (frozen dataclasses): Guideline, GuidelineCondition, GuidelineAction, TaskContext
- Evaluator: TTL-cached guideline matching with condition scoring and conflict resolution
- ES Store: Async CRUD with optimistic locking and append-only audit log
- MCP Server: guardrails_get_context and guardrails_log_decision tools
- REST API: FastAPI CRUD, evaluate, audit, import/export endpoints
- Hooks: UserPromptSubmit (inject), PreToolUse (enforce), SubagentStart (propagate)
- Bootstrap: 11 default guidelines from project rules"
  else
    project_context="The HITL (Human-In-The-Loop) UI is a React SPA built with Vite and TypeScript that serves
as the primary user interface for an agentic software development lifecycle (aSDLC) platform.
It has 542 source files across 22+ feature domains.

Key architecture:
- React with TypeScript, Vite build system
- API layer with mock-first design (mock and real backends switchable at runtime)
- React Query for server state management
- 22+ feature domains: agents, architect, artifacts, brainflare, cockpit, devops, docs, gates, guardrails, ideas, k8s, llm, metrics, review, search, services, sessions, studio, workers, admin, common, layout
- API client with hooks, REST services, and typed mock data
- Component library with shared UI components in common/
- Test files co-located with source files"
  fi

  cat > "$PROMPT_DIR/${slug}.txt" << PROMPT_EOF
# Code Review: ${FEATURE_NAME} SPA
## Focus Area: ${focus}

## Project Context

${project_context}

## Files to Review

${FILES_TO_REVIEW}

## Your Focus: ${focus}

Review ALL the files listed above with specific attention to:

${checklist}

## Output Format

Structure your review as markdown with:

### Summary
One paragraph overall assessment.

### Findings

For each finding:

#### [SEVERITY] Short title
- **File:** \`path/to/file.py:line_number\`
- **Category:** (from your focus area)
- **Description:** What the issue is
- **Impact:** Why it matters
- **Recommendation:** How to fix it

Severity levels: CRITICAL, HIGH, MEDIUM, LOW, INFO

### Statistics
- Files reviewed: N
- Findings by severity: CRITICAL: N, HIGH: N, MEDIUM: N, LOW: N, INFO: N
PROMPT_EOF

  echo "  Generated: prompts/${slug}.txt"
}

# Read config and generate prompts for each reviewer
REVIEWER_KEYS=$(jq -r 'keys[]' "$CONFIG_FILE")
for key in $REVIEWER_KEYS; do
  slug=$(jq -r ".\"$key\".slug" "$CONFIG_FILE")
  focus=$(jq -r ".\"$key\".focus" "$CONFIG_FILE")
  checklist=$(jq ".\"$key\".checklist" "$CONFIG_FILE")
  generate_prompt "$slug" "$focus" "$checklist"
done

echo ""

# ---------- generate mprocs.yaml ----------
MPROCS_CONFIG="$OUTPUT_DIR/mprocs.yaml"

{
  echo "procs:"

  gemini_index=0
  for key in $REVIEWER_KEYS; do
    cli=$(jq -r ".\"$key\".cli" "$CONFIG_FILE")
    model=$(jq -r ".\"$key\".model" "$CONFIG_FILE")
    slug=$(jq -r ".\"$key\".slug" "$CONFIG_FILE")
    flags=$(jq -r ".\"$key\".flags" "$CONFIG_FILE")

    prompt_file="$PROMPT_DIR/${slug}.txt"
    output_file="$OUTPUT_DIR/${slug}.md"
    log_file="$OUTPUT_DIR/${slug}.log"

    echo "  ${slug}:"

    if [[ "$cli" == "gemini" ]]; then
      # Stagger gemini launches by 15s to avoid API rate limits
      stagger_delay=$((gemini_index * 15))
      gemini_index=$((gemini_index + 1))

      # Gemini: -p "prompt" for headless, --yolo auto-approves, -o text for clean output
      # Retry up to 3 times with 10s backoff on failure
      cat << YAML_EOF
    shell: |
      if [ ${stagger_delay} -gt 0 ]; then
        echo "Waiting ${stagger_delay}s to stagger Gemini API calls..."
        sleep ${stagger_delay}
      fi
      echo "Starting ${slug} review at \$(date)..."
      for attempt in 1 2 3 4 5; do
        gemini -m ${model} --yolo -o text -p "\$(cat '${prompt_file}')" > '${output_file}' 2>'${log_file}'
        if [ -s '${output_file}' ]; then
          echo "Review completed on attempt \$attempt."
          break
        fi
        backoff=\$((attempt * 15))
        echo "Attempt \$attempt produced empty output (likely ECONNRESET). Retrying in \${backoff}s..."
        sleep \$backoff
      done
      if [ ! -s '${output_file}' ]; then
        echo "WARNING: All 5 attempts failed. Check ${log_file}"
      fi
      echo ""
      echo "=== ${slug} COMPLETE at \$(date) ==="
      echo "Output: ${output_file}"
    cwd: "${PROJECT_ROOT}"
YAML_EOF

    elif [[ "$cli" == "codex" ]]; then
      # Codex: exec with stdin prompt (-), read-only sandbox, output to file
      cat << YAML_EOF
    shell: |
      echo "Starting ${slug} review at \$(date)..."
      codex exec - -m ${model} --sandbox read-only -o '${output_file}' < '${prompt_file}' 2>'${log_file}'
      echo ""
      echo "=== ${slug} COMPLETE at \$(date) ==="
      echo "Output: ${output_file}"
    cwd: "${PROJECT_ROOT}"
YAML_EOF
    fi
  done
} > "$MPROCS_CONFIG"

echo "Generated: mprocs.yaml"
echo ""

# ---------- summary ----------
echo "=== Review Configuration ==="
for key in $REVIEWER_KEYS; do
  cli=$(jq -r ".\"$key\".cli" "$CONFIG_FILE")
  model=$(jq -r ".\"$key\".model" "$CONFIG_FILE")
  slug=$(jq -r ".\"$key\".slug" "$CONFIG_FILE")
  focus=$(jq -r ".\"$key\".focus" "$CONFIG_FILE")
  echo "  ${slug}: ${cli} (${model}) - ${focus}"
done
echo ""
echo "Output directory: $OUTPUT_DIR"
echo ""

if [[ "$DRY_RUN" == "true" ]]; then
  echo "[DRY RUN] Would launch: mprocs --config $MPROCS_CONFIG"
  echo ""
  echo "Generated files:"
  find "$OUTPUT_DIR" -type f | sort | while read -r f; do
    echo "  $f"
  done
  exit 0
fi

# ---------- launch mprocs ----------
echo "Launching mprocs with 4 parallel reviewers..."
echo "  - Switch between panes with arrow keys or mouse"
echo "  - Press 'q' to quit mprocs after all reviews complete"
echo ""

exec mprocs --config "$MPROCS_CONFIG"
