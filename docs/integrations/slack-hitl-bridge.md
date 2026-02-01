# Slack HITL Bridge

The Slack HITL Bridge provides human-in-the-loop gate approvals directly from Slack. Instead of monitoring the HITL UI, reviewers receive notifications in Slack channels and can approve or reject gates with a button click.

## Overview

The bridge handles three main flows:

1. **Gate Notifications (OUT)** - When a gate is requested, a message appears in Slack with Approve/Reject buttons
2. **Decision Capture (IN)** - Button clicks publish GATE_APPROVED or GATE_REJECTED events
3. **Ideas Ingestion (IN)** - Messages or reactions in designated channels create ideas in Mindflare Hub

## Prerequisites

Before setting up the Slack Bridge, ensure you have:

- A Slack workspace with admin access
- Redis instance running (for event streams)
- HITL UI deployed (for evidence links)

---

## Part 1: Slack App Setup

### Step 1: Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click **Create New App**
3. Select **From scratch**
4. Enter app name: `aSDLC HITL Bridge`
5. Select your workspace
6. Click **Create App**

### Step 2: Configure OAuth Scopes

Navigate to **OAuth & Permissions** in the sidebar and add these Bot Token Scopes:

| Scope | Purpose |
|-------|---------|
| `chat:write` | Post gate request messages to channels |
| `reactions:write` | Add confirmation reactions to captured ideas |
| `reactions:read` | Read reactions for idea capture |
| `channels:history` | Fetch message content for reaction-based ideas |
| `users:read` | Look up user names for audit logging |

Click **Install to Workspace** and authorize the app.

### Step 3: Enable Socket Mode

Socket Mode allows the bridge to receive events without exposing a public webhook URL.

1. Navigate to **Socket Mode** in the sidebar
2. Toggle **Enable Socket Mode** to On
3. When prompted, create an App-Level Token:
   - Token name: `socket-mode-token`
   - Scope: `connections:write`
4. Click **Generate**
5. **Save the token** (starts with `xapp-`) - you will need this for configuration

### Step 4: Subscribe to Events

Navigate to **Event Subscriptions** and toggle **Enable Events** to On.

Under **Subscribe to bot events**, add:

| Event | Purpose |
|-------|---------|
| `message.channels` | Capture ideas from designated channels |
| `reaction_added` | Capture ideas via emoji reactions |

Click **Save Changes**.

### Step 5: Enable Interactivity

Navigate to **Interactivity & Shortcuts** and toggle **Interactivity** to On.

This enables the Approve/Reject buttons in gate messages. Since we use Socket Mode, no Request URL is needed.

Click **Save Changes**.

### Step 6: Collect Credentials

You need three credentials from your Slack app:

| Credential | Location | Format |
|------------|----------|--------|
| Bot Token | OAuth & Permissions > Bot User OAuth Token | `xoxb-...` |
| App Token | Basic Information > App-Level Tokens | `xapp-...` |
| Signing Secret | Basic Information > App Credentials | 32-character hex |

---

## Part 2: Token Types Explained

### Bot Token (xoxb-...)

The Bot Token authenticates API calls made on behalf of the bot user.

**Used for:**
- Posting messages to channels
- Updating messages after decisions
- Adding reactions
- Fetching user information

**Scope:** Bot tokens have the scopes you configured in OAuth & Permissions.

**Security:** Treat this as a secret. It grants write access to your workspace.

### App Token (xapp-...)

The App Token authenticates the WebSocket connection for Socket Mode.

**Used for:**
- Establishing the Socket Mode connection
- Receiving events in real-time
- Receiving interaction payloads (button clicks)

**Scope:** App tokens have app-level scopes (like `connections:write`), not bot scopes.

**Security:** This token only establishes the connection. Actual API calls still require the Bot Token.

### Signing Secret

The Signing Secret verifies that incoming requests originated from Slack.

**Used for:**
- Validating request signatures (when not using Socket Mode)
- Additional security verification

**Security:** Keep this secret. It prevents request forgery.

---

## Part 3: Configuration

### Configuration File Format

Create a JSON configuration file:

```json
{
  "bot_token": "xoxb-your-bot-token",
  "app_token": "xapp-your-app-token",
  "signing_secret": "your-signing-secret",
  "routing_policy": {
    "hitl_1_backlog": {
      "channel_id": "C0123456789",
      "required_role": "pm",
      "mention_users": [],
      "mention_groups": []
    },
    "hitl_2_design": {
      "channel_id": "C0123456789",
      "required_role": "architect",
      "mention_users": [],
      "mention_groups": []
    },
    "hitl_3_plan": {
      "channel_id": "C0123456789",
      "required_role": "lead",
      "mention_users": ["U9876543210"],
      "mention_groups": []
    },
    "hitl_4_code": {
      "channel_id": "C0987654321",
      "required_role": "reviewer",
      "mention_users": [],
      "mention_groups": ["S1234567890"]
    },
    "hitl_5_validation": {
      "channel_id": "C0987654321",
      "required_role": "qa",
      "mention_users": [],
      "mention_groups": []
    },
    "hitl_6_release": {
      "channel_id": "CABCDEFGHIJ",
      "required_role": "release_manager",
      "mention_users": [],
      "mention_groups": []
    }
  },
  "environment_overrides": {
    "production": {
      "hitl_6_release": {
        "channel_id": "CPRODRELEASE",
        "required_role": "release_manager",
        "mention_users": [],
        "mention_groups": ["SONCALL"]
      }
    }
  },
  "rbac_map": {
    "U001ALICE": ["pm", "architect", "lead"],
    "U002BOB": ["reviewer", "developer"],
    "U003CAROL": ["qa", "reviewer"],
    "U004DAVE": ["release_manager"]
  },
  "ideas_channels": ["C0IDEAS0001", "C0BRAINSTORM"],
  "ideas_emoji": "bulb",
  "consumer_group": "slack_bridge",
  "consumer_name": "bridge_1"
}
```

### Configuration Fields

| Field | Required | Description |
|-------|----------|-------------|
| `bot_token` | Yes | Slack Bot OAuth token |
| `app_token` | Yes | Slack App-level token for Socket Mode |
| `signing_secret` | Yes | Slack signing secret |
| `routing_policy` | Yes | Gate type to channel mapping |
| `environment_overrides` | No | Per-environment routing overrides |
| `rbac_map` | Yes | User ID to roles mapping |
| `ideas_channels` | No | Channels to monitor for ideas |
| `ideas_emoji` | No | Emoji for idea capture (default: `bulb`) |
| `consumer_group` | No | Redis consumer group name |
| `consumer_name` | No | Redis consumer instance name |

### Routing Policy

The `routing_policy` maps gate types to Slack channels:

```json
"routing_policy": {
  "hitl_4_code": {
    "channel_id": "C0987654321",
    "required_role": "reviewer",
    "mention_users": ["U001ALICE"],
    "mention_groups": ["S1234567890"]
  }
}
```

| Field | Description |
|-------|-------------|
| `channel_id` | Slack channel ID where gate messages are posted |
| `required_role` | Role required to approve/reject in this channel |
| `mention_users` | List of user IDs to @mention in notifications |
| `mention_groups` | List of user group IDs to @mention |

### Environment Variables

Alternatively, configure via environment variables:

```bash
export SLACK_BOT_TOKEN="xoxb-..."
export SLACK_APP_TOKEN="xapp-..."
export SLACK_SIGNING_SECRET="..."
export SLACK_CONFIG_FILE="/path/to/config.json"
```

---

## Part 4: RBAC Configuration

Role-Based Access Control (RBAC) ensures only authorized users can approve or reject gates.

### RBAC Map Format

The `rbac_map` associates Slack user IDs with roles:

```json
"rbac_map": {
  "U001ALICE": ["pm", "architect", "lead"],
  "U002BOB": ["reviewer", "developer"],
  "U003CAROL": ["qa", "reviewer"],
  "U004DAVE": ["release_manager"]
}
```

**Key format:** Slack user ID (starts with `U`)
**Value format:** Array of role names

### Role Definitions

Define roles that match your gate types:

| Role | Description | Typical Gate Types |
|------|-------------|-------------------|
| `pm` | Project manager, approves backlog items | `hitl_1_backlog` |
| `architect` | System architect, approves designs | `hitl_2_design` |
| `lead` | Tech lead, approves implementation plans | `hitl_3_plan` |
| `reviewer` | Code reviewer, approves code changes | `hitl_4_code` |
| `qa` | QA engineer, approves validation results | `hitl_5_validation` |
| `release_manager` | Release manager, approves deployments | `hitl_6_release` |

### Gate Type to Role Mapping

Each gate type in `routing_policy` specifies a `required_role`:

```
Gate Type          -> Required Role    -> Who Can Approve
-------------------------------------------------------------
hitl_1_backlog     -> pm               -> Project managers
hitl_2_design      -> architect        -> System architects
hitl_3_plan        -> lead             -> Tech leads
hitl_4_code        -> reviewer         -> Code reviewers
hitl_5_validation  -> qa               -> QA engineers
hitl_6_release     -> release_manager  -> Release managers
```

### How to Find Slack User IDs

**Method 1: Slack Profile**
1. Click on a user's profile picture
2. Click the three-dot menu
3. Click **Copy member ID**

**Method 2: API**
```bash
curl -H "Authorization: Bearer xoxb-your-token" \
  "https://slack.com/api/users.list" | jq '.members[] | {id, name}'
```

**Method 3: Slack Web Client**
1. Right-click on a username
2. Select **Copy link**
3. The URL contains the user ID: `slack.com/team/U001ALICE`

### User Group IDs

To mention entire groups (like `@oncall`), find the user group ID:

```bash
curl -H "Authorization: Bearer xoxb-your-token" \
  "https://slack.com/api/usergroups.list" | jq '.usergroups[] | {id, handle}'
```

User group IDs start with `S` (e.g., `S1234567890`).

### Best Practices for Role Assignment

1. **Principle of Least Privilege**
   - Assign only the roles a user needs
   - Avoid giving everyone all roles

2. **Separation of Duties**
   - Developers should not approve their own code
   - Use different reviewers for code vs. release gates

3. **Backup Coverage**
   - Assign at least 2 users per role
   - Prevents single points of failure during PTO

4. **Audit Trail**
   - All approvals are logged with the Slack user ID
   - Regularly review who has approval authority

### Example: Small Team Configuration

For a small team where people wear multiple hats:

```json
"rbac_map": {
  "U001ALICE": ["pm", "architect", "lead", "release_manager"],
  "U002BOB": ["reviewer", "developer", "qa"],
  "U003CAROL": ["reviewer", "developer", "qa"]
}
```

### Example: Enterprise Team Configuration

For larger teams with strict separation:

```json
"rbac_map": {
  "U001ALICE": ["pm"],
  "U002BOB": ["architect"],
  "U003CAROL": ["lead"],
  "U004DAVE": ["reviewer"],
  "U005EVE": ["reviewer"],
  "U006FRANK": ["qa"],
  "U007GRACE": ["qa"],
  "U008HENRY": ["release_manager"],
  "U009IRIS": ["release_manager"]
}
```

### Example: Cross-functional Team Configuration

For teams with cross-functional members:

```json
"rbac_map": {
  "U001ALICE": ["pm", "architect"],
  "U002BOB": ["lead", "reviewer"],
  "U003CAROL": ["reviewer", "qa"],
  "U004DAVE": ["qa", "release_manager"],
  "U005EVE": ["reviewer", "developer"]
}
```

---

## Part 5: Running the Bridge

### Docker Compose

The bridge is included in the standard Docker Compose setup:

```bash
cd docker
docker compose up -d slack-bridge
```

### Kubernetes

Deploy via Helm:

```bash
helm upgrade --install dox-asdlc ./helm/dox-asdlc \
  --set slackBridge.enabled=true \
  --set-file slackBridge.config=./slack-config.json
```

### Standalone

Run directly with Python:

```bash
cd /path/to/dox-asdlc
export SLACK_CONFIG_FILE=/path/to/config.json
python -m src.infrastructure.slack_bridge.bridge
```

---

## Part 6: Troubleshooting

### Connection Issues

**Symptom:** Bridge fails to start with "Connection refused"

**Causes and Solutions:**
1. **Invalid App Token** - Verify the `xapp-` token is correct
2. **Socket Mode not enabled** - Enable Socket Mode in Slack app settings
3. **Network issues** - Ensure outbound WebSocket connections are allowed

### Messages Not Appearing

**Symptom:** Gate requests are not posted to Slack

**Causes and Solutions:**
1. **Bot not in channel** - Invite the bot to the channel with `/invite @aSDLC HITL Bridge`
2. **Wrong channel ID** - Verify channel IDs in routing policy
3. **Unknown gate type** - Check that the gate type exists in routing policy
4. **Duplicate detection** - The bridge skips already-posted requests

### Button Clicks Not Working

**Symptom:** Clicking Approve/Reject does nothing

**Causes and Solutions:**
1. **Interactivity not enabled** - Enable in Slack app settings
2. **RBAC denial** - User may not have the required role (check logs)
3. **Gate already decided** - Another user may have already approved/rejected

### RBAC Denials

**Symptom:** User gets "You don't have permission" error

**Causes and Solutions:**
1. **Missing role** - Add the required role to user's entry in `rbac_map`
2. **Wrong user ID** - Verify the user ID is correct (starts with `U`)
3. **Typo in role name** - Role names are case-sensitive

### Ideas Not Captured

**Symptom:** Reactions in ideas channels don't create ideas

**Causes and Solutions:**
1. **Wrong emoji** - Verify `ideas_emoji` matches the reaction used (without colons)
2. **Channel not configured** - Add channel to `ideas_channels`
3. **Bot not in channel** - Invite the bot to the ideas channel
4. **Bot message** - The bridge ignores messages from bots

### Viewing Logs

```bash
# Docker Compose
docker compose logs -f slack-bridge

# Kubernetes
kubectl logs -f deployment/slack-bridge -n dox-asdlc

# Standalone
python -m src.infrastructure.slack_bridge.bridge 2>&1 | tee bridge.log
```

### Health Check

The bridge exposes a health endpoint:

```bash
curl http://localhost:8090/health
```

Response:
```json
{
  "status": "healthy",
  "slack_connected": true,
  "redis_connected": true,
  "version": "1.0.0"
}
```

---

## Part 7: Security Considerations

1. **Credential Storage** - Store tokens in a secrets manager, not in plain config files
2. **Socket Mode** - Uses outbound-only connections, no inbound webhooks to secure
3. **RBAC Enforcement** - All decisions are validated before processing
4. **Audit Logging** - Every approval/rejection is logged with user ID and timestamp
5. **Evidence Links** - Gate messages link to the HITL UI; sensitive content is never embedded in Slack

---

## Related Documentation

- [HITL UI Guide](../hitl-ui.md) - Web interface for HITL gates
- [Event Streams](../event-streams.md) - Redis Streams event architecture
- [Main Features](../Main_Features.md) - HITL gate ladder specification
