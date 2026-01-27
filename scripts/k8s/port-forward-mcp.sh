#!/bin/bash
# port-forward-mcp.sh - Port-forward MCP services from K8s to localhost
#
# Usage: ./scripts/k8s/port-forward-mcp.sh [service]
#
# Services:
#   all           Forward all MCP services (default)
#   elasticsearch Forward Elasticsearch for Knowledge Store MCP (9200)
#   redis         Forward Redis MCP sidecar (9000)
#   hitl          Forward HITL UI (3000)
#
# Examples:
#   ./scripts/k8s/port-forward-mcp.sh              # Forward all
#   ./scripts/k8s/port-forward-mcp.sh elasticsearch # Just ES for ks_search

set -euo pipefail

NAMESPACE="dox-asdlc"
SERVICE="${1:-all}"

echo "Starting port-forwards for MCP services..."

case "$SERVICE" in
    elasticsearch|es)
        echo "Forwarding Elasticsearch (9200) for Knowledge Store MCP..."
        kubectl port-forward svc/knowledge-store 9200:9200 -n "$NAMESPACE"
        ;;
    redis)
        echo "Forwarding Redis MCP sidecar (9000)..."
        kubectl port-forward svc/dox-asdlc-redis 9000:9000 -n "$NAMESPACE"
        ;;
    hitl|ui)
        echo "Forwarding HITL UI (3000)..."
        kubectl port-forward svc/dox-asdlc-hitl-ui 3000:3000 -n "$NAMESPACE"
        ;;
    all)
        echo "Forwarding all MCP services in background..."
        echo ""
        kubectl port-forward svc/knowledge-store 9200:9200 -n "$NAMESPACE" &
        echo "  - Elasticsearch: localhost:9200 (for ks_search, ks_health)"
        kubectl port-forward svc/dox-asdlc-redis 9000:9000 -n "$NAMESPACE" &
        echo "  - Redis MCP:     localhost:9000 (for redis_get, redis_set)"
        kubectl port-forward svc/dox-asdlc-hitl-ui 3000:3000 -n "$NAMESPACE" &
        echo "  - HITL UI:       localhost:3000"
        echo ""
        echo "All port-forwards running in background. Use 'pkill -f port-forward' to stop."
        wait
        ;;
    *)
        echo "Unknown service: $SERVICE"
        echo "Valid options: all, elasticsearch, redis, hitl"
        exit 1
        ;;
esac
