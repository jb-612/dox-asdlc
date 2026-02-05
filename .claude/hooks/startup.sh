#!/bin/bash
# Session startup validation hook for Claude CLI sessions.
#
# This hook validates the session identity, registers presence, and checks
# for pending notifications at startup.
#
# Exit codes:
#   0 - Validation passed, session may proceed
#   1 - Validation failed, session should not proceed
#
# Environment variables:
#   CLAUDE_INSTANCE_ID - Preferred identity source (backend, frontend, etc.)
#   REDIS_HOST - Redis host for coordination (default: localhost)
#   REDIS_PORT - Redis port for coordination (default: 6379)
#
# If CLAUDE_INSTANCE_ID is not set, falls back to git user.email.
#
# Usage:
#   .claude/hooks/startup.sh
#
# Called automatically at session startup if hooks are enabled,
# or can be run manually to validate environment.

set -euo pipefail

# =============================================================================
# Configuration
# =============================================================================

# Redis configuration
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"

# Session metadata
SESSION_ID="session-$(date +%s)-$$"
STARTUP_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Global variable for resolved identity
RESOLVED_IDENTITY=""
IDENTITY_SOURCE=""

# =============================================================================
# Utility Functions
# =============================================================================

log_info() {
    echo "[STARTUP] $*"
}

log_warn() {
    echo "[STARTUP WARNING] $*" >&2
}

log_error() {
    echo "[STARTUP ERROR] $*" >&2
}

# Check if a value is a valid identity (any non-empty string except "unknown")
is_valid_identity() {
    local identity="$1"
    if [[ -z "$identity" || "$identity" == "unknown" ]]; then
        return 1
    fi
    return 0
}

# =============================================================================
# Identity Validation
# =============================================================================

resolve_identity() {
    local identity=""
    local source=""

    # Priority 1: Check CLAUDE_INSTANCE_ID environment variable
    if [[ -n "${CLAUDE_INSTANCE_ID:-}" && "${CLAUDE_INSTANCE_ID:-}" != "unknown" ]]; then
        identity="$CLAUDE_INSTANCE_ID"
        source="CLAUDE_INSTANCE_ID"
    fi

    # Priority 2: Default to "pm" if in main repository (not a worktree)
    if [[ -z "$identity" ]]; then
        local is_worktree=false
        local worktree_root=""

        if git rev-parse --show-toplevel &>/dev/null; then
            worktree_root=$(git rev-parse --show-toplevel)
            # A worktree has a .git file (not directory) that points to the main repo
            if [[ -f "$worktree_root/.git" ]]; then
                is_worktree=true
            fi
        fi

        if [[ "$is_worktree" == "false" ]]; then
            # In main repository without specific identity = PM CLI (default)
            identity="pm"
            source="default (main repository)"
            log_info "No specific identity set - defaulting to PM CLI"
        else
            # In a worktree without identity is an error
            log_error "Running in worktree but no identity configured."
            log_error "Worktree: $worktree_root"
            log_error ""
            log_error "Set the identity for your context:"
            log_error "  export CLAUDE_INSTANCE_ID=<context-name>"
            log_error ""
            log_error "Example:"
            log_error "  export CLAUDE_INSTANCE_ID=p11-guardrails"
            return 1
        fi
    fi

    if ! is_valid_identity "$identity"; then
        log_error "Invalid identity: $identity"
        log_error ""
        log_error "Identity must be a non-empty string."
        log_error "Use your feature context name:"
        log_error "  export CLAUDE_INSTANCE_ID=p11-guardrails"
        return 1
    fi

    # Set global variables with resolved identity
    RESOLVED_IDENTITY="$identity"
    IDENTITY_SOURCE="$source"
    export CLAUDE_INSTANCE_ID="$identity"
    return 0
}

# =============================================================================
# Presence Registration (T11)
# =============================================================================

check_redis_available() {
    if command -v redis-cli &>/dev/null; then
        redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping 2>/dev/null | grep -q "PONG"
        return $?
    fi
    return 1
}

register_presence() {
    local role="$1"

    # Check if Redis is available
    if ! check_redis_available; then
        log_warn "Redis not available at $REDIS_HOST:$REDIS_PORT"
        log_warn "Presence registration skipped - coordination features may be limited"
        return 0  # Don't block startup
    fi

    # Get worktree path if applicable
    local worktree_path=""
    if git rev-parse --show-toplevel &>/dev/null; then
        worktree_path=$(git rev-parse --show-toplevel)
    fi

    # Register presence using direct Redis commands
    # This is a simplified heartbeat - just update the presence hash
    local presence_key="asdlc:coord:presence"
    local now
    now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    # Set presence fields atomically
    if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" HSET "$presence_key" \
        "${role}.active" "1" \
        "${role}.last_heartbeat" "$now" \
        "${role}.session_id" "$SESSION_ID" \
        > /dev/null 2>&1; then
        log_info "Presence registered (session: $SESSION_ID)"
    else
        log_warn "Failed to register presence - coordination features may be limited"
    fi

    return 0  # Don't block startup on registration failure
}

# =============================================================================
# Worktree Verification
# =============================================================================

verify_worktree() {
    local identity="$1"

    # Check if current directory is inside a git worktree
    local is_worktree=false
    local worktree_root=""

    if git rev-parse --show-toplevel &>/dev/null; then
        worktree_root=$(git rev-parse --show-toplevel)

        # Check if this is a worktree (not the main repo)
        # A worktree has a .git file (not directory) that points to the main repo
        if [[ -f "$worktree_root/.git" ]]; then
            is_worktree=true
        fi
    fi

    if [[ "$identity" == "pm" ]]; then
        # PM CLI should be in main repo, not a worktree
        if [[ "$is_worktree" == "true" ]]; then
            log_warn "PM identity is running in a worktree: $worktree_root"
            log_warn "PM CLI typically runs in the main repository."
            log_warn "If intentional, you can ignore this warning."
        fi
    else
        # Non-PM identities typically run in worktrees
        if [[ "$is_worktree" == "false" ]]; then
            log_warn "Context '$identity' is running in main repository."
            log_warn "For proper isolation, consider using a worktree:"
            log_warn "  ./scripts/start-session.sh $identity"
        else
            # Verify the worktree matches the identity
            local expected_pattern=".worktrees/$identity"
            if [[ "$worktree_root" != *"$expected_pattern"* ]]; then
                log_warn "Worktree mismatch: identity is '$identity' but worktree is: $worktree_root"
                log_warn "Expected worktree path to contain: $expected_pattern"
            fi
        fi
    fi

    return 0  # Warnings only, don't block startup
}

# =============================================================================
# SESSION_START Message Publishing
# =============================================================================

publish_session_start() {
    local identity="$1"

    # Check if Redis is available
    if ! check_redis_available; then
        log_warn "Redis not available - SESSION_START message not published"
        return 0  # Don't block startup
    fi

    # Generate message ID
    local msg_id="msg-$(date +%s)-$$"
    local now
    now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    # Get working directory
    local cwd
    cwd=$(pwd)

    # Build JSON payload
    local json_payload
    json_payload=$(cat <<EOF
{
    "id": "$msg_id",
    "type": "SESSION_START",
    "from": "$identity",
    "to": "all",
    "timestamp": "$now",
    "requires_ack": false,
    "acknowledged": false,
    "payload": {
        "subject": "Session started: $identity",
        "description": "Session started. CWD: $cwd, Session ID: $SESSION_ID"
    }
}
EOF
)

    # Store message in Redis
    local messages_key="asdlc:coord:messages"
    if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" HSET "$messages_key" "$msg_id" "$json_payload" > /dev/null 2>&1; then
        log_info "SESSION_START message published (id: $msg_id)"
    else
        log_warn "Failed to publish SESSION_START message"
    fi

    # Notify via pub/sub channel
    local channel="asdlc:coord:notifications"
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" PUBLISH "$channel" "$json_payload" > /dev/null 2>&1 || true

    return 0  # Don't block startup on message failure
}

# =============================================================================
# Notification Check
# =============================================================================

check_notifications() {
    local identity="$1"

    # Check if Redis is available
    if ! check_redis_available; then
        log_warn "Redis not available - skipping notification check"
        return 0  # Don't block startup
    fi

    # Check for pending messages in the inbox
    local inbox_key="asdlc:coord:inbox:${identity}"
    local pending_count

    pending_count=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" SCARD "$inbox_key" 2>/dev/null || echo "0")

    if [[ "$pending_count" -gt 0 ]]; then
        log_info ""
        log_info "========================================"
        log_info "  $pending_count pending notification(s)"
        log_info "========================================"
        log_info ""
        log_info "Run 'coord_check_messages' to view details"
        log_info ""
    else
        log_info "No pending notifications"
    fi

    # Also check notification queue (for offline notifications)
    local queue_key="asdlc:coord:notifications:${identity}"
    local queue_count

    queue_count=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" LLEN "$queue_key" 2>/dev/null || echo "0")

    if [[ "$queue_count" -gt 0 ]]; then
        log_info "$queue_count notification(s) received while offline"
        log_info "These will be delivered when you check messages"
    fi

    return 0  # Don't block startup on notification errors
}

# =============================================================================
# Main Execution
# =============================================================================

main() {
    log_info "Starting session validation..."
    log_info "Time: $STARTUP_TIME"
    log_info ""

    # Step 1: Validate identity (this can fail and block startup)
    if ! resolve_identity; then
        exit 1
    fi

    log_info "========================================"
    log_info "  Session Identity: $RESOLVED_IDENTITY"
    log_info "  Source: $IDENTITY_SOURCE"
    log_info "========================================"
    log_info ""

    # Step 2: Verify worktree (warnings only, T18)
    verify_worktree "$RESOLVED_IDENTITY"

    # Step 3: Register presence (failures are warnings, not errors)
    register_presence "$RESOLVED_IDENTITY"

    # Step 4: Publish SESSION_START message (failures are warnings, T20)
    publish_session_start "$RESOLVED_IDENTITY"

    # Step 5: Check for pending notifications (failures are warnings, not errors)
    check_notifications "$RESOLVED_IDENTITY"

    log_info ""
    log_info "Session validation complete. Ready to proceed."
    log_info ""

    exit 0
}

# Run main function
main "$@"
