"""Prompt templates for the Surveyor Agent.

Provides prompts for technology analysis, research synthesis,
and recommendation generation.
"""

from __future__ import annotations


SURVEYOR_SYSTEM_PROMPT = """You are a Technology Surveyor Agent specializing in analyzing software requirements and recommending technology choices.

Your role is to:
1. Analyze PRD documents to identify technology needs
2. Research and evaluate technology options
3. Make recommendations with clear rationale
4. Identify technical risks and constraints

You always respond with valid JSON matching the requested schema. Be thorough but concise in your rationale.
When multiple options are viable, explain trade-offs clearly.
"""


def format_technology_analysis_prompt(
    prd_content: str,
    context_pack_summary: str = "",
    existing_patterns: str = "",
) -> str:
    """Format the technology analysis prompt.

    Args:
        prd_content: The PRD document content (JSON or markdown).
        context_pack_summary: Summary from repo mapper context pack.
        existing_patterns: Description of existing technology patterns.

    Returns:
        str: Formatted prompt for technology analysis.
    """
    context_section = ""
    if context_pack_summary:
        context_section = f"""
## Existing Codebase Context
{context_pack_summary}
"""

    patterns_section = ""
    if existing_patterns:
        patterns_section = f"""
## Existing Technology Patterns
{existing_patterns}
"""

    return f"""Analyze the following PRD to identify technology needs and requirements.

## PRD Document
{prd_content}
{context_section}
{patterns_section}

## Task
Identify and categorize all technology requirements from the PRD. For each requirement:
1. Identify the technology category (language, framework, database, infrastructure, etc.)
2. Extract constraints from the PRD
3. Note any non-functional requirements affecting technology choice

Respond with JSON matching this schema:
```json
{{
  "technology_needs": [
    {{
      "category": "string (e.g., 'language', 'framework', 'database', 'message_queue', 'cache', 'cloud_provider')",
      "requirement": "string describing what is needed",
      "constraints": ["list of constraints"],
      "priority": "critical | high | medium | low",
      "nfr_impact": ["list of NFRs this affects (performance, scalability, security, etc.)"]
    }}
  ],
  "existing_decisions": [
    {{
      "category": "string",
      "decision": "string describing existing tech decision",
      "source": "prd | codebase | constraint"
    }}
  ],
  "research_topics": [
    "list of topics needing further research"
  ]
}}
```
"""


def format_research_synthesis_prompt(
    technology_needs: str,
    rlm_findings: str = "",
    additional_context: str = "",
) -> str:
    """Format the research synthesis prompt.

    Args:
        technology_needs: JSON string of technology needs from analysis.
        rlm_findings: Findings from RLM exploration (if any).
        additional_context: Any additional context or constraints.

    Returns:
        str: Formatted prompt for research synthesis.
    """
    rlm_section = ""
    if rlm_findings:
        rlm_section = f"""
## Research Findings (from RLM Exploration)
{rlm_findings}
"""

    context_section = ""
    if additional_context:
        context_section = f"""
## Additional Context
{additional_context}
"""

    return f"""Synthesize technology research to make informed recommendations.

## Technology Needs
{technology_needs}
{rlm_section}
{context_section}

## Task
For each technology category identified, research and evaluate options. Consider:
1. Compatibility with constraints and existing decisions
2. Maturity and community support
3. Performance characteristics
4. Learning curve and team expertise
5. Long-term maintenance burden

Respond with JSON matching this schema:
```json
{{
  "evaluations": [
    {{
      "category": "string",
      "options": [
        {{
          "name": "string",
          "pros": ["list of advantages"],
          "cons": ["list of disadvantages"],
          "fit_score": 1-5,
          "fit_rationale": "string explaining the score"
        }}
      ],
      "constraints_met": ["list of constraints this category must meet"],
      "recommendation": "string (name of recommended option)",
      "confidence": "high | medium | low"
    }}
  ],
  "integration_notes": [
    "notes about how technologies integrate together"
  ],
  "concerns": [
    "any concerns or risks identified during research"
  ]
}}
```
"""


def format_recommendation_prompt(
    evaluations: str,
    prd_reference: str,
    constraints_summary: str = "",
) -> str:
    """Format the final recommendation generation prompt.

    Args:
        evaluations: JSON string of technology evaluations.
        prd_reference: Reference identifier for the source PRD.
        constraints_summary: Summary of key constraints.

    Returns:
        str: Formatted prompt for recommendation generation.
    """
    constraints_section = ""
    if constraints_summary:
        constraints_section = f"""
## Key Constraints
{constraints_summary}
"""

    return f"""Generate final technology recommendations based on evaluations.

## PRD Reference
{prd_reference}

## Technology Evaluations
{evaluations}
{constraints_section}

## Task
Create the final technology survey document with:
1. Clear technology choices for each category
2. Rationale for each choice
3. Alternatives considered
4. Risk assessment
5. Final recommendations

Respond with JSON matching this schema:
```json
{{
  "technologies": [
    {{
      "category": "string",
      "selected": "string (chosen technology)",
      "alternatives": ["list of alternatives considered"],
      "rationale": "string explaining the choice",
      "constraints": ["constraints affecting this choice"]
    }}
  ],
  "constraints_analysis": {{
    "constraint_name": "analysis of how constraint is addressed"
  }},
  "risk_assessment": [
    {{
      "id": "RISK-001",
      "description": "string",
      "level": "low | medium | high | critical",
      "mitigation": "string",
      "impact": "string"
    }}
  ],
  "recommendations": [
    "list of final recommendations and next steps"
  ]
}}
```
"""


def format_rlm_trigger_prompt(
    technology_needs: str,
    unknown_technologies: list[str],
) -> str:
    """Format prompt to determine if RLM exploration is needed.

    Args:
        technology_needs: JSON string of technology needs.
        unknown_technologies: List of technologies needing research.

    Returns:
        str: Formatted prompt for RLM trigger decision.
    """
    tech_list = "\n".join(f"- {tech}" for tech in unknown_technologies)

    return f"""Determine if deep research is needed for technology decisions.

## Technology Needs
{technology_needs}

## Technologies Requiring Research
{tech_list}

## Task
Analyze whether these technologies require deep research (RLM exploration).

Consider:
1. Is this a well-known, established technology?
2. Are there complex integration considerations?
3. Is there significant uncertainty about fit?
4. Could wrong choice have major impact?

Respond with JSON:
```json
{{
  "needs_research": true | false,
  "research_priority": "high | medium | low",
  "research_queries": [
    "specific queries to research (if needs_research is true)"
  ],
  "reasoning": "explanation of decision"
}}
```
"""


# Example few-shot examples for better LLM performance
TECHNOLOGY_ANALYSIS_EXAMPLE = """
Example input (PRD excerpt):
"The system must handle 10,000 concurrent users with sub-100ms response times.
It should integrate with existing PostgreSQL database and use REST APIs."

Example output:
{
  "technology_needs": [
    {
      "category": "language",
      "requirement": "High-performance language for handling concurrent requests",
      "constraints": ["must support async/concurrent patterns"],
      "priority": "critical",
      "nfr_impact": ["performance", "scalability"]
    },
    {
      "category": "database",
      "requirement": "Integrate with existing PostgreSQL",
      "constraints": ["must be PostgreSQL-compatible"],
      "priority": "high",
      "nfr_impact": ["compatibility"]
    }
  ],
  "existing_decisions": [
    {
      "category": "database",
      "decision": "PostgreSQL",
      "source": "prd"
    }
  ],
  "research_topics": [
    "async frameworks for sub-100ms response times",
    "PostgreSQL connection pooling for high concurrency"
  ]
}
"""


RECOMMENDATION_EXAMPLE = """
Example output:
{
  "technologies": [
    {
      "category": "language",
      "selected": "Python 3.11+",
      "alternatives": ["Go", "Node.js"],
      "rationale": "Excellent async support with asyncio, team expertise, rich ecosystem",
      "constraints": ["Must support async patterns - met via asyncio"]
    }
  ],
  "constraints_analysis": {
    "sub-100ms response": "Achieved through async architecture and connection pooling",
    "10k concurrent users": "Addressed via horizontal scaling and Redis caching"
  },
  "risk_assessment": [
    {
      "id": "RISK-001",
      "description": "Python GIL may limit CPU-bound operations",
      "level": "medium",
      "mitigation": "Use multiprocessing for CPU-intensive tasks",
      "impact": "May need to offload heavy computation to workers"
    }
  ],
  "recommendations": [
    "Implement connection pooling from day one",
    "Add Redis caching layer for frequently accessed data",
    "Design for horizontal scaling"
  ]
}
"""
