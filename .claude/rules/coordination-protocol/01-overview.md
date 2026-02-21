# Overview and Session Lifecycle

## Session Lifecycle

### Session Start

When a CLI session starts:

1. **Publish SESSION_START message:**
   ```json
   {
     "type": "SESSION_START",
     "from": "<agent-id>",
     "timestamp": "<ISO-8601>",
     "metadata": {
       "git_email": "<configured-email>",
       "cwd": "<working-directory>"
     }
   }
   ```

2. **Begin heartbeat loop** - Start sending heartbeats every 60 seconds

3. **Check pending messages** - Process any messages sent while offline

### Session End

When a CLI session ends gracefully:

1. **Publish SESSION_END message:**
   ```json
   {
     "type": "SESSION_END",
     "from": "<agent-id>",
     "timestamp": "<ISO-8601>",
     "reason": "user_exit | task_complete | error"
   }
   ```

2. **Stop heartbeat loop** - No more heartbeats will be sent

3. **Presence record expires** - TTL will cause automatic cleanup

## Redis Key Structure

### Presence Keys

```
asdlc:presence:pm              -> Presence record for PM CLI (main repo)
asdlc:presence:p11-guardrails  -> Presence record for P11 feature session
asdlc:presence:p04-review-swarm -> Presence record for P04 feature session
```

### Message Keys

```
asdlc:messages:inbox:<agent-id>    -> List of pending messages
asdlc:messages:sent:<message-id>   -> Individual message details
asdlc:messages:acked:<agent-id>    -> Set of acknowledged message IDs
```

### Session Keys

```
asdlc:session:<session-id>         -> Session metadata
asdlc:session:history:<agent-id>   -> Recent session history
```
