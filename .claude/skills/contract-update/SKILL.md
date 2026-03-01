---
name: contract-update
description: Guides proposing, negotiating, and publishing API contract changes. Use when modifying contracts/, adding endpoints, or changing schemas.
argument-hint: "[contract-name]"
disable-model-invocation: true
---

Update contract $ARGUMENTS:

## Step 1: Draft the Change

Create a proposal in `contracts/proposed/`:

```bash
touch contracts/proposed/$(date +%Y-%m-%d)-$ARGUMENTS.json
```

Proposal format:
```json
{
  "contract": "$ARGUMENTS",
  "current_version": "1.0.0",
  "proposed_version": "1.1.0",
  "change_type": "minor",
  "description": "Description of change",
  "changes": [
    {
      "action": "add|modify|remove",
      "path": "path.to.field",
      "value": { ... }
    }
  ],
  "breaking": false,
  "migration_notes": null
}
```

## Step 2: Notify Consumers

```bash
./scripts/coordination/publish-message.sh CONTRACT_CHANGE_PROPOSED $ARGUMENTS "Brief description"
```

## Step 3: Wait for Acknowledgment

Consumer will review and respond via:
```bash
./scripts/coordination/ack-message.sh <message-id>
```

If concerns raised, iterate on proposal until agreement.

## Step 4: Publish the Change

After ACK received:

1. Create version directory:
   ```bash
   mkdir -p contracts/versions/v{new_version}
   ```

2. Copy and update contract:
   ```bash
   cp contracts/versions/v{old}/contract.json contracts/versions/v{new}/
   # Apply changes, update version field
   ```

3. Update symlinks:
   ```bash
   cd contracts/current
   rm contract.json
   ln -s ../versions/v{new}/contract.json contract.json
   ```

4. Update CHANGELOG.md:
   ```markdown
   ## [{new_version}] - {date}
   ### Added/Changed/Removed
   - Description of change
   ```

5. Clean up proposal:
   ```bash
   rm contracts/proposed/{proposal-file}.json
   ```

6. Commit:
   ```bash
   git commit -m "contract($ARGUMENTS): v{new} - {description}"
   ```

## Step 5: Notify Completion

```bash
./scripts/coordination/publish-message.sh CONTRACT_PUBLISHED $ARGUMENTS "v{new} published"
```

## Version Bump Rules

| Change Type | Version | Requires ACK |
|-------------|---------|--------------|
| Add optional field | PATCH | Recommended |
| Add endpoint/schema | MINOR | Required |
| Change/remove field | MAJOR | Required |
