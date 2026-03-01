---
name: multi-review
description: Launch parallel AI code reviews using mprocs with Gemini and Codex CLIs. Opens a new Terminal window with 4 parallel reviewers, then polls and synthesizes results.
argument-hint: "[scope or file-path]"
---

# Multi-Review: Parallel AI Code Review

Launch 4 parallel AI reviewers (2 Gemini, 2 Codex) in a new Terminal window via mprocs, then synthesize results.

## Arguments

`$ARGUMENTS` is optional. Format: `[--feature name] [--config path]`

If no arguments, defaults to reviewing the guardrails feature with the standard config.

## Step 1: Determine Parameters

Parse `$ARGUMENTS` for:
- `--feature <name>`: Feature slug (default: `guardrails`)
- `--config <path>`: Config file path (default: `scripts/review-config.json`)

Set variables:
```
FEATURE = extracted feature name or "guardrails"
CONFIG = extracted config path or "scripts/review-config.json"
PROJECT_DIR = current working directory
```

## Step 2: Verify Prerequisites

Before launching, verify the tools exist:

```bash
which mprocs gemini codex jq python3
```

If any are missing, report which ones and stop.

Verify the config file exists:

```bash
ls scripts/review-config.json
```

## Step 3: Launch in New Terminal

Use osascript to open a new macOS Terminal window and run the multi-review script:

```bash
osascript -e "tell application \"Terminal\"
    activate
    do script \"cd '${PROJECT_DIR}' && ./scripts/multi-review.sh --feature ${FEATURE} --config ${CONFIG}\"
end tell"
```

Report to the user:
```
Multi-review launched in new Terminal window.
- 4 parallel reviewers running via mprocs
- Output directory: code-reviews/<timestamp>-<feature>/

Switch to Terminal to watch progress. Come back here when all 4 processes show DOWN.
```

## Step 4: Poll for Results

After launching, periodically check the latest output directory for completed reviews:

```bash
# Find the latest output directory
LATEST=$(ls -dt code-reviews/*-${FEATURE}/ 2>/dev/null | head -1)

# Check file sizes
ls -la ${LATEST}/*.md 2>/dev/null
```

Report status of each reviewer:
- File exists and non-empty = Complete
- File exists but empty = Failed (check .log file)
- File doesn't exist = Still running

When the user says results are ready, or when all 4 .md files are non-empty, proceed to Step 5.

## Step 5: Synthesize Results

Read all completed review files:

```
Read: ${LATEST}/gemini-security.md
Read: ${LATEST}/gemini-architecture.md
Read: ${LATEST}/codex-quality.md
Read: ${LATEST}/codex-testing.md
```

For any empty files, check the corresponding .log file to report why it failed.

Create a synthesis by:

1. **Deduplicate findings** - If multiple reviewers found the same issue, merge into one finding with the highest severity
2. **Categorize** - Group findings by: Critical, High, Medium, Low, Info
3. **Cross-reference** - Note which reviewers agreed on each finding (consensus = higher confidence)
4. **Summarize** - Overall assessment combining all reviewer perspectives

Write the synthesis to `${LATEST}/synthesis.md` with this structure:

```markdown
# Code Review Synthesis: P11-F01 Guardrails Configuration System

## Review Sources
- gemini-security: [status]
- gemini-architecture: [status]
- codex-quality: [status]
- codex-testing: [status]

## Executive Summary
[1-2 paragraph overall assessment]

## Critical & High Findings
[Deduplicated findings with highest severity, noting which reviewers flagged each]

## Medium Findings
[...]

## Low & Informational
[...]

## Reviewer Agreement Matrix
[Table showing which findings were caught by multiple reviewers]

## Statistics
- Total unique findings: N
- By severity: CRITICAL: N, HIGH: N, MEDIUM: N, LOW: N, INFO: N
- Reviewer coverage: N/4 reviewers completed
```

## Step 6: Create Issues (Optional)

Ask the user if they want GitHub issues created for Critical and High findings:

```
Found N critical/high findings. Create GitHub issues? (Y/N)
```

If yes, for each critical/high finding:
```bash
gh issue create --title "REVIEW: [finding title]" --body "[description]" --label "bug"
```
