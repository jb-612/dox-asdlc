"""Prompts for Deployment agents.

Provides prompts for release manifest generation, deployment plan creation,
and monitoring configuration.
"""

from src.workers.agents.deployment.prompts.deployment_prompts import (
    BLUE_GREEN_STRATEGY_GUIDANCE,
    CANARY_STRATEGY_GUIDANCE,
    DEPLOYMENT_PLAN_PROMPT,
    ROLLING_STRATEGY_GUIDANCE,
    format_deployment_plan_prompt,
)
from src.workers.agents.deployment.prompts.monitor_prompts import (
    ALERT_RULES_PROMPT,
    DASHBOARD_CONFIG_PROMPT,
    MONITORING_CONFIG_PROMPT,
    format_monitoring_config_prompt,
)
from src.workers.agents.deployment.prompts.release_prompts import (
    CHANGELOG_PROMPT,
    RELEASE_MANIFEST_PROMPT,
    format_changelog_prompt,
    format_release_manifest_prompt,
)

__all__ = [
    # Release prompts
    "RELEASE_MANIFEST_PROMPT",
    "CHANGELOG_PROMPT",
    "format_release_manifest_prompt",
    "format_changelog_prompt",
    # Deployment prompts
    "DEPLOYMENT_PLAN_PROMPT",
    "ROLLING_STRATEGY_GUIDANCE",
    "BLUE_GREEN_STRATEGY_GUIDANCE",
    "CANARY_STRATEGY_GUIDANCE",
    "format_deployment_plan_prompt",
    # Monitor prompts
    "MONITORING_CONFIG_PROMPT",
    "ALERT_RULES_PROMPT",
    "DASHBOARD_CONFIG_PROMPT",
    "format_monitoring_config_prompt",
]
