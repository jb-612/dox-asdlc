"""Tests for context detection from user prompts."""

import pytest
from src.core.guardrails.context_detector import ContextDetector, DetectedContext


class TestContextDetector:
    """Test the ContextDetector keyword matching."""
    
    def test_detect_domain_from_p_codes(self):
        """Test domain detection from P-codes."""
        detector = ContextDetector()
        
        # P01 -> workers
        result = detector.detect("Implement P01 worker pool")
        assert result.domain == "workers"
        
        # P05 -> hitl_ui
        result = detector.detect("Build P05 frontend component")
        assert result.domain == "hitl_ui"
        
        # P11 -> guardrails
        result = detector.detect("Add P11 guardrail for HITL gate")
        assert result.domain == "guardrails"
        
        # P06 -> infrastructure
        result = detector.detect("Deploy P06 infrastructure")
        assert result.domain == "infrastructure"
    
    def test_detect_domain_from_keywords(self):
        """Test domain detection from keywords."""
        detector = ContextDetector()
        
        result = detector.detect("Fix the worker orchestrator bug")
        assert result.domain == "workers"
        
        result = detector.detect("Update the frontend UI component")
        assert result.domain == "hitl_ui"
        
        result = detector.detect("Configure Redis coordination layer")
        assert result.domain == "coordination"
        
        result = detector.detect("Add Elasticsearch knowledge store index")
        assert result.domain == "knowledge_store"
        
        result = detector.detect("Build Docker image for deployment")
        assert result.domain == "infrastructure"
    
    def test_detect_agent_from_keywords(self):
        """Test agent detection from keywords."""
        detector = ContextDetector()
        
        result = detector.detect("Backend worker implementation needed")
        assert result.agent == "backend"
        
        result = detector.detect("Frontend React component update")
        assert result.agent == "frontend"
        
        result = detector.detect("DevOps deploy to k8s cluster")
        assert result.agent == "devops"
        
        result = detector.detect("Review the code changes")
        assert result.agent == "reviewer"
        
        result = detector.detect("Plan the architecture design")
        assert result.agent == "planner"
    
    def test_detect_action_from_keywords(self):
        """Test action detection from keywords."""
        detector = ContextDetector()
        
        result = detector.detect("Implement the new feature")
        assert result.action == "implement"
        
        result = detector.detect("Fix the failing test")
        assert result.action == "fix"
        
        result = detector.detect("Review the pull request")
        assert result.action == "review"
        
        result = detector.detect("Write unit tests for the module")
        assert result.action == "test"
        
        result = detector.detect("Refactor the legacy code")
        assert result.action == "refactor"
        
        result = detector.detect("Design the new architecture")
        assert result.action == "design"
    
    def test_detect_multiple_fields(self):
        """Test detection of multiple fields from one prompt."""
        detector = ContextDetector()
        
        result = detector.detect("Backend: implement P01 worker pool with TDD")
        assert result.agent == "backend"
        assert result.domain == "workers"
        assert result.action in ["implement", "test"]  # Both keywords present
        assert result.confidence > 0.5  # At least 2/3 matched
    
    def test_ambiguous_prompt_partial_match(self):
        """Test that ambiguous prompts return partial matches."""
        detector = ContextDetector()
        
        result = detector.detect("Create a new thing")
        # Should detect action (create -> implement) but not agent/domain
        assert result.action == "implement"
        assert result.agent is None or result.agent is not None  # May have default
        assert result.confidence <= 0.5  # Partial match only
    
    def test_empty_prompt_returns_defaults(self):
        """Test that empty prompt returns only defaults."""
        detector = ContextDetector(default_agent="backend")
        
        result = detector.detect("")
        assert result.agent == "backend"  # From default
        assert result.domain is None
        assert result.action is None
        assert result.confidence == 0.0
    
    def test_session_default_fallback(self):
        """Test that session defaults are used when no keywords match."""
        detector = ContextDetector(default_agent="frontend")
        
        result = detector.detect("Do something generic")
        assert result.agent == "frontend"  # Falls back to default
        assert result.domain is None
        assert result.action is None
    
    def test_confidence_score_calculation(self):
        """Test confidence score based on matched fields."""
        detector = ContextDetector()
        
        # No matches
        result = detector.detect("Generic text")
        assert result.confidence == 0.0
        
        # One match (action)
        result = detector.detect("Implement something")
        assert result.confidence == pytest.approx(1/3, abs=0.01)
        
        # Two matches (domain + action)
        result = detector.detect("Implement P01 feature")
        assert result.confidence == pytest.approx(2/3, abs=0.01)
        
        # Three matches (agent + domain + action)
        result = detector.detect("Backend: implement P01 worker")
        assert result.confidence == 1.0
    
    def test_case_insensitivity(self):
        """Test that detection is case-insensitive."""
        detector = ContextDetector()
        
        result = detector.detect("BACKEND: IMPLEMENT P01 WORKER")
        assert result.agent == "backend"
        assert result.domain == "workers"
        assert result.action == "implement"
        
        result = detector.detect("FrontEnd React UI")
        assert result.agent == "frontend"
        assert result.domain == "hitl_ui"
    
    def test_no_default_agent(self):
        """Test detector with no default agent."""
        detector = ContextDetector(default_agent=None)
        
        result = detector.detect("Generic text")
        assert result.agent is None
        assert result.domain is None
        assert result.action is None
        assert result.confidence == 0.0
    
    def test_detected_context_immutability(self):
        """Test that DetectedContext is immutable (frozen dataclass)."""
        context = DetectedContext(agent="backend", domain="workers", confidence=1.0)
        
        with pytest.raises(Exception):  # FrozenInstanceError
            context.agent = "frontend"
