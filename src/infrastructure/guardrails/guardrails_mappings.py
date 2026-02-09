"""Elasticsearch index mappings for the guardrails configuration system.

Defines index mappings for two Elasticsearch indices:
- ``guardrails-config``: Stores guideline documents with conditions and actions.
- ``guardrails-audit``: Stores audit log entries for guardrail evaluations.

The mapping constants follow the same pattern as
``src.infrastructure.knowledge_store.elasticsearch_store.INDEX_MAPPING``.
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# Index name constants
# ---------------------------------------------------------------------------

GUARDRAILS_CONFIG_INDEX: str = "guardrails-config"
"""Default index name for guideline configuration documents."""

GUARDRAILS_AUDIT_INDEX: str = "guardrails-audit"
"""Default index name for guardrail audit log entries."""

# ---------------------------------------------------------------------------
# Guardrails config mapping
# ---------------------------------------------------------------------------

GUARDRAILS_CONFIG_MAPPING: dict = {
    "mappings": {
        "properties": {
            "id": {"type": "keyword"},
            "name": {
                "type": "text",
                "fields": {"keyword": {"type": "keyword"}},
            },
            "description": {"type": "text"},
            "enabled": {"type": "boolean"},
            "category": {"type": "keyword"},
            "priority": {"type": "integer"},
            "condition": {
                "type": "object",
                "properties": {
                    "agents": {"type": "keyword"},
                    "domains": {"type": "keyword"},
                    "actions": {"type": "keyword"},
                    "paths": {"type": "keyword"},
                    "events": {"type": "keyword"},
                    "gate_types": {"type": "keyword"},
                    "custom": {"type": "object", "enabled": False},
                },
            },
            "action": {
                "type": "object",
                "properties": {
                    "type": {"type": "keyword"},
                    "instruction": {"type": "text"},
                    "tools_allowed": {"type": "keyword"},
                    "tools_denied": {"type": "keyword"},
                    "gate_type": {"type": "keyword"},
                    "gate_threshold": {"type": "keyword"},
                    "max_files": {"type": "integer"},
                    "require_tests": {"type": "boolean"},
                    "require_review": {"type": "boolean"},
                    "parameters": {"type": "object", "enabled": False},
                },
            },
            "metadata": {"type": "object", "enabled": False},
            "version": {"type": "integer"},
            "created_at": {"type": "date"},
            "updated_at": {"type": "date"},
            "created_by": {"type": "keyword"},
            "tenant_id": {"type": "keyword"},
        },
    },
    "settings": {
        "number_of_shards": 1,
        "number_of_replicas": 0,
    },
}

# ---------------------------------------------------------------------------
# Guardrails audit mapping
# ---------------------------------------------------------------------------

GUARDRAILS_AUDIT_MAPPING: dict = {
    "mappings": {
        "properties": {
            "id": {"type": "keyword"},
            "event_type": {"type": "keyword"},
            "timestamp": {"type": "date"},
            "guideline_id": {"type": "keyword"},
            "guideline_name": {"type": "text"},
            "gate_type": {"type": "keyword"},
            "context": {
                "type": "object",
                "properties": {
                    "agent": {"type": "keyword"},
                    "domain": {"type": "keyword"},
                    "action": {"type": "keyword"},
                    "session_id": {"type": "keyword"},
                },
            },
            "decision": {
                "type": "object",
                "properties": {
                    "result": {"type": "keyword"},
                    "reason": {"type": "text"},
                    "user_response": {"type": "keyword"},
                },
            },
            "changes": {
                "type": "object",
                "properties": {
                    "field": {"type": "keyword"},
                    "old_value": {"type": "text"},
                    "new_value": {"type": "text"},
                },
            },
            "actor": {"type": "keyword"},
            "tenant_id": {"type": "keyword"},
        },
    },
    "settings": {
        "number_of_shards": 1,
        "number_of_replicas": 0,
    },
}
