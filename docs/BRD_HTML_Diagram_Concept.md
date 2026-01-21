# aSDLC HTML Blueprint Diagram BRD

**Version:** 1.1  
**Date:** January 21, 2026  
**Status:** Draft  
**Owner:** Product and Architecture  

## 1. Purpose

Define requirements for an **offline, self-contained HTML diagram** that communicates the aSDLC Master Blueprint operating model: clusters, agents, artifacts, HITL gates, and the knowledge bus. The diagram is a **communication artifact**; it does not execute workflows.

## 2. Background and problem

Agentic SDLC systems are hard to explain and govern because:
- “Who does what” across many specialized agents becomes ambiguous.
- Governance gates and artifact ownership are often implicit.
- Teams conflate visualization of the orchestration with the runtime implementation.

The HTML blueprint diagram provides a durable reference that:
- Aligns humans on the operating model.
- Provides onboarding and review support.
- Enables fast discussions without opening code or running the system.

## 3. Goals

G1. Provide a single-page, readable visual of the end-to-end aSDLC flow from Discovery to Deployment.  
G2. Make governance explicit: Spec Index, artifact ownership, and HITL ladder.  
G3. Represent the “knowledge bus” concept abstractly, without binding to a specific runtime implementation.  
G4. Provide interaction aids: tooltips, legend, and links to associated markdown artifacts and policies.  
G5. Remain portable and offline.

## 4. Non-goals

- Running or orchestrating agents.
- Performing real-time status monitoring.
- Acting as a source of truth for runtime state (Git is the source of truth).

## 5. Stakeholders

- Product Owner: epic scope, HITL gates 0 and 1.
- Engineering Leads: cluster responsibilities and quality gates.
- Platform Engineering: tool abstraction and deployment patterns.
- Security: auditability and guardrails.
- New contributors: onboarding and mental model.

## 6. Functional requirements

### FR1. Cluster visualization

The diagram MUST show the clusters as distinct columns with clear labels:
1. Discovery (Epic level)  
2. Design (Architecture planning)  
3. Development (TDD engine)  
4. Validation  
5. Deployment  

It MAY show Governance as an overlay or separate control plane element.

### FR2. Agent listing and roles

Within each cluster, the diagram MUST list the key agents and their roles, for example:
- Discovery: PRD, UI/UX, Acceptance
- Design: Arch Surveyor, Solution Architect, Planner
- Development: UTest, Coding, Debugger, Reviewer
- Validation: Validation, Security
- Deployment: Release Mgmt, Deployment, Env Monitoring

### FR3. HITL gate ladder

The diagram MUST display the HITL gates as explicit steps and associate them with the appropriate transition points.

Minimum gates:
- HITL 0: Intent and Epic creation  
- HITL 1: Backlog approval  
- HITL 2: Design sign-off  
- HITL 3: Task plan approval  
- HITL 4: Implementation review  
- HITL 5: Quality gate  
- HITL 6: Release authorization  

### FR4. Artifact ownership and “Git-first truth”

The diagram MUST explicitly communicate:
- Spec artifacts are versioned in Git.
- The Spec Index is the canonical registry of artifacts (for example `spec_index.md`).
- Jira and runtime state reference Git commits for traceability.

### FR5. Knowledge bus concept

The diagram MUST include a “knowledge bus” element labeled as an abstraction:
- It represents the shared context and coordination mechanism.
- The runtime implementation MAY be Redis Streams, MCP servers, or other tool services.
- The diagram MUST NOT imply that MCP is required in the prototype.

Suggested text: “Knowledge bus concept (runtime implemented via Redis Streams in prototype).”

### FR6. RLM indication (optional but recommended)

The diagram SHOULD support indicating which agents are “RLM-enabled” vs “standard inference,” using a simple icon or badge.

### FR7. Navigation links

The diagram SHOULD include optional links to:
- Policies (guardrails, tool contracts)
- Spec artifacts directory
- System design doc
- Legend and glossary section anchors

## 7. Non-functional requirements

NFR1. Offline portability: single HTML file with embedded assets where practical.  
NFR2. Compatibility: latest Chrome and Safari.  
NFR3. Performance: load in under 1 second on a standard laptop.  
NFR4. Maintainability: diagram content should be editable via clear HTML sections and CSS classes.  
NFR5. Accessibility: readable typography and sufficient contrast; tooltips keyboard accessible if feasible.

## 8. Constraints

- No external network calls in the default build.
- Use static assets or embedded resources.

## 9. Risks and mitigations

R1. Diagram is treated as runtime truth.  
Mitigation: include “Visualization only” banner and a Git-truth statement.

R2. Diagram drifts from implementation.  
Mitigation: include version and link to `spec_index.md`; add a lightweight review checklist.

R3. Overly detailed diagram reduces readability.  
Mitigation: default view is high-level; details available via tooltips and expandable sections.

## 10. Acceptance criteria

- A stakeholder can identify cluster roles, HITL gates, and the Spec Index concept in under 3 minutes.
- The file loads offline and renders correctly.
- The knowledge bus is clearly described as a conceptual element and not tied to a single implementation.
- Optional RLM badges can be toggled on and off without changing layout.

## 11. Open questions

Q1. Should the diagram include per-agent tool permissions, or remain at a conceptual level?  
Q2. Should the diagram show the knowledge bus as “MCP” text, or use a neutral label and show MCP as one possible implementation?  
Q3. Should the diagram indicate which agents are RLM-enabled vs standard inference, and if yes, what is the visual vocabulary (badge, icon, legend)?

## 12. Appendix: terminology

- **SDD:** Spec Driven Development  
- **HITL:** Human In The Loop gate  
- **Knowledge bus:** shared coordination and context interface abstraction  
- **RLM:** Recursive Language Model execution mode (REPL pattern with tool access)  
