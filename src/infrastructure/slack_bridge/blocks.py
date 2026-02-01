"""Block Kit message builders for Slack HITL Bridge.

Provides functions to build Slack Block Kit messages for gate requests,
approvals, rejections, and the rejection reason modal.
"""

from __future__ import annotations


def build_gate_request_blocks(
    request_id: str,
    gate_type: str,
    task_id: str,
    summary: str,
    evidence_url: str,
    requester: str,
) -> list[dict]:
    """Build Block Kit blocks for a gate request message.

    Creates a Slack message with:
    - Header showing the gate type
    - Task information section
    - Evidence link
    - Approve/Reject action buttons
    - Context with request ID

    Args:
        request_id: Unique identifier for this gate request.
        gate_type: Type of gate (e.g., "hitl_4_code").
        task_id: Associated task identifier.
        summary: Human-readable summary of what needs review.
        evidence_url: URL to the evidence bundle in HITL UI.
        requester: Name/ID of the agent that requested the gate.

    Returns:
        List of Block Kit block dictionaries.

    Example:
        ```python
        blocks = build_gate_request_blocks(
            request_id="req-123",
            gate_type="hitl_4_code",
            task_id="task-456",
            summary="Review authentication changes",
            evidence_url="https://hitl.example.com/evidence/req-123",
            requester="coding-agent",
        )
        await slack_client.chat_postMessage(
            channel="C-CODE-REVIEW",
            blocks=blocks,
            text="HITL Gate: hitl_4_code",
        )
        ```
    """
    # Format gate type for display (hitl_4_code -> HITL 4 CODE)
    formatted_gate = gate_type.upper().replace("_", " ")

    return [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": f"HITL Gate: {formatted_gate}",
                "emoji": True,
            },
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": (f"*Task:* {task_id}\n*Summary:* {summary}\n*Requested by:* {requester}"),
            },
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"<{evidence_url}|View Evidence Bundle>",
            },
        },
        {
            "type": "actions",
            "block_id": f"gate_actions_{request_id}",
            "elements": [
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": "Approve", "emoji": True},
                    "style": "primary",
                    "action_id": "approve_gate",
                    "value": request_id,
                },
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": "Reject", "emoji": True},
                    "style": "danger",
                    "action_id": "reject_gate",
                    "value": request_id,
                },
            ],
        },
        {
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": f"Request ID: `{request_id}`",
                },
            ],
        },
    ]


def build_approved_blocks(
    original_blocks: list[dict],
    approver_name: str,
    timestamp: str,
) -> list[dict]:
    """Build updated blocks after gate approval.

    Takes the original gate request blocks, removes the action buttons,
    and adds an approval confirmation section.

    Args:
        original_blocks: Original Block Kit blocks from the gate request.
        approver_name: Display name of the user who approved.
        timestamp: ISO timestamp of the approval.

    Returns:
        Updated Block Kit blocks with approval information.
    """
    # Filter out the actions block
    updated_blocks = [block for block in original_blocks if block.get("type") != "actions"]

    # Add approval confirmation section
    updated_blocks.append(
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f":white_check_mark: *Approved* by {approver_name} at {timestamp}",
            },
        }
    )

    return updated_blocks


def build_rejected_blocks(
    original_blocks: list[dict],
    rejecter_name: str,
    reason: str,
    timestamp: str,
) -> list[dict]:
    """Build updated blocks after gate rejection.

    Takes the original gate request blocks, removes the action buttons,
    and adds a rejection section with the reason.

    Args:
        original_blocks: Original Block Kit blocks from the gate request.
        rejecter_name: Display name of the user who rejected.
        reason: Reason provided for the rejection.
        timestamp: ISO timestamp of the rejection.

    Returns:
        Updated Block Kit blocks with rejection information.
    """
    # Filter out the actions block
    updated_blocks = [block for block in original_blocks if block.get("type") != "actions"]

    # Add rejection section with reason
    updated_blocks.append(
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": (f":x: *Rejected* by {rejecter_name} at {timestamp}\n*Reason:* {reason}"),
            },
        }
    )

    return updated_blocks


def build_rejection_modal(request_id: str) -> dict:
    """Build a modal for capturing rejection reason.

    Creates a Slack modal with a text input for the user to
    explain why they are rejecting the gate.

    Args:
        request_id: The gate request ID (stored in private_metadata).

    Returns:
        Modal view payload dictionary.

    Example:
        ```python
        modal = build_rejection_modal("req-123")
        await slack_client.views_open(
            trigger_id=body["trigger_id"],
            view=modal,
        )
        ```
    """
    return {
        "type": "modal",
        "callback_id": f"rejection_modal_{request_id}",
        "title": {"type": "plain_text", "text": "Reject Gate", "emoji": True},
        "submit": {"type": "plain_text", "text": "Reject", "emoji": True},
        "close": {"type": "plain_text", "text": "Cancel", "emoji": True},
        "blocks": [
            {
                "type": "input",
                "block_id": "reason_block",
                "label": {
                    "type": "plain_text",
                    "text": "Rejection Reason",
                    "emoji": True,
                },
                "element": {
                    "type": "plain_text_input",
                    "action_id": "reason_input",
                    "multiline": True,
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Please explain why this gate is being rejected...",
                    },
                },
            },
        ],
        "private_metadata": request_id,
    }
