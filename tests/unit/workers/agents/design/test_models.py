"""Tests for Design agent domain models."""

from __future__ import annotations

import json
from datetime import datetime, timezone

import pytest

from src.workers.agents.design.models import (
    Architecture,
    ArchitectureStyle,
    ComplexityLevel,
    Component,
    DataFlow,
    DesignResult,
    DiagramReference,
    DiagramType,
    ImplementationPlan,
    ImplementationTask,
    Interface,
    Phase,
    Risk,
    RiskLevel,
    TechnologyChoice,
    TechSurvey,
)


class TestRisk:
    """Tests for Risk model."""

    def test_create_risk(self) -> None:
        """Test creating a risk."""
        risk = Risk(
            id="RISK-001",
            description="Database scaling",
            level=RiskLevel.HIGH,
            mitigation="Implement sharding",
            impact="Performance degradation",
        )

        assert risk.id == "RISK-001"
        assert risk.level == RiskLevel.HIGH

    def test_risk_to_dict(self) -> None:
        """Test risk serialization."""
        risk = Risk(
            id="RISK-001",
            description="Test risk",
            level=RiskLevel.MEDIUM,
        )

        result = risk.to_dict()

        assert result["id"] == "RISK-001"
        assert result["level"] == "medium"

    def test_risk_from_dict(self) -> None:
        """Test risk deserialization."""
        data = {
            "id": "RISK-002",
            "description": "Security risk",
            "level": "critical",
            "mitigation": "Add auth",
            "impact": "Data breach",
        }

        risk = Risk.from_dict(data)

        assert risk.id == "RISK-002"
        assert risk.level == RiskLevel.CRITICAL


class TestTechnologyChoice:
    """Tests for TechnologyChoice model."""

    def test_create_technology_choice(self) -> None:
        """Test creating a technology choice."""
        tech = TechnologyChoice(
            category="language",
            selected="Python",
            alternatives=["Go", "Rust"],
            rationale="Team expertise",
        )

        assert tech.category == "language"
        assert tech.selected == "Python"
        assert "Go" in tech.alternatives

    def test_technology_choice_to_dict(self) -> None:
        """Test technology choice serialization."""
        tech = TechnologyChoice(
            category="database",
            selected="PostgreSQL",
            alternatives=["MySQL"],
            rationale="ACID compliance",
            constraints=["Must support JSON"],
        )

        result = tech.to_dict()

        assert result["category"] == "database"
        assert result["selected"] == "PostgreSQL"
        assert result["constraints"] == ["Must support JSON"]

    def test_technology_choice_to_markdown(self) -> None:
        """Test technology choice markdown formatting."""
        tech = TechnologyChoice(
            category="framework",
            selected="FastAPI",
            alternatives=["Flask", "Django"],
            rationale="Async support",
        )

        md = tech.to_markdown()

        assert "### Framework" in md
        assert "**Selected:** FastAPI" in md
        assert "**Alternatives:** Flask, Django" in md


class TestTechSurvey:
    """Tests for TechSurvey model."""

    def test_create_tech_survey(self) -> None:
        """Test creating a tech survey."""
        survey = TechSurvey.create(
            prd_reference="PRD-001",
            technologies=[
                TechnologyChoice(
                    category="language",
                    selected="Python",
                    rationale="Team expertise",
                )
            ],
            recommendations=["Use async where possible"],
        )

        assert survey.prd_reference == "PRD-001"
        assert len(survey.technologies) == 1
        assert survey.recommendations == ["Use async where possible"]

    def test_tech_survey_json_roundtrip(self) -> None:
        """Test JSON serialization roundtrip."""
        survey = TechSurvey.create(
            prd_reference="PRD-002",
            technologies=[
                TechnologyChoice(category="db", selected="PostgreSQL"),
            ],
            risk_assessment=[
                Risk(id="R1", description="Migration risk", level=RiskLevel.LOW),
            ],
        )

        json_str = survey.to_json()
        restored = TechSurvey.from_json(json_str)

        assert restored.prd_reference == survey.prd_reference
        assert len(restored.technologies) == 1
        assert restored.risk_assessment[0].level == RiskLevel.LOW

    def test_tech_survey_to_markdown(self) -> None:
        """Test tech survey markdown formatting."""
        survey = TechSurvey.create(
            prd_reference="PRD-003",
            technologies=[
                TechnologyChoice(category="cache", selected="Redis"),
            ],
            constraints_analysis={"Performance": "Must handle 10k req/s"},
            recommendations=["Use connection pooling"],
        )

        md = survey.to_markdown()

        assert "# Technology Survey" in md
        assert "**PRD Reference:** PRD-003" in md
        assert "## Recommendations" in md


class TestInterface:
    """Tests for Interface model."""

    def test_create_interface(self) -> None:
        """Test creating an interface."""
        iface = Interface(
            name="UserService",
            description="User management operations",
            methods=["create_user", "get_user", "delete_user"],
            data_types=["User", "UserCreate"],
        )

        assert iface.name == "UserService"
        assert len(iface.methods) == 3

    def test_interface_roundtrip(self) -> None:
        """Test interface serialization roundtrip."""
        iface = Interface(
            name="AuthService",
            description="Authentication",
            methods=["login", "logout"],
        )

        result = Interface.from_dict(iface.to_dict())

        assert result.name == iface.name
        assert result.methods == iface.methods


class TestComponent:
    """Tests for Component model."""

    def test_create_component(self) -> None:
        """Test creating a component."""
        component = Component(
            name="APIGateway",
            responsibility="Request routing and authentication",
            dependencies=["AuthService", "UserService"],
            technology="Python/FastAPI",
        )

        assert component.name == "APIGateway"
        assert len(component.dependencies) == 2

    def test_component_with_interfaces(self) -> None:
        """Test component with interfaces."""
        component = Component(
            name="UserService",
            responsibility="User management",
            interfaces=[
                Interface(name="IUserCRUD", methods=["create", "read"]),
            ],
        )

        assert len(component.interfaces) == 1
        assert component.interfaces[0].name == "IUserCRUD"

    def test_component_to_markdown(self) -> None:
        """Test component markdown formatting."""
        component = Component(
            name="DataStore",
            responsibility="Data persistence",
            technology="PostgreSQL",
            dependencies=["ConnectionPool"],
        )

        md = component.to_markdown()

        assert "### DataStore" in md
        assert "**Technology:** PostgreSQL" in md


class TestDiagramReference:
    """Tests for DiagramReference model."""

    def test_create_diagram(self) -> None:
        """Test creating a diagram reference."""
        diagram = DiagramReference(
            diagram_type=DiagramType.COMPONENT,
            title="System Architecture",
            mermaid_code="graph TD\n  A-->B",
            description="High-level component view",
        )

        assert diagram.diagram_type == DiagramType.COMPONENT
        assert "graph TD" in diagram.mermaid_code

    def test_diagram_to_markdown(self) -> None:
        """Test diagram markdown formatting."""
        diagram = DiagramReference(
            diagram_type=DiagramType.SEQUENCE,
            title="Login Flow",
            mermaid_code="sequenceDiagram\n  Client->>Server: Login",
        )

        md = diagram.to_markdown()

        assert "### Login Flow" in md
        assert "```mermaid" in md
        assert "sequenceDiagram" in md


class TestArchitecture:
    """Tests for Architecture model."""

    def test_create_architecture(self) -> None:
        """Test creating an architecture document."""
        arch = Architecture.create(
            style=ArchitectureStyle.MICROSERVICES,
            components=[
                Component(name="Gateway", responsibility="Routing"),
                Component(name="UserService", responsibility="Users"),
            ],
            data_flows=[
                DataFlow(source="Gateway", target="UserService", protocol="HTTP"),
            ],
            deployment_model="Kubernetes",
            diagrams=[
                DiagramReference(
                    diagram_type=DiagramType.COMPONENT,
                    title="Overview",
                    mermaid_code="graph TD\n  A-->B",
                ),
            ],
        )

        assert arch.style == ArchitectureStyle.MICROSERVICES
        assert len(arch.components) == 2
        assert len(arch.data_flows) == 1

    def test_architecture_json_roundtrip(self) -> None:
        """Test JSON serialization roundtrip."""
        arch = Architecture.create(
            style=ArchitectureStyle.EVENT_DRIVEN,
            components=[Component(name="Publisher", responsibility="Events")],
            data_flows=[],
            deployment_model="Docker",
            diagrams=[],
            nfr_considerations={"Scalability": "Horizontal scaling"},
        )

        json_str = arch.to_json()
        restored = Architecture.from_json(json_str)

        assert restored.style == arch.style
        assert restored.nfr_considerations["Scalability"] == "Horizontal scaling"

    def test_architecture_to_markdown(self) -> None:
        """Test architecture markdown formatting."""
        arch = Architecture.create(
            style=ArchitectureStyle.LAYERED,
            components=[Component(name="API", responsibility="Endpoints")],
            data_flows=[],
            deployment_model="AWS Lambda",
            diagrams=[],
            security_considerations=["Use TLS everywhere"],
        )

        md = arch.to_markdown()

        assert "# Architecture Document" in md
        assert "**Style:** Layered" in md
        assert "## Security Considerations" in md


class TestImplementationTask:
    """Tests for ImplementationTask model."""

    def test_create_task(self) -> None:
        """Test creating an implementation task."""
        task = ImplementationTask(
            id="T001",
            title="Setup database",
            description="Configure PostgreSQL",
            component="DataLayer",
            dependencies=[],
            acceptance_criteria=["DB responds to queries"],
            estimated_complexity=ComplexityLevel.MEDIUM,
        )

        assert task.id == "T001"
        assert task.estimated_complexity == ComplexityLevel.MEDIUM

    def test_task_with_dependencies(self) -> None:
        """Test task with dependencies."""
        task = ImplementationTask(
            id="T002",
            title="Add API endpoints",
            description="Create REST endpoints",
            component="API",
            dependencies=["T001"],
        )

        assert "T001" in task.dependencies

    def test_task_to_markdown(self) -> None:
        """Test task markdown formatting."""
        task = ImplementationTask(
            id="T003",
            title="Add authentication",
            description="Implement JWT auth",
            component="AuthService",
            acceptance_criteria=["Tokens validated", "Refresh works"],
        )

        md = task.to_markdown()

        assert "### T003: Add authentication" in md
        assert "- [ ] Tokens validated" in md


class TestImplementationPlan:
    """Tests for ImplementationPlan model."""

    def test_create_plan(self) -> None:
        """Test creating an implementation plan."""
        tasks = [
            ImplementationTask(
                id="T1", title="Setup", description="Initial setup",
                component="Core", estimated_complexity=ComplexityLevel.SMALL,
            ),
            ImplementationTask(
                id="T2", title="Build", description="Main build",
                component="Core", dependencies=["T1"],
                estimated_complexity=ComplexityLevel.LARGE,
            ),
        ]

        plan = ImplementationPlan.create(
            architecture_reference="ARCH-001",
            phases=[
                Phase(name="Setup", task_ids=["T1"], order=1),
                Phase(name="Build", task_ids=["T2"], order=2),
            ],
            tasks=tasks,
            critical_path=["T1", "T2"],
        )

        assert plan.architecture_reference == "ARCH-001"
        assert len(plan.tasks) == 2
        assert "10 hours" in plan.total_estimated_effort  # 2 + 8

    def test_plan_json_roundtrip(self) -> None:
        """Test JSON serialization roundtrip."""
        tasks = [
            ImplementationTask(
                id="T1", title="Task 1", description="First",
                component="Core",
            ),
        ]

        plan = ImplementationPlan.create(
            architecture_reference="ARCH-002",
            phases=[Phase(name="Phase 1", task_ids=["T1"])],
            tasks=tasks,
        )

        json_str = plan.to_json()
        restored = ImplementationPlan.from_json(json_str)

        assert restored.architecture_reference == plan.architecture_reference
        assert len(restored.tasks) == 1

    def test_plan_get_task_by_id(self) -> None:
        """Test getting task by ID."""
        tasks = [
            ImplementationTask(id="T1", title="First", description="", component="A"),
            ImplementationTask(id="T2", title="Second", description="", component="B"),
        ]

        plan = ImplementationPlan.create(
            architecture_reference="ARCH",
            phases=[],
            tasks=tasks,
        )

        task = plan.get_task_by_id("T2")
        assert task is not None
        assert task.title == "Second"

        missing = plan.get_task_by_id("T99")
        assert missing is None

    def test_plan_get_tasks_for_phase(self) -> None:
        """Test getting tasks for a phase."""
        tasks = [
            ImplementationTask(id="T1", title="A", description="", component="X"),
            ImplementationTask(id="T2", title="B", description="", component="X"),
            ImplementationTask(id="T3", title="C", description="", component="Y"),
        ]

        plan = ImplementationPlan.create(
            architecture_reference="ARCH",
            phases=[
                Phase(name="First", task_ids=["T1", "T2"]),
                Phase(name="Second", task_ids=["T3"]),
            ],
            tasks=tasks,
        )

        first_tasks = plan.get_tasks_for_phase("First")
        assert len(first_tasks) == 2
        assert first_tasks[0].id == "T1"

    def test_plan_get_dependency_graph(self) -> None:
        """Test getting dependency graph."""
        tasks = [
            ImplementationTask(id="T1", title="A", description="", component="X"),
            ImplementationTask(id="T2", title="B", description="", component="X", dependencies=["T1"]),
            ImplementationTask(id="T3", title="C", description="", component="X", dependencies=["T1", "T2"]),
        ]

        plan = ImplementationPlan.create(
            architecture_reference="ARCH",
            phases=[],
            tasks=tasks,
        )

        graph = plan.get_dependency_graph()

        assert graph["T1"] == []
        assert graph["T2"] == ["T1"]
        assert graph["T3"] == ["T1", "T2"]

    def test_plan_to_markdown(self) -> None:
        """Test plan markdown formatting."""
        tasks = [
            ImplementationTask(
                id="T1", title="Setup", description="Initial",
                component="Core", estimated_complexity=ComplexityLevel.SMALL,
            ),
        ]

        plan = ImplementationPlan.create(
            architecture_reference="ARCH-003",
            phases=[Phase(name="Setup", description="Initial setup", task_ids=["T1"], order=1)],
            tasks=tasks,
            critical_path=["T1"],
        )

        md = plan.to_markdown()

        assert "# Implementation Plan" in md
        assert "## Critical Path" in md
        assert "## Phases" in md
        assert "## Tasks" in md


class TestDesignResult:
    """Tests for DesignResult model."""

    def test_succeeded_result(self) -> None:
        """Test creating a successful result."""
        survey = TechSurvey.create("PRD", [])
        arch = Architecture.create(
            style=ArchitectureStyle.LAYERED,
            components=[],
            data_flows=[],
            deployment_model="Docker",
            diagrams=[],
        )
        plan = ImplementationPlan.create("ARCH", [], [])

        result = DesignResult.succeeded(
            tech_survey=survey,
            architecture=arch,
            implementation_plan=plan,
            hitl2_request_id="H2-001",
            hitl3_request_id="H3-001",
        )

        assert result.success is True
        assert result.tech_survey is not None
        assert result.hitl2_request_id == "H2-001"

    def test_failed_result(self) -> None:
        """Test creating a failed result."""
        result = DesignResult.failed("Something went wrong")

        assert result.success is False
        assert result.error_message == "Something went wrong"
        assert result.tech_survey is None

    def test_pending_hitl2_result(self) -> None:
        """Test creating a pending HITL-2 result."""
        result = DesignResult.pending_hitl2("H2-002")

        assert result.success is True
        assert result.hitl2_request_id == "H2-002"
        assert result.metadata["status"] == "pending_hitl2"

    def test_pending_hitl3_result(self) -> None:
        """Test creating a pending HITL-3 result."""
        survey = TechSurvey.create("PRD", [])
        arch = Architecture.create(
            style=ArchitectureStyle.LAYERED,
            components=[],
            data_flows=[],
            deployment_model="Docker",
            diagrams=[],
        )

        result = DesignResult.pending_hitl3(survey, arch, "H3-002")

        assert result.success is True
        assert result.hitl3_request_id == "H3-002"
        assert result.tech_survey is not None
        assert result.architecture is not None
        assert result.metadata["status"] == "pending_hitl3"

    def test_result_to_dict(self) -> None:
        """Test result serialization."""
        result = DesignResult.failed("Error message")

        data = result.to_dict()

        assert data["success"] is False
        assert data["error_message"] == "Error message"
        assert data["tech_survey"] is None
