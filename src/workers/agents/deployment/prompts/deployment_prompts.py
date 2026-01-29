"""Prompts for Deployment agent.

Provides prompts for deployment plan creation with strategy-specific guidance
for rolling, blue-green, and canary deployments.
"""

from __future__ import annotations

from typing import Any


DEPLOYMENT_PLAN_PROMPT = """You are an expert DevOps engineer creating deployment plans.

Your task is to create a comprehensive deployment plan that includes ordered steps,
health checks, and rollback triggers to safely deploy a release to production.

## Deployment Plan Requirements

1. **Step Ordering**: Clear sequence of deployment steps
2. **Health Checks**: Verification at each stage
3. **Rollback Triggers**: Conditions that trigger automatic rollback
4. **Timeout Configuration**: Appropriate timeouts for each step

## Deployment Step Types

- **prepare**: Pre-deployment checks and setup
- **deploy**: Actual deployment of new version
- **verify**: Health and functionality verification
- **promote**: Gradual traffic shift or promotion
- **cleanup**: Post-deployment cleanup tasks

## Health Check Types

- **http**: HTTP endpoint health check
- **tcp**: TCP port connectivity check
- **command**: Custom command execution
- **grpc**: gRPC health check protocol

## Rollback Triggers

Define conditions that should trigger automatic rollback:
- Error rate exceeds threshold (e.g., >5% 5xx errors)
- Latency exceeds threshold (e.g., p99 > 500ms)
- Health check failures exceed count
- Custom metric violations

## Output Format

Provide your deployment plan as structured JSON:

```json
{
  "release_version": "1.2.0",
  "target_environment": "production",
  "strategy": "rolling",
  "estimated_duration": "15 minutes",
  "steps": [
    {
      "order": 1,
      "name": "Pre-deployment validation",
      "step_type": "prepare",
      "command": "kubectl get pods -n app",
      "timeout_seconds": 60,
      "rollback_command": null
    },
    {
      "order": 2,
      "name": "Deploy new version",
      "step_type": "deploy",
      "command": "kubectl set image deployment/app app=registry/app:1.2.0",
      "timeout_seconds": 300,
      "rollback_command": "kubectl rollout undo deployment/app"
    },
    {
      "order": 3,
      "name": "Verify deployment health",
      "step_type": "verify",
      "command": "kubectl rollout status deployment/app",
      "timeout_seconds": 300,
      "rollback_command": null
    }
  ],
  "rollback_triggers": [
    "Error rate > 5% for 2 minutes",
    "P99 latency > 500ms for 5 minutes",
    "Health check failures > 3 consecutive"
  ],
  "health_checks": [
    {
      "name": "API health endpoint",
      "check_type": "http",
      "target": "/health",
      "interval_seconds": 10,
      "timeout_seconds": 5,
      "success_threshold": 1,
      "failure_threshold": 3
    }
  ],
  "pre_deploy_checklist": [
    "Database migrations applied",
    "Feature flags configured",
    "Monitoring dashboards ready"
  ],
  "post_deploy_actions": [
    "Verify metrics in dashboard",
    "Run smoke tests",
    "Update status page"
  ]
}
```
"""


ROLLING_STRATEGY_GUIDANCE = """## Rolling Update Strategy

Rolling deployments gradually replace instances of the previous version with the new version.

### Key Characteristics
- Zero-downtime deployment
- Gradual instance replacement
- Built-in Kubernetes support
- Easy rollback via kubectl rollout undo

### Configuration Parameters
- **maxUnavailable**: Maximum pods unavailable during update (e.g., 25%)
- **maxSurge**: Maximum pods over desired count during update (e.g., 25%)
- **minReadySeconds**: Wait time before considering pod ready

### Best Practices
1. Set appropriate readiness probes
2. Configure sensible maxUnavailable/maxSurge values
3. Use minReadySeconds to catch startup failures
4. Monitor error rates during rollout
5. Keep deployment history for rollback

### Rollback Procedure
1. Detect failure via health checks or metrics
2. Execute: kubectl rollout undo deployment/<name>
3. Verify previous version is healthy
4. Investigate root cause before retry
"""


BLUE_GREEN_STRATEGY_GUIDANCE = """## Blue-Green Deployment Strategy

Blue-green deployments maintain two identical production environments, switching traffic between them.

### Key Characteristics
- Instant rollback capability
- Full production testing before switch
- Zero-downtime switching
- Higher resource cost (2x infrastructure)

### Environment Naming
- **Blue**: Current production environment
- **Green**: New version environment

### Traffic Switching
Traffic is switched at the load balancer or ingress level:
1. Deploy new version to inactive environment
2. Run full verification tests
3. Switch traffic from blue to green
4. Keep blue running for quick rollback

### Best Practices
1. Maintain database compatibility between versions
2. Use feature flags for gradual feature rollout
3. Test green environment thoroughly before switch
4. Keep blue environment running for quick rollback
5. Automate environment provisioning

### Rollback Procedure
1. Detect failure via monitoring
2. Switch traffic back to blue environment
3. Verify blue is healthy
4. Investigate green environment issues
"""


CANARY_STRATEGY_GUIDANCE = """## Canary Deployment Strategy

Canary deployments gradually shift traffic to the new version while monitoring for issues.

### Key Characteristics
- Gradual traffic shift (e.g., 1% -> 10% -> 50% -> 100%)
- Real user traffic testing
- Quick rollback by stopping traffic shift
- Lower risk than full deployment

### Traffic Percentages
Typical canary progression:
1. **Initial**: 1-5% traffic to canary
2. **Expand**: 10-25% traffic if metrics healthy
3. **Majority**: 50% traffic for broader testing
4. **Full**: 100% traffic, deployment complete

### Success Criteria
Before each traffic increase, verify:
- Error rate within acceptable bounds
- Latency within SLO targets
- No critical alerts triggered
- Business metrics stable

### Best Practices
1. Start with small traffic percentage (1-5%)
2. Define clear success/failure criteria
3. Automate traffic percentage increases
4. Monitor both canary and baseline metrics
5. Set automatic rollback triggers

### Rollback Procedure
1. Detect failure via canary analysis
2. Route 100% traffic to stable version
3. Scale down canary instances
4. Investigate failure before retry
"""


def format_deployment_plan_prompt(
    release_version: str,
    target_environment: str,
    strategy: str,
    artifacts: list[dict[str, Any]] | None = None,
    current_version: str | None = None,
    health_check_interval: int | None = None,
    canary_percentage: int | None = None,
    rollback_enabled: bool = True,
) -> str:
    """Format the deployment plan prompt with release and environment information.

    Args:
        release_version: Version being deployed.
        target_environment: Target environment (staging, production, etc.).
        strategy: Deployment strategy (rolling, blue-green, canary).
        artifacts: Optional list of artifact dictionaries to deploy.
        current_version: Optional current deployed version.
        health_check_interval: Optional health check interval in seconds.
        canary_percentage: Optional initial canary percentage (for canary strategy).
        rollback_enabled: Whether automatic rollback is enabled.

    Returns:
        str: Formatted prompt for deployment plan creation.
    """
    prompt_parts = [
        DEPLOYMENT_PLAN_PROMPT,
        "",
    ]

    # Add strategy-specific guidance
    strategy_lower = strategy.lower()
    if strategy_lower == "rolling":
        prompt_parts.extend([ROLLING_STRATEGY_GUIDANCE, ""])
    elif strategy_lower == "blue-green":
        prompt_parts.extend([BLUE_GREEN_STRATEGY_GUIDANCE, ""])
    elif strategy_lower == "canary":
        prompt_parts.extend([CANARY_STRATEGY_GUIDANCE, ""])

    prompt_parts.extend([
        "## Deployment Context",
        "",
        f"**Release Version:** {release_version}",
        f"**Target Environment:** {target_environment}",
        f"**Strategy:** {strategy}",
        f"**Rollback Enabled:** {rollback_enabled}",
    ])

    if current_version:
        prompt_parts.append(f"**Current Version:** {current_version}")

    if health_check_interval:
        prompt_parts.append(f"**Health Check Interval:** {health_check_interval}s")

    if canary_percentage and strategy_lower == "canary":
        prompt_parts.append(f"**Initial Canary Percentage:** {canary_percentage}%")

    prompt_parts.append("")

    # Add artifacts
    if artifacts:
        prompt_parts.extend(["## Artifacts to Deploy", ""])
        for artifact in artifacts:
            name = artifact.get("name", "unknown")
            location = artifact.get("location", "unknown")
            prompt_parts.append(f"- **{name}**: {location}")
        prompt_parts.append("")

    prompt_parts.extend([
        "## Instructions",
        "",
        "Create a complete deployment plan following the output format above.",
        f"Use the {strategy} deployment strategy with appropriate steps.",
        "Include health checks for all deployed services.",
        "Define rollback triggers based on error rate and latency thresholds.",
        "Provide pre-deployment checklist and post-deployment actions.",
        "Return results as structured JSON.",
    ])

    return "\n".join(prompt_parts)
