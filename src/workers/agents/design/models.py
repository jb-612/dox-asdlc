"""Domain models for Design agents.

Defines data structures for technology surveys, architecture documents,
and implementation plans produced by the design phase agents.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any


class RiskLevel(str, Enum):
    """Risk severity levels."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ComplexityLevel(str, Enum):
    """Task complexity levels."""

    SMALL = "S"
    MEDIUM = "M"
    LARGE = "L"
    EXTRA_LARGE = "XL"


class ArchitectureStyle(str, Enum):
    """Architecture style patterns."""

    MONOLITH = "monolith"
    MICROSERVICES = "microservices"
    EVENT_DRIVEN = "event_driven"
    SERVERLESS = "serverless"
    LAYERED = "layered"
    MODULAR_MONOLITH = "modular_monolith"


class DiagramType(str, Enum):
    """Types of architecture diagrams."""

    COMPONENT = "component"
    SEQUENCE = "sequence"
    FLOW = "flow"
    ERD = "erd"
    DEPLOYMENT = "deployment"
    CLASS = "class"


@dataclass
class Risk:
    """Risk assessment entry.

    Attributes:
        id: Unique risk identifier.
        description: Risk description.
        level: Risk severity level.
        mitigation: Proposed mitigation strategy.
        impact: Potential impact description.
    """

    id: str
    description: str
    level: RiskLevel = RiskLevel.MEDIUM
    mitigation: str = ""
    impact: str = ""

    def to_dict(self) -> dict[str, Any]:
        """Serialize risk to dictionary."""
        return {
            "id": self.id,
            "description": self.description,
            "level": self.level.value,
            "mitigation": self.mitigation,
            "impact": self.impact,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Risk:
        """Create risk from dictionary."""
        return cls(
            id=data.get("id", ""),
            description=data.get("description", ""),
            level=RiskLevel(data.get("level", "medium")),
            mitigation=data.get("mitigation", ""),
            impact=data.get("impact", ""),
        )


@dataclass
class TechnologyChoice:
    """Technology decision with rationale.

    Attributes:
        category: Technology category (e.g., "language", "framework").
        selected: Chosen technology.
        alternatives: Considered alternatives.
        rationale: Explanation for the choice.
        constraints: Any constraints affecting the choice.
    """

    category: str
    selected: str
    alternatives: list[str] = field(default_factory=list)
    rationale: str = ""
    constraints: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """Serialize to dictionary."""
        return {
            "category": self.category,
            "selected": self.selected,
            "alternatives": self.alternatives,
            "rationale": self.rationale,
            "constraints": self.constraints,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> TechnologyChoice:
        """Create from dictionary."""
        return cls(
            category=data.get("category", ""),
            selected=data.get("selected", ""),
            alternatives=data.get("alternatives", []),
            rationale=data.get("rationale", ""),
            constraints=data.get("constraints", []),
        )

    def to_markdown(self) -> str:
        """Format as markdown."""
        lines = [
            f"### {self.category.title()}",
            "",
            f"**Selected:** {self.selected}",
        ]
        if self.alternatives:
            lines.append(f"**Alternatives:** {', '.join(self.alternatives)}")
        if self.rationale:
            lines.extend(["", f"**Rationale:** {self.rationale}"])
        if self.constraints:
            lines.extend(["", "**Constraints:**"])
            for constraint in self.constraints:
                lines.append(f"- {constraint}")
        return "\n".join(lines)


@dataclass
class TechSurvey:
    """Technology survey document.

    Attributes:
        prd_reference: Reference to source PRD.
        created_at: Creation timestamp.
        technologies: Technology choices made.
        constraints_analysis: Analysis of constraints.
        risk_assessment: Identified risks.
        recommendations: Final recommendations.
        metadata: Additional metadata.
    """

    prd_reference: str
    created_at: datetime
    technologies: list[TechnologyChoice]
    constraints_analysis: dict[str, str] = field(default_factory=dict)
    risk_assessment: list[Risk] = field(default_factory=list)
    recommendations: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def create(
        cls,
        prd_reference: str,
        technologies: list[TechnologyChoice],
        constraints_analysis: dict[str, str] | None = None,
        risk_assessment: list[Risk] | None = None,
        recommendations: list[str] | None = None,
    ) -> TechSurvey:
        """Create a new tech survey."""
        return cls(
            prd_reference=prd_reference,
            created_at=datetime.now(timezone.utc),
            technologies=technologies,
            constraints_analysis=constraints_analysis or {},
            risk_assessment=risk_assessment or [],
            recommendations=recommendations or [],
        )

    def to_dict(self) -> dict[str, Any]:
        """Serialize to dictionary."""
        return {
            "prd_reference": self.prd_reference,
            "created_at": self.created_at.isoformat(),
            "technologies": [t.to_dict() for t in self.technologies],
            "constraints_analysis": self.constraints_analysis,
            "risk_assessment": [r.to_dict() for r in self.risk_assessment],
            "recommendations": self.recommendations,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> TechSurvey:
        """Create from dictionary."""
        return cls(
            prd_reference=data.get("prd_reference", ""),
            created_at=datetime.fromisoformat(
                data.get("created_at", datetime.now(timezone.utc).isoformat())
            ),
            technologies=[
                TechnologyChoice.from_dict(t) for t in data.get("technologies", [])
            ],
            constraints_analysis=data.get("constraints_analysis", {}),
            risk_assessment=[
                Risk.from_dict(r) for r in data.get("risk_assessment", [])
            ],
            recommendations=data.get("recommendations", []),
            metadata=data.get("metadata", {}),
        )

    def to_json(self, indent: int = 2) -> str:
        """Serialize to JSON string."""
        return json.dumps(self.to_dict(), indent=indent)

    @classmethod
    def from_json(cls, json_str: str) -> TechSurvey:
        """Create from JSON string."""
        return cls.from_dict(json.loads(json_str))

    def to_markdown(self) -> str:
        """Format as markdown document."""
        lines = [
            "# Technology Survey",
            "",
            f"**PRD Reference:** {self.prd_reference}",
            f"**Created:** {self.created_at.strftime('%Y-%m-%d')}",
            "",
            "## Technology Choices",
        ]

        for tech in self.technologies:
            lines.extend(["", tech.to_markdown()])

        if self.constraints_analysis:
            lines.extend(["", "## Constraints Analysis", ""])
            for key, value in self.constraints_analysis.items():
                lines.append(f"**{key}:** {value}")

        if self.risk_assessment:
            lines.extend([
                "",
                "## Risk Assessment",
                "",
                "| ID | Risk | Level | Mitigation |",
                "|---|---|---|---|",
            ])
            for risk in self.risk_assessment:
                lines.append(
                    f"| {risk.id} | {risk.description[:40]}... | {risk.level.value} | {risk.mitigation[:40]}... |"
                )

        if self.recommendations:
            lines.extend(["", "## Recommendations", ""])
            for rec in self.recommendations:
                lines.append(f"- {rec}")

        return "\n".join(lines)


@dataclass
class Interface:
    """Component interface definition.

    Attributes:
        name: Interface name.
        description: Interface description.
        methods: Method signatures.
        data_types: Data types used.
    """

    name: str
    description: str = ""
    methods: list[str] = field(default_factory=list)
    data_types: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """Serialize to dictionary."""
        return {
            "name": self.name,
            "description": self.description,
            "methods": self.methods,
            "data_types": self.data_types,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Interface:
        """Create from dictionary."""
        return cls(
            name=data.get("name", ""),
            description=data.get("description", ""),
            methods=data.get("methods", []),
            data_types=data.get("data_types", []),
        )


@dataclass
class DataFlow:
    """Data flow between components.

    Attributes:
        source: Source component name.
        target: Target component name.
        data_type: Type of data flowing.
        description: Flow description.
        protocol: Communication protocol.
    """

    source: str
    target: str
    data_type: str = ""
    description: str = ""
    protocol: str = ""

    def to_dict(self) -> dict[str, Any]:
        """Serialize to dictionary."""
        return {
            "source": self.source,
            "target": self.target,
            "data_type": self.data_type,
            "description": self.description,
            "protocol": self.protocol,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> DataFlow:
        """Create from dictionary."""
        return cls(
            source=data.get("source", ""),
            target=data.get("target", ""),
            data_type=data.get("data_type", ""),
            description=data.get("description", ""),
            protocol=data.get("protocol", ""),
        )


@dataclass
class DiagramReference:
    """Reference to an architecture diagram.

    Attributes:
        diagram_type: Type of diagram.
        title: Diagram title.
        mermaid_code: Mermaid diagram code.
        description: Diagram description.
    """

    diagram_type: DiagramType
    title: str
    mermaid_code: str
    description: str = ""

    def to_dict(self) -> dict[str, Any]:
        """Serialize to dictionary."""
        return {
            "diagram_type": self.diagram_type.value,
            "title": self.title,
            "mermaid_code": self.mermaid_code,
            "description": self.description,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> DiagramReference:
        """Create from dictionary."""
        return cls(
            diagram_type=DiagramType(data.get("diagram_type", "component")),
            title=data.get("title", ""),
            mermaid_code=data.get("mermaid_code", ""),
            description=data.get("description", ""),
        )

    def to_markdown(self) -> str:
        """Format as markdown with mermaid code block."""
        lines = [
            f"### {self.title}",
            "",
        ]
        if self.description:
            lines.extend([self.description, ""])
        lines.extend([
            "```mermaid",
            self.mermaid_code,
            "```",
        ])
        return "\n".join(lines)


@dataclass
class Component:
    """Architecture component definition.

    Attributes:
        name: Component name.
        responsibility: Primary responsibility.
        interfaces: Provided interfaces.
        dependencies: Component dependencies.
        technology: Technology stack used.
        notes: Additional notes.
    """

    name: str
    responsibility: str
    interfaces: list[Interface] = field(default_factory=list)
    dependencies: list[str] = field(default_factory=list)
    technology: str = ""
    notes: str = ""

    def to_dict(self) -> dict[str, Any]:
        """Serialize to dictionary."""
        return {
            "name": self.name,
            "responsibility": self.responsibility,
            "interfaces": [i.to_dict() for i in self.interfaces],
            "dependencies": self.dependencies,
            "technology": self.technology,
            "notes": self.notes,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Component:
        """Create from dictionary."""
        return cls(
            name=data.get("name", ""),
            responsibility=data.get("responsibility", ""),
            interfaces=[
                Interface.from_dict(i) for i in data.get("interfaces", [])
            ],
            dependencies=data.get("dependencies", []),
            technology=data.get("technology", ""),
            notes=data.get("notes", ""),
        )

    def to_markdown(self) -> str:
        """Format as markdown."""
        lines = [
            f"### {self.name}",
            "",
            f"**Responsibility:** {self.responsibility}",
        ]
        if self.technology:
            lines.append(f"**Technology:** {self.technology}")
        if self.dependencies:
            lines.append(f"**Dependencies:** {', '.join(self.dependencies)}")
        if self.interfaces:
            lines.extend(["", "**Interfaces:**"])
            for iface in self.interfaces:
                lines.append(f"- {iface.name}: {iface.description}")
        if self.notes:
            lines.extend(["", f"**Notes:** {self.notes}"])
        return "\n".join(lines)


@dataclass
class Architecture:
    """Complete architecture document.

    Attributes:
        style: Architecture style pattern.
        components: System components.
        data_flows: Data flows between components.
        deployment_model: Deployment strategy.
        diagrams: Architecture diagrams.
        nfr_considerations: Non-functional requirement notes.
        security_considerations: Security notes.
        created_at: Creation timestamp.
        tech_survey_reference: Reference to tech survey.
        metadata: Additional metadata.
    """

    style: ArchitectureStyle
    components: list[Component]
    data_flows: list[DataFlow]
    deployment_model: str
    diagrams: list[DiagramReference]
    nfr_considerations: dict[str, str] = field(default_factory=dict)
    security_considerations: list[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    tech_survey_reference: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def create(
        cls,
        style: ArchitectureStyle,
        components: list[Component],
        data_flows: list[DataFlow],
        deployment_model: str,
        diagrams: list[DiagramReference],
        tech_survey_reference: str = "",
        nfr_considerations: dict[str, str] | None = None,
        security_considerations: list[str] | None = None,
    ) -> Architecture:
        """Create a new architecture document."""
        return cls(
            style=style,
            components=components,
            data_flows=data_flows,
            deployment_model=deployment_model,
            diagrams=diagrams,
            tech_survey_reference=tech_survey_reference,
            nfr_considerations=nfr_considerations or {},
            security_considerations=security_considerations or [],
        )

    def to_dict(self) -> dict[str, Any]:
        """Serialize to dictionary."""
        return {
            "style": self.style.value,
            "components": [c.to_dict() for c in self.components],
            "data_flows": [d.to_dict() for d in self.data_flows],
            "deployment_model": self.deployment_model,
            "diagrams": [d.to_dict() for d in self.diagrams],
            "nfr_considerations": self.nfr_considerations,
            "security_considerations": self.security_considerations,
            "created_at": self.created_at.isoformat(),
            "tech_survey_reference": self.tech_survey_reference,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Architecture:
        """Create from dictionary."""
        return cls(
            style=ArchitectureStyle(data.get("style", "layered")),
            components=[
                Component.from_dict(c) for c in data.get("components", [])
            ],
            data_flows=[
                DataFlow.from_dict(d) for d in data.get("data_flows", [])
            ],
            deployment_model=data.get("deployment_model", ""),
            diagrams=[
                DiagramReference.from_dict(d) for d in data.get("diagrams", [])
            ],
            nfr_considerations=data.get("nfr_considerations", {}),
            security_considerations=data.get("security_considerations", []),
            created_at=datetime.fromisoformat(
                data.get("created_at", datetime.now(timezone.utc).isoformat())
            ),
            tech_survey_reference=data.get("tech_survey_reference", ""),
            metadata=data.get("metadata", {}),
        )

    def to_json(self, indent: int = 2) -> str:
        """Serialize to JSON string."""
        return json.dumps(self.to_dict(), indent=indent)

    @classmethod
    def from_json(cls, json_str: str) -> Architecture:
        """Create from JSON string."""
        return cls.from_dict(json.loads(json_str))

    def to_markdown(self) -> str:
        """Format as markdown document."""
        lines = [
            "# Architecture Document",
            "",
            f"**Style:** {self.style.value.replace('_', ' ').title()}",
            f"**Created:** {self.created_at.strftime('%Y-%m-%d')}",
            f"**Deployment Model:** {self.deployment_model}",
        ]
        if self.tech_survey_reference:
            lines.append(f"**Tech Survey:** {self.tech_survey_reference}")

        lines.extend(["", "## Components"])
        for component in self.components:
            lines.extend(["", component.to_markdown()])

        if self.data_flows:
            lines.extend([
                "",
                "## Data Flows",
                "",
                "| Source | Target | Data Type | Protocol |",
                "|---|---|---|---|",
            ])
            for flow in self.data_flows:
                lines.append(
                    f"| {flow.source} | {flow.target} | {flow.data_type} | {flow.protocol} |"
                )

        if self.diagrams:
            lines.extend(["", "## Diagrams"])
            for diagram in self.diagrams:
                lines.extend(["", diagram.to_markdown()])

        if self.nfr_considerations:
            lines.extend(["", "## Non-Functional Requirements", ""])
            for key, value in self.nfr_considerations.items():
                lines.append(f"**{key}:** {value}")

        if self.security_considerations:
            lines.extend(["", "## Security Considerations", ""])
            for consideration in self.security_considerations:
                lines.append(f"- {consideration}")

        return "\n".join(lines)


@dataclass
class ImplementationTask:
    """Individual implementation task.

    Attributes:
        id: Unique task identifier.
        title: Task title.
        description: Detailed description.
        component: Target component name.
        dependencies: Task dependencies (other task IDs).
        acceptance_criteria: Acceptance criteria list.
        estimated_complexity: Complexity estimate.
        metadata: Additional metadata.
    """

    id: str
    title: str
    description: str
    component: str
    dependencies: list[str] = field(default_factory=list)
    acceptance_criteria: list[str] = field(default_factory=list)
    estimated_complexity: ComplexityLevel = ComplexityLevel.MEDIUM
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Serialize to dictionary."""
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "component": self.component,
            "dependencies": self.dependencies,
            "acceptance_criteria": self.acceptance_criteria,
            "estimated_complexity": self.estimated_complexity.value,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ImplementationTask:
        """Create from dictionary."""
        return cls(
            id=data.get("id", ""),
            title=data.get("title", ""),
            description=data.get("description", ""),
            component=data.get("component", ""),
            dependencies=data.get("dependencies", []),
            acceptance_criteria=data.get("acceptance_criteria", []),
            estimated_complexity=ComplexityLevel(data.get("estimated_complexity", "M")),
            metadata=data.get("metadata", {}),
        )

    def to_markdown(self) -> str:
        """Format as markdown."""
        lines = [
            f"### {self.id}: {self.title}",
            "",
            f"**Component:** {self.component}",
            f"**Complexity:** {self.estimated_complexity.value}",
        ]
        if self.dependencies:
            lines.append(f"**Dependencies:** {', '.join(self.dependencies)}")
        lines.extend(["", self.description])
        if self.acceptance_criteria:
            lines.extend(["", "**Acceptance Criteria:**"])
            for criterion in self.acceptance_criteria:
                lines.append(f"- [ ] {criterion}")
        return "\n".join(lines)


@dataclass
class Phase:
    """Implementation phase grouping tasks.

    Attributes:
        name: Phase name.
        description: Phase description.
        task_ids: Tasks in this phase.
        order: Phase execution order.
    """

    name: str
    description: str = ""
    task_ids: list[str] = field(default_factory=list)
    order: int = 0

    def to_dict(self) -> dict[str, Any]:
        """Serialize to dictionary."""
        return {
            "name": self.name,
            "description": self.description,
            "task_ids": self.task_ids,
            "order": self.order,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Phase:
        """Create from dictionary."""
        return cls(
            name=data.get("name", ""),
            description=data.get("description", ""),
            task_ids=data.get("task_ids", []),
            order=data.get("order", 0),
        )


@dataclass
class ImplementationPlan:
    """Complete implementation plan.

    Attributes:
        architecture_reference: Reference to architecture document.
        created_at: Creation timestamp.
        phases: Implementation phases.
        tasks: All implementation tasks.
        critical_path: Task IDs on critical path.
        total_estimated_effort: Total effort estimate.
        metadata: Additional metadata.
    """

    architecture_reference: str
    created_at: datetime
    phases: list[Phase]
    tasks: list[ImplementationTask]
    critical_path: list[str] = field(default_factory=list)
    total_estimated_effort: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def create(
        cls,
        architecture_reference: str,
        phases: list[Phase],
        tasks: list[ImplementationTask],
        critical_path: list[str] | None = None,
    ) -> ImplementationPlan:
        """Create a new implementation plan."""
        # Calculate estimated effort
        effort_map = {
            ComplexityLevel.SMALL: 2,
            ComplexityLevel.MEDIUM: 4,
            ComplexityLevel.LARGE: 8,
            ComplexityLevel.EXTRA_LARGE: 16,
        }
        total_hours = sum(effort_map[t.estimated_complexity] for t in tasks)

        return cls(
            architecture_reference=architecture_reference,
            created_at=datetime.now(timezone.utc),
            phases=phases,
            tasks=tasks,
            critical_path=critical_path or [],
            total_estimated_effort=f"{total_hours} hours",
        )

    def to_dict(self) -> dict[str, Any]:
        """Serialize to dictionary."""
        return {
            "architecture_reference": self.architecture_reference,
            "created_at": self.created_at.isoformat(),
            "phases": [p.to_dict() for p in self.phases],
            "tasks": [t.to_dict() for t in self.tasks],
            "critical_path": self.critical_path,
            "total_estimated_effort": self.total_estimated_effort,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ImplementationPlan:
        """Create from dictionary."""
        return cls(
            architecture_reference=data.get("architecture_reference", ""),
            created_at=datetime.fromisoformat(
                data.get("created_at", datetime.now(timezone.utc).isoformat())
            ),
            phases=[Phase.from_dict(p) for p in data.get("phases", [])],
            tasks=[
                ImplementationTask.from_dict(t) for t in data.get("tasks", [])
            ],
            critical_path=data.get("critical_path", []),
            total_estimated_effort=data.get("total_estimated_effort", ""),
            metadata=data.get("metadata", {}),
        )

    def to_json(self, indent: int = 2) -> str:
        """Serialize to JSON string."""
        return json.dumps(self.to_dict(), indent=indent)

    @classmethod
    def from_json(cls, json_str: str) -> ImplementationPlan:
        """Create from JSON string."""
        return cls.from_dict(json.loads(json_str))

    def to_markdown(self) -> str:
        """Format as markdown document."""
        lines = [
            "# Implementation Plan",
            "",
            f"**Architecture Reference:** {self.architecture_reference}",
            f"**Created:** {self.created_at.strftime('%Y-%m-%d')}",
            f"**Total Estimated Effort:** {self.total_estimated_effort}",
        ]

        if self.critical_path:
            lines.extend([
                "",
                "## Critical Path",
                "",
                " → ".join(self.critical_path),
            ])

        lines.extend(["", "## Phases"])
        for phase in sorted(self.phases, key=lambda p: p.order):
            lines.extend([
                "",
                f"### Phase {phase.order}: {phase.name}",
                "",
                phase.description,
                "",
                f"**Tasks:** {', '.join(phase.task_ids)}",
            ])

        lines.extend([
            "",
            "## Tasks",
            "",
            "| ID | Title | Component | Complexity | Dependencies |",
            "|---|---|---|---|---|",
        ])
        for task in self.tasks:
            deps = ", ".join(task.dependencies) or "None"
            lines.append(
                f"| {task.id} | {task.title} | {task.component} | {task.estimated_complexity.value} | {deps} |"
            )

        lines.extend(["", "## Task Details"])
        for task in self.tasks:
            lines.extend(["", task.to_markdown()])

        return "\n".join(lines)

    def get_task_by_id(self, task_id: str) -> ImplementationTask | None:
        """Get a task by its ID."""
        for task in self.tasks:
            if task.id == task_id:
                return task
        return None

    def get_tasks_for_phase(self, phase_name: str) -> list[ImplementationTask]:
        """Get all tasks for a specific phase."""
        for phase in self.phases:
            if phase.name == phase_name:
                return [
                    task for task in self.tasks
                    if task.id in phase.task_ids
                ]
        return []

    def get_dependency_graph(self) -> dict[str, list[str]]:
        """Get task dependency graph."""
        return {task.id: task.dependencies for task in self.tasks}


@dataclass
class DesignResult:
    """Result from the design workflow.

    Attributes:
        success: Whether design completed successfully.
        tech_survey: Generated tech survey (if successful).
        architecture: Generated architecture (if successful).
        implementation_plan: Generated plan (if successful).
        error_message: Error description (if failed).
        hitl2_request_id: HITL-2 gate request ID.
        hitl3_request_id: HITL-3 gate request ID.
        metadata: Additional result metadata.
    """

    success: bool
    tech_survey: TechSurvey | None = None
    architecture: Architecture | None = None
    implementation_plan: ImplementationPlan | None = None
    error_message: str | None = None
    hitl2_request_id: str | None = None
    hitl3_request_id: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def succeeded(
        cls,
        tech_survey: TechSurvey,
        architecture: Architecture,
        implementation_plan: ImplementationPlan,
        hitl2_request_id: str | None = None,
        hitl3_request_id: str | None = None,
    ) -> DesignResult:
        """Create successful result."""
        return cls(
            success=True,
            tech_survey=tech_survey,
            architecture=architecture,
            implementation_plan=implementation_plan,
            hitl2_request_id=hitl2_request_id,
            hitl3_request_id=hitl3_request_id,
        )

    @classmethod
    def failed(cls, error_message: str) -> DesignResult:
        """Create failed result."""
        return cls(
            success=False,
            error_message=error_message,
        )

    @classmethod
    def pending_hitl2(cls, hitl2_request_id: str) -> DesignResult:
        """Create result pending HITL-2 approval."""
        return cls(
            success=True,
            hitl2_request_id=hitl2_request_id,
            metadata={"status": "pending_hitl2"},
        )

    @classmethod
    def pending_hitl3(
        cls,
        tech_survey: TechSurvey,
        architecture: Architecture,
        hitl3_request_id: str,
    ) -> DesignResult:
        """Create result pending HITL-3 approval."""
        return cls(
            success=True,
            tech_survey=tech_survey,
            architecture=architecture,
            hitl3_request_id=hitl3_request_id,
            metadata={"status": "pending_hitl3"},
        )

    def to_dict(self) -> dict[str, Any]:
        """Serialize to dictionary."""
        return {
            "success": self.success,
            "tech_survey": self.tech_survey.to_dict() if self.tech_survey else None,
            "architecture": self.architecture.to_dict() if self.architecture else None,
            "implementation_plan": (
                self.implementation_plan.to_dict() if self.implementation_plan else None
            ),
            "error_message": self.error_message,
            "hitl2_request_id": self.hitl2_request_id,
            "hitl3_request_id": self.hitl3_request_id,
            "metadata": self.metadata,
        }
