---
description: Environment-aware permissions - different rules for workstation vs container/K8s
paths:
  - "**/*"
---

# Environment-Aware Permissions

Permissions in this project vary based on the execution environment. A developer workstation requires restrictions because actions can affect the host system. A container or Kubernetes pod is isolated and disposable, so full freedom is appropriate.

## Permission Model Overview

| Environment | Restrictions | HITL Gates |
|-------------|--------------|------------|
| Workstation | Active | Mandatory for destructive ops |
| Container | None | None |
| Kubernetes | None | None |

The system uses three permission tiers:
1. **Tier 1: Pre-granted** - Always allowed via settings.json
2. **Tier 2: Agent-specific** - Granted when invoking specific agents
3. **Tier 3: Forwarded** - Requires user decision via PM CLI

## Environment Detection

```
+--------------------------------------------------+
|           Environment Detection                   |
+--------------------------------------------------+
|                                                   |
|  Check 1: Does /.dockerenv exist?                |
|  Check 2: Is KUBERNETES_SERVICE_HOST set?        |
|                                                   |
|  If EITHER is true -> CONTAINER/K8S environment  |
|  If BOTH are false -> WORKSTATION environment    |
|                                                   |
+--------------------------------------------------+
```

### Detection Code

```bash
# Determine execution environment
ISOLATED=false

# Check if running in container
if [ -f "/.dockerenv" ]; then
    ISOLATED=true
fi

# Check if running in Kubernetes
if [ -n "$KUBERNETES_SERVICE_HOST" ]; then
    ISOLATED=true
fi
```

## Permission Tiers

### Tier 1: Pre-Granted (settings.json)

These permissions are always allowed regardless of environment. They are configured in the project settings.json file.

**Read/Write/Edit Tools:**
- Path-restricted per agent (see parallel-coordination.md for path restrictions)
- Backend: `src/workers/`, `src/orchestrator/`, `src/infrastructure/`, `src/core/`
- Frontend: `src/hitl_ui/`, `docker/hitl-ui/`
- Orchestrator: All paths, exclusive ownership of `contracts/`, `.claude/`, `docs/`

**Test Commands:**
- `pytest` - Python unit and integration tests
- `npm test` - JavaScript/TypeScript tests
- `npm run lint` - Linting checks

**Git Read-Only:**
- `git status` - Working tree status
- `git diff` - Show changes
- `git log` - Commit history
- `git branch` - List branches

**Coordination:**
- All `mcp__coordination__*` tools
- `mcp__ide__getDiagnostics`

### Tier 2: Agent-Specific (allowed_tools in Task call)

Additional permissions granted when invoking specific agents. These are passed via the `allowed_tools` parameter in the Task call.

| Agent | Additional Permissions |
|-------|------------------------|
| backend | python, pip, docker build |
| frontend | npm, npx, node |
| devops | docker, kubectl, helm, cloud CLIs |
| orchestrator | git commit, gh issue |

**Example Task invocation:**

```
Task(agent: backend, allowed_tools: [python, pip, docker build])
Task(agent: frontend, allowed_tools: [npm, npx, node])
Task(agent: devops, allowed_tools: [docker, kubectl, helm])
Task(agent: orchestrator, allowed_tools: [git commit, gh])
```

### Tier 3: Forwarded to PM CLI (user decision)

These operations require explicit user approval. When an agent encounters one of these, it must return a permission request to the PM CLI, which prompts the user.

**Operations requiring approval:**
- Destructive operations (`rm -rf`, `delete`, `prune`)
- Cloud deployments to production
- Secrets access
- New tool installation
- Force flags (`--force`, `-f`)

## Workstation Restrictions

On a workstation (not in container), the following operations require HITL confirmation before execution.

```
RESTRICTED (require confirmation):
- rm -rf [any path]
- kubectl delete [any resource]
- helm uninstall [any release]
- docker system prune
- Any command with --force or -f flag
- git push --force
- git reset --hard
```

**Rationale:** These operations can cause data loss or affect the host system in ways that are difficult or impossible to reverse.

### HITL Gate for Workstation Destructive Operations

When a restricted operation is detected on a workstation:

```
Destructive operation on workstation: [command]
This cannot be undone.

Confirm? (Y/N)
```

The operation proceeds only with an explicit Y response.

## Container/K8s Full Freedom

When running inside a container or Kubernetes pod, all operations are allowed without confirmation.

```
ALLOWED (no confirmation needed):
- All bash commands
- Force flags permitted
- Destructive operations permitted
- Full kubectl/helm access
- Reason: Environment is isolated and disposable
```

**Rationale:** Containers and Kubernetes pods are ephemeral and isolated. Destructive operations cannot affect the host system. The environment can be recreated from scratch.

## Permission Forwarding

When a subagent needs a permission not in Tier 1 or Tier 2, it uses permission forwarding.

### Forwarding Flow

```
1. Subagent encounters permission block
2. Subagent returns: "PERMISSION_NEEDED: [tool] [args]"
3. PM CLI receives this and asks user via AskUserQuestion
4. If approved: PM CLI re-invokes subagent with allowed_tools including permission
5. If denied: PM CLI informs subagent, finds alternative approach
```

### PERMISSION_FORWARD Message Type

Subagents use the `PERMISSION_FORWARD` message type via Redis MCP:

| Field | Description |
|-------|-------------|
| type | `PERMISSION_FORWARD` |
| from | Subagent identifier |
| tool | Tool or command requiring permission |
| args | Arguments to the tool |
| reason | Why the permission is needed |

### PM CLI Response

PM CLI presents the request to the user:

```
Permission request from [agent]:
  Tool: [tool]
  Args: [args]
  Reason: [reason]

Approve? (Y/N)
```

## Settings.json Reference

The following permissions should be configured in `.claude/settings.json`:

### Allow List

```json
"Bash(python -m pytest:*)",
"Bash(npm test:*)",
"Bash(npm run lint:*)",
"Bash(docker build:*)",
"Bash(docker-compose up:*)",
"Bash(kubectl get:*)",
"Bash(kubectl describe:*)",
"Bash(kubectl logs:*)",
"Bash(helm list:*)",
"Bash(helm status:*)",
"mcp__coordination__*",
"mcp__ide__getDiagnostics"
```

### Deny List (Advisory on Workstation)

```json
"Bash(kubectl delete:*)",
"Bash(helm uninstall:*)",
"Bash(docker system prune:*)",
"Bash(rm -rf:*)"
```

**Note:** Deny rules are advisory on workstation environments. Enforcement happens via HITL gates rather than settings.json, since settings.json cannot be made environment-conditional. In container/K8s environments, these operations are allowed automatically.

## Summary Table

| Environment | Destructive Ops | Force Flags | HITL Required |
|-------------|-----------------|-------------|---------------|
| Workstation | Blocked | Blocked | Yes |
| Container | Allowed | Allowed | No |
| K8s Pod | Allowed | Allowed | No |

## Integration with Other Rules

This permission model integrates with:

- **hitl-gates.md**: Gate 4 (Destructive Workstation Operation) references this environment detection
- **parallel-coordination.md**: Path restrictions per agent apply to Tier 1 permissions
- **pm-cli.md**: PM CLI handles Tier 3 permission forwarding
- **devops.md**: DevOps agent has expanded Tier 2 permissions when invoked

## Troubleshooting

### Permission Denied on Workstation

If you encounter a permission block on workstation:

1. Check if the operation is in the restricted list above
2. If needed, confirm via the HITL gate when prompted
3. Consider if the operation is necessary or if an alternative exists

### Permission Expected but Blocked

If an operation you expect to be allowed is blocked:

1. Verify the correct agent is being used for the operation
2. Check that the agent's allowed_tools includes the required permission
3. Verify environment detection is working (check /.dockerenv and KUBERNETES_SERVICE_HOST)

### Permission Forwarding Loop

If permission forwarding seems stuck:

1. Check that PM CLI is receiving PERMISSION_FORWARD messages
2. Verify the user is responding to the AskUserQuestion prompt
3. Check that the re-invocation includes the approved permission in allowed_tools
