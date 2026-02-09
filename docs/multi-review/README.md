# Multi-Review: Parallel AI Code Review System

Multi-Review spawns 4 parallel AI code reviewers via [mprocs](https://github.com/pvolok/mprocs), each with a different focus area. Reviews run concurrently in a terminal multiplexer, and results are synthesized into a unified findings report by Claude.

Currently configured for **Gemini CLI** and **Codex CLI**, but extensible to any CLI tool that accepts a prompt and produces text output.

## Architecture

```
scripts/multi-review.sh              Main launcher script
scripts/review-config.json           Reviewer configuration (CLI, model, focus, checklist)
.claude/skills/multi-review/SKILL.md Claude Code skill for invoking from chat
code-reviews/                        Output directory (gitignored)
```

## How It Works

1. Reads the reviewer config JSON defining 4 reviewers with different focus areas.
2. Generates tailored prompt files for each reviewer containing project context, the file list to review, and a focus-specific checklist.
3. Generates a `mprocs.yaml` config dynamically with one process per reviewer.
4. Launches mprocs in a new terminal window showing all 4 reviewers running in parallel.
5. Each reviewer writes structured markdown to a shared timestamped output directory.
6. After completion, Claude synthesizes all reviews into a deduplicated findings report.

## Default Reviewers

| Reviewer | CLI | Model | Focus |
|----------|-----|-------|-------|
| gemini-security | Gemini | gemini-2.5-pro | Security and Data Flow |
| gemini-architecture | Gemini | gemini-2.5-pro | Architecture and Design Patterns |
| codex-quality | Codex | gpt-5.3-codex | Code Quality and Error Handling |
| codex-testing | Codex | gpt-5.3-codex | Test Coverage and Edge Cases |

## Prerequisites

| Tool | Install | Purpose |
|------|---------|---------|
| `mprocs` | `brew install mprocs` | Terminal multiplexer for parallel processes |
| `gemini` | [Gemini CLI](https://github.com/google-gemini/gemini-cli) | Google Gemini AI CLI |
| `codex` | [Codex CLI](https://github.com/openai/codex) | OpenAI Codex AI CLI |
| `jq` | `brew install jq` | JSON processor |
| `python3` | System or `brew install python` | Prompt generation |

## Usage

```bash
# Default: review guardrails feature
./scripts/multi-review.sh

# Custom feature name
./scripts/multi-review.sh --feature my-feature

# Custom config
./scripts/multi-review.sh --config path/to/config.json

# Dry run (generate prompts and config without launching)
./scripts/multi-review.sh --dry-run
```

### Invoking from Claude Code

The multi-review skill is registered as a Claude Code skill. Invoke it from chat:

```
/multi-review
/multi-review --feature my-feature
```

The skill launches mprocs in a new Terminal window via osascript, then polls for results and synthesizes them when all reviewers complete.

## Output Structure

```
code-reviews/
  2026-02-09T08-53-guardrails/
    prompts/
      gemini-security.txt
      gemini-architecture.txt
      codex-quality.txt
      codex-testing.txt
    gemini-security.md            # Review output
    gemini-architecture.md
    codex-quality.md
    codex-testing.md
    gemini-security.log           # stderr logs
    gemini-architecture.log
    codex-quality.log
    codex-testing.log
    mprocs.yaml                   # Generated mprocs config
    synthesis.md                  # Claude's merged analysis
```

## Customizing Reviewers

The `scripts/review-config.json` file defines each reviewer:

```json
{
  "reviewer_name": {
    "cli": "gemini|codex",
    "model": "model-name",
    "focus": "Human-readable focus area",
    "slug": "output-file-prefix",
    "flags": "CLI-specific flags",
    "checklist": [
      "Item 1 to check",
      "Item 2 to check"
    ]
  }
}
```

To add a new reviewer, add another entry to the JSON. To change focus areas, modify the `checklist` array. The launcher script reads all top-level keys and generates a prompt and mprocs process for each one.

### Supported CLI Types

| CLI | How prompts are passed | Output capture |
|-----|------------------------|----------------|
| `gemini` | `-p "$(cat prompt.txt)"` with `--yolo -o text` | stdout redirected to `.md` file |
| `codex` | `exec - < prompt.txt` with `--sandbox read-only` | `-o` flag writes to `.md` file |

## Error Handling

- **Gemini retries:** Up to 5 attempts with exponential backoff (15s, 30s, 45s, 60s, 75s) to handle ECONNRESET and transient API errors.
- **Gemini staggering:** Gemini reviewers are staggered by 15 seconds to avoid API rate limits.
- **Empty output detection:** After all retries, the script checks for empty output files. An empty `.md` file indicates a failed review.
- **Log files:** Each reviewer writes stderr to a corresponding `.log` file for debugging.
- **Synthesis reporting:** Claude's synthesis step reports which reviewers completed versus failed, so gaps in coverage are visible.

## Synthesis Process

After mprocs completes (all processes show DOWN), invoke the skill again or ask Claude to synthesize. The synthesis process:

1. Reads all completed `.md` files from the output directory.
2. Deduplicates findings across reviewers -- if multiple reviewers found the same issue, it is merged into a single finding.
3. Uses the highest severity when reviewers disagree on severity for the same finding.
4. Notes consensus findings (flagged by multiple reviewers) as higher confidence.
5. Writes `synthesis.md` with a unified findings list, reviewer agreement matrix, and statistics.

## Extending to Other CLI Tools

To add support for a new AI CLI tool:

1. Add an entry to `review-config.json` with `"cli": "your-tool"`.
2. Edit the mprocs generation block in `scripts/multi-review.sh` to add an `elif` branch for the new CLI, specifying how to pass the prompt and capture output.
3. The prompt format and output parsing remain the same regardless of CLI tool.
