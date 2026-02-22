# ADR: Cursor CLI as Stateless Agent Backend

**Status:** Accepted
**Date:** 2026-02-21
**Decision Makers:** PM CLI, Orchestrator

## Context

The aSDLC project's P14 Workflow Studio executes workflows as directed acyclic graphs (DAGs) of agent nodes. The execution engine currently supports Claude Code CLI running locally on the workstation. Adding Cursor CLI as an additional agent backend enables workflow nodes to target a different AI coding assistant, running in a dedicated Docker container. The Electron app dispatches individual workflow nodes as HTTP requests to this container.

The key question is how to integrate Cursor CLI given its different flag conventions, configuration paths, and missing features relative to Claude Code CLI.

## Gap Analysis

| Capability | Claude Code | Cursor CLI | Impact |
|------------|-------------|------------|--------|
| Max turns | `--max-turns N` | Not supported | Timeout-based limit in wrapper |
| Budget control | `--max-budget-usd N` | Not supported | External monitoring only |
| System prompt | `--system-prompt "text"` | Not supported | Use `.cursor/rules/` directory |
| JSON schema | `--json-schema '{...}'` | Not supported | Parse text output |
| Inline tool allowlist | `--allowedTools "tool1,tool2"` | Not supported | Use `.cursor/cli.json` |
| Permission skip | `--dangerously-skip-permissions` | `--force` | Different flag name |
| Session resume | `--resume session-id` | `--resume [chatId]` | Both supported |
| Background/cloud | Not supported | `-b` / `&` prefix | Future opportunity |
| MCP config | `.mcp.json` | `mcp.json` | Different filename |
| Project rules | `.claude/rules/` | `.cursor/rules/` | Different directory |
| Permissions file | `.claude/settings.json` | `.cursor/cli.json` | Different format |
| Binary name | `claude` | `agent` | Different executable |
| API key env var | `ANTHROPIC_API_KEY` | `CURSOR_API_KEY` | Different variable |
| Modes | N/A | `--mode agent\|plan\|ask` | Cursor has explicit modes |

## Permission Format Mapping

Claude Code and Cursor CLI use different permission syntaxes:

| Claude Code Format | Cursor CLI Format |
|--------------------|-------------------|
| `Bash(git:*)` | `Shell(git)` |
| `Read(./**)` | `Read(src/**)` |

The HTTP wrapper must translate permission configurations when generating `.cursor/cli.json` from the existing `.claude/settings.json` definitions.

## Workarounds for Gaps

| Gap | Workaround |
|-----|------------|
| No `--max-turns` | HTTP wrapper enforces wall-clock timeout |
| No `--max-budget-usd` | Log cost from JSON response; external monitoring |
| No `--system-prompt` | Mount `.cursor/rules/{role}.mdc` per agent role |
| No `--json-schema` | Parse `result` field from JSON output |
| No `--allowedTools` inline | Pre-generate `.cursor/cli.json` per request |

## Decision

Create a new minimal `docker/cursor-agent/` container with Node.js Alpine base, Express HTTP wrapper, and the Cursor CLI binary. The container accepts single targeted tasks via HTTP POST, executes them via the Cursor CLI, and returns JSON results. This approach avoids coupling with the existing Python-based workers container.

The container architecture:
- **Base image:** Node.js Alpine
- **HTTP layer:** Express server accepting POST requests
- **Execution:** Spawns `agent` CLI process per request
- **Configuration:** Mounts `.cursor/rules/` and generates `.cursor/cli.json` dynamically per request
- **Isolation:** Each request gets a fresh working directory with the repository mounted read-write

## Consequences

### Positive
- Minimal coupling with existing Python workers infrastructure
- Dedicated container enables independent scaling and resource limits
- Simple HTTP API aligns with the Workflow Studio execution engine's dispatch model
- Permission translation layer centralizes the Claude-to-Cursor mapping
- Future opportunity to leverage Cursor's background/cloud mode for async execution

### Negative
- Additional container to build, test, and maintain
- Introduces a separate Node.js stack alongside the Python workers
- Cursor CLI gaps (no budget control, no max-turns) require workaround logic in the wrapper
- Permission format differences add a translation layer that must stay in sync

## References

- Cursor CLI documentation
- P14 Workflow Studio execution engine: `.workitems/P14-*`
- Docker container patterns: `docker/`
- Existing Claude Code integration: `src/workers/`
