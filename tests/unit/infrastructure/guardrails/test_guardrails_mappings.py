"""Tests for Elasticsearch index mappings for the guardrails configuration system.

Covers:
- Both mappings are valid dicts with 'mappings' and 'settings' keys.
- All model fields from src/core/guardrails/models.py are present in the config mapping.
- Config mapping has correct field types.
- Audit mapping has correct field types.
- Object fields have correct nested properties.
- tenant_id field exists in both mappings.
- Settings have number_of_shards and number_of_replicas.
- Index name constants are strings.
"""

from __future__ import annotations

import pytest

from src.infrastructure.guardrails.guardrails_mappings import (
    GUARDRAILS_AUDIT_INDEX,
    GUARDRAILS_AUDIT_MAPPING,
    GUARDRAILS_CONFIG_INDEX,
    GUARDRAILS_CONFIG_MAPPING,
)


# ---------------------------------------------------------------------------
# Helper to extract the top-level properties dict from a mapping
# ---------------------------------------------------------------------------

def _props(mapping: dict) -> dict:
    """Return the top-level properties dict from an ES mapping."""
    return mapping["mappings"]["properties"]


# ===================================================================
# Structure validation
# ===================================================================


class TestMappingStructure:
    """Both mappings must be valid dicts with required top-level keys."""

    def test_config_mapping_has_mappings_key(self) -> None:
        assert "mappings" in GUARDRAILS_CONFIG_MAPPING

    def test_config_mapping_has_settings_key(self) -> None:
        assert "settings" in GUARDRAILS_CONFIG_MAPPING

    def test_audit_mapping_has_mappings_key(self) -> None:
        assert "mappings" in GUARDRAILS_AUDIT_MAPPING

    def test_audit_mapping_has_settings_key(self) -> None:
        assert "settings" in GUARDRAILS_AUDIT_MAPPING

    def test_config_mapping_is_dict(self) -> None:
        assert isinstance(GUARDRAILS_CONFIG_MAPPING, dict)

    def test_audit_mapping_is_dict(self) -> None:
        assert isinstance(GUARDRAILS_AUDIT_MAPPING, dict)


# ===================================================================
# Settings validation
# ===================================================================


class TestMappingSettings:
    """Settings must include number_of_shards and number_of_replicas."""

    def test_config_settings_has_shards(self) -> None:
        settings = GUARDRAILS_CONFIG_MAPPING["settings"]
        assert "number_of_shards" in settings

    def test_config_settings_has_replicas(self) -> None:
        settings = GUARDRAILS_CONFIG_MAPPING["settings"]
        assert "number_of_replicas" in settings

    def test_audit_settings_has_shards(self) -> None:
        settings = GUARDRAILS_AUDIT_MAPPING["settings"]
        assert "number_of_shards" in settings

    def test_audit_settings_has_replicas(self) -> None:
        settings = GUARDRAILS_AUDIT_MAPPING["settings"]
        assert "number_of_replicas" in settings

    def test_config_shards_value(self) -> None:
        assert GUARDRAILS_CONFIG_MAPPING["settings"]["number_of_shards"] == 1

    def test_config_replicas_value(self) -> None:
        assert GUARDRAILS_CONFIG_MAPPING["settings"]["number_of_replicas"] == 0

    def test_audit_shards_value(self) -> None:
        assert GUARDRAILS_AUDIT_MAPPING["settings"]["number_of_shards"] == 1

    def test_audit_replicas_value(self) -> None:
        assert GUARDRAILS_AUDIT_MAPPING["settings"]["number_of_replicas"] == 0


# ===================================================================
# Index name constants
# ===================================================================


class TestIndexNameConstants:
    """Index name constants must be non-empty strings."""

    def test_config_index_is_string(self) -> None:
        assert isinstance(GUARDRAILS_CONFIG_INDEX, str)

    def test_audit_index_is_string(self) -> None:
        assert isinstance(GUARDRAILS_AUDIT_INDEX, str)

    def test_config_index_not_empty(self) -> None:
        assert len(GUARDRAILS_CONFIG_INDEX) > 0

    def test_audit_index_not_empty(self) -> None:
        assert len(GUARDRAILS_AUDIT_INDEX) > 0

    def test_config_index_value(self) -> None:
        assert GUARDRAILS_CONFIG_INDEX == "guardrails-config"

    def test_audit_index_value(self) -> None:
        assert GUARDRAILS_AUDIT_INDEX == "guardrails-audit"


# ===================================================================
# Config mapping -- all model fields present
# ===================================================================


class TestConfigMappingFields:
    """All fields from the Guideline model must be present in the config mapping."""

    # Top-level Guideline fields
    @pytest.mark.parametrize(
        "field",
        [
            "id",
            "name",
            "description",
            "enabled",
            "category",
            "priority",
            "condition",
            "action",
            "metadata",
            "version",
            "created_at",
            "updated_at",
            "created_by",
            "tenant_id",
        ],
    )
    def test_config_has_field(self, field: str) -> None:
        props = _props(GUARDRAILS_CONFIG_MAPPING)
        assert field in props, f"Missing field '{field}' in config mapping"


# ===================================================================
# Config mapping -- correct field types
# ===================================================================


class TestConfigFieldTypes:
    """Config mapping fields must have the correct Elasticsearch types."""

    def test_id_is_keyword(self) -> None:
        assert _props(GUARDRAILS_CONFIG_MAPPING)["id"]["type"] == "keyword"

    def test_name_is_text_with_keyword(self) -> None:
        name_field = _props(GUARDRAILS_CONFIG_MAPPING)["name"]
        assert name_field["type"] == "text"
        assert "fields" in name_field
        assert "keyword" in name_field["fields"]
        assert name_field["fields"]["keyword"]["type"] == "keyword"

    def test_description_is_text(self) -> None:
        assert _props(GUARDRAILS_CONFIG_MAPPING)["description"]["type"] == "text"

    def test_enabled_is_boolean(self) -> None:
        assert _props(GUARDRAILS_CONFIG_MAPPING)["enabled"]["type"] == "boolean"

    def test_category_is_keyword(self) -> None:
        assert _props(GUARDRAILS_CONFIG_MAPPING)["category"]["type"] == "keyword"

    def test_priority_is_integer(self) -> None:
        assert _props(GUARDRAILS_CONFIG_MAPPING)["priority"]["type"] == "integer"

    def test_version_is_integer(self) -> None:
        assert _props(GUARDRAILS_CONFIG_MAPPING)["version"]["type"] == "integer"

    def test_created_at_is_date(self) -> None:
        assert _props(GUARDRAILS_CONFIG_MAPPING)["created_at"]["type"] == "date"

    def test_updated_at_is_date(self) -> None:
        assert _props(GUARDRAILS_CONFIG_MAPPING)["updated_at"]["type"] == "date"

    def test_created_by_is_keyword(self) -> None:
        assert _props(GUARDRAILS_CONFIG_MAPPING)["created_by"]["type"] == "keyword"

    def test_tenant_id_is_keyword(self) -> None:
        assert _props(GUARDRAILS_CONFIG_MAPPING)["tenant_id"]["type"] == "keyword"

    def test_metadata_is_disabled_object(self) -> None:
        meta = _props(GUARDRAILS_CONFIG_MAPPING)["metadata"]
        assert meta["type"] == "object"
        assert meta["enabled"] is False

    def test_condition_is_object(self) -> None:
        assert _props(GUARDRAILS_CONFIG_MAPPING)["condition"]["type"] == "object"

    def test_action_is_object(self) -> None:
        assert _props(GUARDRAILS_CONFIG_MAPPING)["action"]["type"] == "object"


# ===================================================================
# Config mapping -- nested condition properties
# ===================================================================


class TestConditionNestedProperties:
    """The condition object must have all GuidelineCondition fields."""

    @pytest.fixture()
    def condition_props(self) -> dict:
        return _props(GUARDRAILS_CONFIG_MAPPING)["condition"]["properties"]

    @pytest.mark.parametrize(
        "field,expected_type",
        [
            ("agents", "keyword"),
            ("domains", "keyword"),
            ("actions", "keyword"),
            ("paths", "keyword"),
            ("events", "keyword"),
            ("gate_types", "keyword"),
        ],
    )
    def test_condition_keyword_fields(
        self, condition_props: dict, field: str, expected_type: str
    ) -> None:
        assert field in condition_props, f"Missing condition field '{field}'"
        assert condition_props[field]["type"] == expected_type

    def test_condition_custom_is_disabled_object(self, condition_props: dict) -> None:
        assert "custom" in condition_props
        assert condition_props["custom"]["type"] == "object"
        assert condition_props["custom"]["enabled"] is False


# ===================================================================
# Config mapping -- nested action properties
# ===================================================================


class TestActionNestedProperties:
    """The action object must have all GuidelineAction fields."""

    @pytest.fixture()
    def action_props(self) -> dict:
        return _props(GUARDRAILS_CONFIG_MAPPING)["action"]["properties"]

    @pytest.mark.parametrize(
        "field,expected_type",
        [
            ("type", "keyword"),
            ("instruction", "text"),
            ("tools_allowed", "keyword"),
            ("tools_denied", "keyword"),
            ("gate_type", "keyword"),
            ("gate_threshold", "keyword"),
            ("max_files", "integer"),
            ("require_tests", "boolean"),
            ("require_review", "boolean"),
        ],
    )
    def test_action_typed_fields(
        self, action_props: dict, field: str, expected_type: str
    ) -> None:
        assert field in action_props, f"Missing action field '{field}'"
        assert action_props[field]["type"] == expected_type

    def test_action_parameters_is_disabled_object(self, action_props: dict) -> None:
        assert "parameters" in action_props
        assert action_props["parameters"]["type"] == "object"
        assert action_props["parameters"]["enabled"] is False


# ===================================================================
# Audit mapping -- all required fields present
# ===================================================================


class TestAuditMappingFields:
    """Audit mapping must have all required top-level and nested fields."""

    @pytest.mark.parametrize(
        "field",
        [
            "id",
            "event_type",
            "timestamp",
            "guideline_id",
            "guideline_name",
            "context",
            "decision",
            "changes",
            "actor",
            "tenant_id",
        ],
    )
    def test_audit_has_field(self, field: str) -> None:
        props = _props(GUARDRAILS_AUDIT_MAPPING)
        assert field in props, f"Missing field '{field}' in audit mapping"


# ===================================================================
# Audit mapping -- correct field types
# ===================================================================


class TestAuditFieldTypes:
    """Audit mapping fields must have the correct Elasticsearch types."""

    def test_id_is_keyword(self) -> None:
        assert _props(GUARDRAILS_AUDIT_MAPPING)["id"]["type"] == "keyword"

    def test_event_type_is_keyword(self) -> None:
        assert _props(GUARDRAILS_AUDIT_MAPPING)["event_type"]["type"] == "keyword"

    def test_timestamp_is_date(self) -> None:
        assert _props(GUARDRAILS_AUDIT_MAPPING)["timestamp"]["type"] == "date"

    def test_guideline_id_is_keyword(self) -> None:
        assert _props(GUARDRAILS_AUDIT_MAPPING)["guideline_id"]["type"] == "keyword"

    def test_guideline_name_is_text(self) -> None:
        assert _props(GUARDRAILS_AUDIT_MAPPING)["guideline_name"]["type"] == "text"

    def test_actor_is_keyword(self) -> None:
        assert _props(GUARDRAILS_AUDIT_MAPPING)["actor"]["type"] == "keyword"

    def test_tenant_id_is_keyword(self) -> None:
        assert _props(GUARDRAILS_AUDIT_MAPPING)["tenant_id"]["type"] == "keyword"

    def test_context_is_object(self) -> None:
        assert _props(GUARDRAILS_AUDIT_MAPPING)["context"]["type"] == "object"

    def test_decision_is_object(self) -> None:
        assert _props(GUARDRAILS_AUDIT_MAPPING)["decision"]["type"] == "object"

    def test_changes_is_object(self) -> None:
        assert _props(GUARDRAILS_AUDIT_MAPPING)["changes"]["type"] == "object"


# ===================================================================
# Audit mapping -- nested context properties
# ===================================================================


class TestAuditContextNestedProperties:
    """Audit context object must have the correct nested fields."""

    @pytest.fixture()
    def context_props(self) -> dict:
        return _props(GUARDRAILS_AUDIT_MAPPING)["context"]["properties"]

    @pytest.mark.parametrize(
        "field,expected_type",
        [
            ("agent", "keyword"),
            ("domain", "keyword"),
            ("action", "keyword"),
            ("session_id", "keyword"),
        ],
    )
    def test_context_field_types(
        self, context_props: dict, field: str, expected_type: str
    ) -> None:
        assert field in context_props, f"Missing context field '{field}'"
        assert context_props[field]["type"] == expected_type


# ===================================================================
# Audit mapping -- nested decision properties
# ===================================================================


class TestAuditDecisionNestedProperties:
    """Audit decision object must have the correct nested fields."""

    @pytest.fixture()
    def decision_props(self) -> dict:
        return _props(GUARDRAILS_AUDIT_MAPPING)["decision"]["properties"]

    @pytest.mark.parametrize(
        "field,expected_type",
        [
            ("result", "keyword"),
            ("reason", "text"),
            ("user_response", "keyword"),
        ],
    )
    def test_decision_field_types(
        self, decision_props: dict, field: str, expected_type: str
    ) -> None:
        assert field in decision_props, f"Missing decision field '{field}'"
        assert decision_props[field]["type"] == expected_type


# ===================================================================
# Audit mapping -- nested changes properties
# ===================================================================


class TestAuditChangesNestedProperties:
    """Audit changes object must have the correct nested fields."""

    @pytest.fixture()
    def changes_props(self) -> dict:
        return _props(GUARDRAILS_AUDIT_MAPPING)["changes"]["properties"]

    @pytest.mark.parametrize(
        "field,expected_type",
        [
            ("field", "keyword"),
            ("old_value", "text"),
            ("new_value", "text"),
        ],
    )
    def test_changes_field_types(
        self, changes_props: dict, field: str, expected_type: str
    ) -> None:
        assert field in changes_props, f"Missing changes field '{field}'"
        assert changes_props[field]["type"] == expected_type


# ===================================================================
# Cross-mapping: tenant_id exists in both
# ===================================================================


class TestTenantIdInBothMappings:
    """tenant_id must be present in both config and audit mappings."""

    def test_tenant_id_in_config(self) -> None:
        assert "tenant_id" in _props(GUARDRAILS_CONFIG_MAPPING)

    def test_tenant_id_in_audit(self) -> None:
        assert "tenant_id" in _props(GUARDRAILS_AUDIT_MAPPING)

    def test_tenant_id_is_keyword_in_config(self) -> None:
        assert _props(GUARDRAILS_CONFIG_MAPPING)["tenant_id"]["type"] == "keyword"

    def test_tenant_id_is_keyword_in_audit(self) -> None:
        assert _props(GUARDRAILS_AUDIT_MAPPING)["tenant_id"]["type"] == "keyword"
