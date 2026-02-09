"""Detects task context from user prompt text.

Uses keyword regex matching as a fast path (<5ms).
Falls back to session defaults when no keywords match.
"""

import re
from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class DetectedContext:
    """Result of context detection from a prompt."""
    agent: str | None = None
    domain: str | None = None
    action: str | None = None
    confidence: float = 0.0  # 0.0-1.0


class ContextDetector:
    """Detects task context from user prompts using keyword matching."""

    # Domain keywords: map patterns to domain names (P-codes prioritized)
    DOMAIN_PATTERNS: dict[str, list[str]] = {
        # P-codes first (highest priority)
        "workers": [r"\bP01\b", r"\bworker", r"\borchestrator\b"],
        "coordination": [r"\bP02\b", r"\bredis\b", r"\bcoordination\b"],
        "knowledge_store": [r"\bP03\b", r"\belasticsearch\b", r"\bknowledge.?store\b"],
        "hitl_ui": [r"\bP05\b", r"\bfrontend\b", r"\breact\b"],  # UI removed to avoid conflict
        "guardrails": [r"\bP11\b", r"\bguardrail", r"\bhook"],
        "infrastructure": [r"\bP06\b", r"\binfra", r"\bdocker\b", r"\bk8s\b", r"\bkubernetes\b"],
    }

    # Agent keywords
    AGENT_PATTERNS: dict[str, list[str]] = {
        "backend": [r"\bbackend\b", r"\bworker", r"\binfra", r"\bstore\b"],
        "frontend": [r"\bfrontend\b", r"\bUI\b", r"\breact\b", r"\bcomponent"],
        "devops": [r"\bdevops\b", r"\bdeploy", r"\bdocker\b", r"\bhelm\b", r"\bk8s\b"],
        "reviewer": [r"\breview\b", r"\baudit\b", r"\binspect"],
        "planner": [r"\bplan\b", r"\bdesign\b(?!.*review)", r"\barchitect"],
    }

    # Action keywords (ordered by specificity - more specific patterns first)
    ACTION_PATTERNS: dict[str, list[str]] = {
        # Fix patterns (highest priority - "fix the test" should be fix, not test)
        "fix": [r"\bfix\b", r"\bbug\b", r"\bdebug\b", r"\bpatch\b"],
        # Test patterns
        "test": [r"\bunit\s+test", r"\btests?\s+for\b", r"\bwrite\s+.*\s+test", r"\btest\b", r"\btdd\b"],
        # Implementation patterns
        "implement": [r"\bimplement", r"\bcreate\b", r"\bbuild\b", r"\badd\b", r"\bwrite\b"],
        # Other actions
        "review": [r"\breview\b", r"\binspect\b", r"\baudit\b"],
        "refactor": [r"\brefactor", r"\bclean.?up\b", r"\brestructure"],
        "design": [r"\bdesign\b", r"\barchitect", r"\bplan\b"],
    }

    def __init__(self, default_agent: str | None = None):
        """
        Args:
            default_agent: Default agent from CLAUDE_INSTANCE_ID session context.
        """
        self._default_agent = default_agent

    def detect(self, prompt: str) -> DetectedContext:
        """Detect context from a user prompt.

        Uses keyword regex matching. Returns DetectedContext with any
        matched fields and confidence score.
        """
        prompt_lower = prompt.lower()

        agent = self._match_patterns(prompt_lower, self.AGENT_PATTERNS)
        domain = self._match_patterns(prompt_lower, self.DOMAIN_PATTERNS)
        action = self._match_patterns(prompt_lower, self.ACTION_PATTERNS)

        # Count matched fields for confidence
        matches = sum(1 for x in [agent, domain, action] if x is not None)
        confidence = matches / 3.0

        # Fall back to session defaults
        if agent is None:
            agent = self._default_agent

        return DetectedContext(
            agent=agent,
            domain=domain,
            action=action,
            confidence=confidence,
        )

    def _match_patterns(self, text: str, patterns: dict[str, list[str]]) -> str | None:
        """Match text against pattern groups. Returns first matching key.

        Patterns are checked in order, so more specific patterns should come first.
        """
        for key, regexes in patterns.items():
            for pattern in regexes:
                if re.search(pattern, text, re.IGNORECASE):
                    return key
        return None
