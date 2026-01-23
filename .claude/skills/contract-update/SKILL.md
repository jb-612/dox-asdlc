# Contract Update Skill

## Overview

This skill guides the process of proposing, negotiating, and publishing contract changes in the parallel CLI coordination system.

## When to Use

Use this skill when you need to:
- Add a new endpoint to an API contract
- Modify an existing schema definition
- Add new event types
- Change interface signatures
- Update any file in `contracts/`

## Prerequisites

1. Verify your session was started with a launcher script:
   ```bash
   cat .claude/instance-identity.json | python3 -c "import json,sys; print(json.load(sys.stdin).get('instance_id', 'NOT SET'))"
   ```

2. Confirm you are the owner or have coordinated with the owner of the contract you're modifying.

## Workflow

### Step 1: Draft the Change

Create a new file in `contracts/proposed/` describing your change:

```bash
# Naming convention: YYYY-MM-DD-<contract>-<brief-description>.json
touch contracts/proposed/2026-01-22-hitl_api-add-metrics-endpoint.json
```

**Proposed change format:**
```json
{
  "contract": "hitl_api",
  "current_version": "1.0.0",
  "proposed_version": "1.1.0",
  "proposer": "agent",
  "timestamp": "2026-01-22T20:00:00Z",
  "change_type": "minor",
  "description": "Add metrics endpoint for worker performance monitoring",
  "changes": [
    {
      "action": "add",
      "path": "endpoints['GET /metrics']",
      "value": {
        "description": "Get worker performance metrics",
        "response": { "$ref": "#/definitions/MetricsResponse" }
      }
    },
    {
      "action": "add",
      "path": "definitions.MetricsResponse",
      "value": {
        "type": "object",
        "properties": {
          "avg_task_duration_ms": { "type": "number" },
          "tasks_completed": { "type": "integer" }
        }
      }
    }
  ],
  "breaking": false,
  "migration_notes": null
}
```

### Step 2: Notify Consumers

Publish a coordination message:

```bash
./scripts/coordination/publish-message.sh CONTRACT_CHANGE_PROPOSED hitl_api "Add metrics endpoint"
```

This creates a message in `.claude/coordination/messages/` that the consumer instance will see.

### Step 3: Wait for Acknowledgment

The consumer instance should:
1. Review the proposed change
2. Test compatibility with their code
3. Acknowledge via:
   ```bash
   ./scripts/coordination/ack-message.sh <message-id>
   ```

**If the consumer has concerns:**
- They will publish a response message with type `CONTRACT_DISCUSSION`
- Iterate on the proposal until agreement is reached
- Update the proposed change file

### Step 4: Publish the Change

Once ACK is received:

1. **Determine new version number:**
   - MAJOR: Breaking changes
   - MINOR: New features, backward compatible
   - PATCH: Bug fixes, documentation

2. **Create new version directory:**
   ```bash
   mkdir -p contracts/versions/v1.1.0
   ```

3. **Copy and update the contract:**
   ```bash
   cp contracts/versions/v1.0.0/hitl_api.json contracts/versions/v1.1.0/
   # Edit to incorporate the changes
   # Update "version": "1.1.0"
   ```

4. **Update symlinks:**
   ```bash
   cd contracts/current
   rm hitl_api.json
   ln -s ../versions/v1.1.0/hitl_api.json hitl_api.json
   ```

5. **Update CHANGELOG.md:**
   ```markdown
   ## [1.1.0] - 2026-01-22

   ### Added
   - **hitl_api.json**: Added `GET /metrics` endpoint for worker performance monitoring
   ```

6. **Clean up:**
   ```bash
   rm contracts/proposed/2026-01-22-hitl_api-add-metrics-endpoint.json
   ```

7. **Commit:**
   ```bash
   git add contracts/
   git commit -m "contract(hitl_api): v1.1.0 - Add metrics endpoint"
   ```

### Step 5: Notify Completion

```bash
./scripts/coordination/publish-message.sh CONTRACT_PUBLISHED hitl_api "v1.1.0 published"
```

## Breaking Changes

For breaking changes (MAJOR version):

1. **Clearly document migration path** in the proposed change
2. **Allow consumer time to adapt** before publishing
3. **Consider providing both old and new versions** temporarily
4. **Update migration_notes** with step-by-step instructions

## Quick Reference

| Change Type | Version Bump | Requires ACK |
|-------------|--------------|--------------|
| Add optional field | PATCH | Recommended |
| Add new endpoint | MINOR | Required |
| Add new schema | MINOR | Required |
| Change field type | MAJOR | Required |
| Remove endpoint | MAJOR | Required |
| Rename field | MAJOR | Required |

## Example: Adding a New Event Type

```json
{
  "contract": "events",
  "current_version": "1.0.0",
  "proposed_version": "1.1.0",
  "proposer": "agent",
  "change_type": "minor",
  "description": "Add METRICS_COLLECTED event type",
  "changes": [
    {
      "action": "add",
      "path": "definitions.EventType.enum",
      "value": "metrics_collected"
    }
  ],
  "breaking": false
}
```

## Troubleshooting

**Consumer not responding:**
- Check `.claude/coordination/status.json` to see if they're active
- Leave a detailed note in the proposal file
- Consider reaching out via alternative means

**Conflicting changes:**
- If both instances propose changes to the same contract simultaneously
- Coordinate via messages to merge proposals
- One instance should consolidate and re-propose

**Rollback needed:**
- Update symlinks to point to previous version
- Document reason in CHANGELOG.md
- Notify all consumers
