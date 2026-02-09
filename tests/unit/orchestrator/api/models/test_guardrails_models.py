"""Tests for Guardrails API Pydantic models.

Tests validation, serialization, and required field enforcement
for guardrails CRUD and evaluation models.
"""

import pytest
from pydantic import ValidationError

from src.orchestrator.api.models.guardrails import (
    ActionTypeEnum,
    AuditLogEntry,
    AuditLogResponse,
    EvaluatedContextResponse,
    EvaluatedGuidelineResponse,
    GuidelineActionModel,
    GuidelineCategoryEnum,
    GuidelineConditionModel,
    GuidelineCreate,
    GuidelineResponse,
    GuidelinesListResponse,
    GuidelineUpdate,
    TaskContextRequest,
)


class TestGuidelineCategoryEnum:
    """Tests for GuidelineCategoryEnum."""

    def test_valid_category_values(self):
        """Test all valid category enum values match domain enums."""
        assert GuidelineCategoryEnum.COGNITIVE_ISOLATION == "cognitive_isolation"
        assert GuidelineCategoryEnum.HITL_GATE == "hitl_gate"
        assert GuidelineCategoryEnum.TDD_PROTOCOL == "tdd_protocol"
        assert GuidelineCategoryEnum.CONTEXT_CONSTRAINT == "context_constraint"
        assert GuidelineCategoryEnum.AUDIT_TELEMETRY == "audit_telemetry"
        assert GuidelineCategoryEnum.SECURITY == "security"
        assert GuidelineCategoryEnum.CUSTOM == "custom"

    def test_category_enum_matches_domain_enum(self):
        """Test all domain GuidelineCategory values exist in API enum."""
        from src.core.guardrails.models import GuidelineCategory

        for domain_member in GuidelineCategory:
            api_member = GuidelineCategoryEnum(domain_member.value)
            assert api_member.value == domain_member.value


class TestActionTypeEnum:
    """Tests for ActionTypeEnum."""

    def test_valid_action_type_values(self):
        """Test all valid action type enum values match domain enums."""
        assert ActionTypeEnum.INSTRUCTION == "instruction"
        assert ActionTypeEnum.TOOL_RESTRICTION == "tool_restriction"
        assert ActionTypeEnum.HITL_GATE == "hitl_gate"
        assert ActionTypeEnum.CONSTRAINT == "constraint"
        assert ActionTypeEnum.TELEMETRY == "telemetry"

    def test_action_type_enum_matches_domain_enum(self):
        """Test all domain ActionType values exist in API enum."""
        from src.core.guardrails.models import ActionType

        for domain_member in ActionType:
            api_member = ActionTypeEnum(domain_member.value)
            assert api_member.value == domain_member.value


class TestGuidelineConditionModel:
    """Tests for GuidelineConditionModel."""

    def test_condition_all_none_wildcard(self):
        """Test GuidelineConditionModel with all fields None (wildcard)."""
        condition = GuidelineConditionModel()
        assert condition.agents is None
        assert condition.domains is None
        assert condition.actions is None
        assert condition.paths is None
        assert condition.events is None
        assert condition.gate_types is None

    def test_condition_with_values(self):
        """Test GuidelineConditionModel with populated values."""
        condition = GuidelineConditionModel(
            agents=["backend", "frontend"],
            domains=["P01", "P02"],
            actions=["implement", "review"],
            paths=["src/workers/*"],
            events=["commit"],
            gate_types=["devops_invocation"],
        )
        assert condition.agents == ["backend", "frontend"]
        assert condition.domains == ["P01", "P02"]
        assert condition.actions == ["implement", "review"]
        assert condition.paths == ["src/workers/*"]
        assert condition.events == ["commit"]
        assert condition.gate_types == ["devops_invocation"]


class TestGuidelineActionModel:
    """Tests for GuidelineActionModel."""

    def test_action_with_valid_action_type(self):
        """Test GuidelineActionModel with valid action_type."""
        action = GuidelineActionModel(
            action_type=ActionTypeEnum.INSTRUCTION,
            instruction="Follow TDD protocol",
        )
        assert action.action_type == ActionTypeEnum.INSTRUCTION
        assert action.instruction == "Follow TDD protocol"

    def test_action_tool_restrictions(self):
        """Test GuidelineActionModel with tool restrictions."""
        action = GuidelineActionModel(
            action_type=ActionTypeEnum.TOOL_RESTRICTION,
            tools_denied=["git push --force", "rm -rf"],
        )
        assert action.action_type == ActionTypeEnum.TOOL_RESTRICTION
        assert action.tools_denied == ["git push --force", "rm -rf"]

    def test_action_hitl_gate(self):
        """Test GuidelineActionModel with HITL gate."""
        action = GuidelineActionModel(
            action_type=ActionTypeEnum.HITL_GATE, gate_type="devops_invocation"
        )
        assert action.action_type == ActionTypeEnum.HITL_GATE
        assert action.gate_type == "devops_invocation"

    def test_action_constraint_with_require_tests(self):
        """Test GuidelineActionModel with constraint action type."""
        action = GuidelineActionModel(
            action_type=ActionTypeEnum.CONSTRAINT,
            require_tests=True,
            max_files=10,
        )
        assert action.action_type == ActionTypeEnum.CONSTRAINT
        assert action.require_tests is True
        assert action.max_files == 10


class TestGuidelineCreate:
    """Tests for GuidelineCreate request model."""

    def test_valid_guideline_create(self):
        """Test GuidelineCreate with valid data."""
        guideline = GuidelineCreate(
            name="Test Guideline",
            description="A test guideline",
            category=GuidelineCategoryEnum.TDD_PROTOCOL,
            priority=100,
            enabled=True,
            condition=GuidelineConditionModel(agents=["backend"]),
            action=GuidelineActionModel(
                action_type=ActionTypeEnum.INSTRUCTION,
                instruction="Write tests first",
            ),
        )
        assert guideline.name == "Test Guideline"
        assert guideline.description == "A test guideline"
        assert guideline.category == GuidelineCategoryEnum.TDD_PROTOCOL
        assert guideline.priority == 100
        assert guideline.enabled is True

    def test_guideline_create_missing_name(self):
        """Test GuidelineCreate fails without name."""
        with pytest.raises(ValidationError) as exc_info:
            GuidelineCreate(
                category=GuidelineCategoryEnum.TDD_PROTOCOL,
                condition=GuidelineConditionModel(),
                action=GuidelineActionModel(action_type=ActionTypeEnum.INSTRUCTION),
            )
        assert "name" in str(exc_info.value)

    def test_guideline_create_missing_category(self):
        """Test GuidelineCreate fails without category."""
        with pytest.raises(ValidationError) as exc_info:
            GuidelineCreate(
                name="Test",
                condition=GuidelineConditionModel(),
                action=GuidelineActionModel(action_type=ActionTypeEnum.INSTRUCTION),
            )
        assert "category" in str(exc_info.value)

    def test_guideline_create_missing_condition(self):
        """Test GuidelineCreate fails without condition."""
        with pytest.raises(ValidationError) as exc_info:
            GuidelineCreate(
                name="Test",
                category=GuidelineCategoryEnum.TDD_PROTOCOL,
                action=GuidelineActionModel(action_type=ActionTypeEnum.INSTRUCTION),
            )
        assert "condition" in str(exc_info.value)

    def test_guideline_create_missing_action(self):
        """Test GuidelineCreate fails without action."""
        with pytest.raises(ValidationError) as exc_info:
            GuidelineCreate(
                name="Test",
                category=GuidelineCategoryEnum.TDD_PROTOCOL,
                condition=GuidelineConditionModel(),
            )
        assert "action" in str(exc_info.value)

    def test_guideline_create_name_too_long(self):
        """Test GuidelineCreate fails with name > 200 chars."""
        long_name = "x" * 201
        with pytest.raises(ValidationError) as exc_info:
            GuidelineCreate(
                name=long_name,
                category=GuidelineCategoryEnum.TDD_PROTOCOL,
                condition=GuidelineConditionModel(),
                action=GuidelineActionModel(action_type=ActionTypeEnum.INSTRUCTION),
            )
        assert "name" in str(exc_info.value)

    def test_guideline_create_priority_out_of_range_high(self):
        """Test GuidelineCreate fails with priority > 1000."""
        with pytest.raises(ValidationError) as exc_info:
            GuidelineCreate(
                name="Test",
                category=GuidelineCategoryEnum.TDD_PROTOCOL,
                priority=1001,
                condition=GuidelineConditionModel(),
                action=GuidelineActionModel(action_type=ActionTypeEnum.INSTRUCTION),
            )
        assert "priority" in str(exc_info.value)

    def test_guideline_create_priority_out_of_range_low(self):
        """Test GuidelineCreate fails with priority < 0."""
        with pytest.raises(ValidationError) as exc_info:
            GuidelineCreate(
                name="Test",
                category=GuidelineCategoryEnum.TDD_PROTOCOL,
                priority=-1,
                condition=GuidelineConditionModel(),
                action=GuidelineActionModel(action_type=ActionTypeEnum.INSTRUCTION),
            )
        assert "priority" in str(exc_info.value)

    def test_guideline_create_invalid_category_enum(self):
        """Test GuidelineCreate fails with invalid category."""
        with pytest.raises(ValidationError) as exc_info:
            GuidelineCreate(
                name="Test",
                category="invalid_category",  # type: ignore[arg-type]
                condition=GuidelineConditionModel(),
                action=GuidelineActionModel(action_type=ActionTypeEnum.INSTRUCTION),
            )
        assert "category" in str(exc_info.value)


class TestGuidelineUpdate:
    """Tests for GuidelineUpdate request model."""

    def test_guideline_update_version_required(self):
        """Test GuidelineUpdate requires version field."""
        with pytest.raises(ValidationError) as exc_info:
            GuidelineUpdate()  # type: ignore[call-arg]
        assert "version" in str(exc_info.value)

    def test_guideline_update_all_fields_optional_except_version(self):
        """Test GuidelineUpdate with only version provided."""
        update = GuidelineUpdate(version=1)
        assert update.version == 1
        assert update.name is None
        assert update.description is None
        assert update.category is None
        assert update.priority is None
        assert update.enabled is None
        assert update.condition is None
        assert update.action is None

    def test_guideline_update_with_partial_fields(self):
        """Test GuidelineUpdate with some fields provided."""
        update = GuidelineUpdate(version=2, name="Updated Name", priority=150)
        assert update.version == 2
        assert update.name == "Updated Name"
        assert update.priority == 150
        assert update.description is None


class TestGuidelineResponse:
    """Tests for GuidelineResponse model."""

    def test_guideline_response_creation(self):
        """Test GuidelineResponse with all required fields."""
        response = GuidelineResponse(
            id="guideline-123",
            name="Test Guideline",
            description="Test description",
            category="tdd_protocol",
            priority=100,
            enabled=True,
            condition=GuidelineConditionModel(agents=["backend"]),
            action=GuidelineActionModel(
                action_type=ActionTypeEnum.INSTRUCTION, instruction="Test instruction"
            ),
            version=1,
            created_at="2026-02-06T10:00:00Z",
            updated_at="2026-02-06T10:00:00Z",
        )
        assert response.id == "guideline-123"
        assert response.name == "Test Guideline"
        assert response.version == 1


class TestGuidelinesListResponse:
    """Tests for GuidelinesListResponse model."""

    def test_guidelines_list_response_with_multiple_items(self):
        """Test GuidelinesListResponse with multiple guidelines."""
        guidelines = [
            GuidelineResponse(
                id=f"guideline-{i}",
                name=f"Guideline {i}",
                description="",
                category="tdd_protocol",
                priority=100 + i,
                enabled=True,
                condition=GuidelineConditionModel(),
                action=GuidelineActionModel(action_type=ActionTypeEnum.INSTRUCTION),
                version=1,
                created_at="2026-02-06T10:00:00Z",
                updated_at="2026-02-06T10:00:00Z",
            )
            for i in range(3)
        ]
        response = GuidelinesListResponse(
            guidelines=guidelines, total=3, page=1, page_size=20
        )
        assert len(response.guidelines) == 3
        assert response.total == 3
        assert response.page == 1
        assert response.page_size == 20


class TestTaskContextRequest:
    """Tests for TaskContextRequest model."""

    def test_task_context_all_fields_optional(self):
        """Test TaskContextRequest with all fields optional."""
        context = TaskContextRequest()
        assert context.agent is None
        assert context.domain is None
        assert context.action is None
        assert context.paths is None
        assert context.event is None
        assert context.gate_type is None
        assert context.session_id is None

    def test_task_context_with_some_fields(self):
        """Test TaskContextRequest with partial fields populated."""
        context = TaskContextRequest(
            agent="backend",
            domain="P01",
            action="implement",
            paths=["src/workers/test.py"],
        )
        assert context.agent == "backend"
        assert context.domain == "P01"
        assert context.action == "implement"
        assert context.paths == ["src/workers/test.py"]


class TestEvaluatedGuidelineResponse:
    """Tests for EvaluatedGuidelineResponse model."""

    def test_evaluated_guideline_response(self):
        """Test EvaluatedGuidelineResponse creation."""
        response = EvaluatedGuidelineResponse(
            guideline_id="guideline-123",
            guideline_name="Test Guideline",
            priority=100,
            match_score=0.85,
            matched_fields=["agent", "domain"],
        )
        assert response.guideline_id == "guideline-123"
        assert response.guideline_name == "Test Guideline"
        assert response.priority == 100
        assert response.match_score == 0.85
        assert response.matched_fields == ["agent", "domain"]


class TestEvaluatedContextResponse:
    """Tests for EvaluatedContextResponse model."""

    def test_evaluated_context_response_creation(self):
        """Test EvaluatedContextResponse with full data."""
        guidelines = [
            EvaluatedGuidelineResponse(
                guideline_id="guideline-1",
                guideline_name="TDD Protocol",
                priority=100,
                match_score=1.0,
                matched_fields=["agent"],
            )
        ]
        response = EvaluatedContextResponse(
            matched_count=1,
            combined_instruction="Write tests first",
            tools_allowed=["pytest"],
            tools_denied=["rm -rf"],
            hitl_gates=["devops_invocation"],
            guidelines=guidelines,
        )
        assert response.matched_count == 1
        assert response.combined_instruction == "Write tests first"
        assert response.tools_allowed == ["pytest"]
        assert response.tools_denied == ["rm -rf"]
        assert response.hitl_gates == ["devops_invocation"]
        assert len(response.guidelines) == 1


class TestAuditLogEntry:
    """Tests for AuditLogEntry model."""

    def test_audit_log_entry_creation(self):
        """Test AuditLogEntry with required fields."""
        entry = AuditLogEntry(
            id="audit-123",
            event_type="guideline_evaluated",
            timestamp="2026-02-06T10:00:00Z",
            guideline_id="guideline-123",
            decision={"result": "allowed"},
            context={"agent": "backend"},
        )
        assert entry.id == "audit-123"
        assert entry.event_type == "guideline_evaluated"
        assert entry.guideline_id == "guideline-123"
        assert entry.decision == {"result": "allowed"}


class TestAuditLogResponse:
    """Tests for AuditLogResponse model."""

    def test_audit_log_response_creation(self):
        """Test AuditLogResponse with multiple entries."""
        entries = [
            AuditLogEntry(
                id=f"audit-{i}",
                event_type="guideline_evaluated",
                timestamp="2026-02-06T10:00:00Z",
            )
            for i in range(3)
        ]
        response = AuditLogResponse(entries=entries, total=3)
        assert len(response.entries) == 3
        assert response.total == 3


class TestEnumRoundTrip:
    """Tests verifying lossless round-tripping of enum values through the API layer."""

    def test_all_domain_categories_accepted_by_api_create(self):
        """Test that every domain GuidelineCategory can be used in GuidelineCreate."""
        from src.core.guardrails.models import GuidelineCategory

        for domain_cat in GuidelineCategory:
            api_cat = GuidelineCategoryEnum(domain_cat.value)
            guideline = GuidelineCreate(
                name=f"Test {domain_cat.name}",
                category=api_cat,
                condition=GuidelineConditionModel(),
                action=GuidelineActionModel(
                    action_type=ActionTypeEnum.INSTRUCTION
                ),
            )
            assert guideline.category.value == domain_cat.value

    def test_all_domain_action_types_accepted_by_api_create(self):
        """Test that every domain ActionType can be used in GuidelineActionModel."""
        from src.core.guardrails.models import ActionType

        for domain_at in ActionType:
            api_at = ActionTypeEnum(domain_at.value)
            action = GuidelineActionModel(action_type=api_at)
            assert action.action_type.value == domain_at.value

    def test_domain_to_api_category_round_trip(self):
        """Test domain category -> API enum -> domain category is lossless."""
        from src.core.guardrails.models import GuidelineCategory

        for domain_cat in GuidelineCategory:
            api_cat = GuidelineCategoryEnum(domain_cat.value)
            round_tripped = GuidelineCategory(api_cat.value)
            assert round_tripped == domain_cat

    def test_domain_to_api_action_type_round_trip(self):
        """Test domain action type -> API enum -> domain action type is lossless."""
        from src.core.guardrails.models import ActionType

        for domain_at in ActionType:
            api_at = ActionTypeEnum(domain_at.value)
            round_tripped = ActionType(api_at.value)
            assert round_tripped == domain_at
