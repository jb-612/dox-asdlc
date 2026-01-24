#!/bin/bash
set -euo pipefail

# deploy-plane.sh - Deploy Plane CE to Kubernetes
#
# Usage: ./scripts/k8s/deploy-plane.sh [options]
#
# Options:
#   --values <file>   Additional values file (can be repeated)
#   --set <key=val>   Set a value (can be repeated)
#   --dry-run         Render templates without installing
#   --debug           Enable Helm debug output
#   --wait            Wait for all pods to be ready
#   --timeout <dur>   Timeout for --wait (default: 10m)
#   --help            Show this help message

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Configuration
RELEASE_NAME="plane-app"
CHART_NAME="makeplane/plane-ce"
NAMESPACE="plane-ce"

# Default values file
DEFAULT_VALUES_FILE="$PROJECT_ROOT/helm/plane-ce/values-minikube.yaml"

# Helm options
HELM_OPTS=()
VALUES_FILES=()
SET_VALUES=()
DRY_RUN=false
DEBUG=false
WAIT=false
TIMEOUT="10m"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --values|-f)
            VALUES_FILES+=("$2")
            shift 2
            ;;
        --set)
            SET_VALUES+=("$2")
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --debug)
            DEBUG=true
            shift
            ;;
        --wait)
            WAIT=true
            shift
            ;;
        --timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        --help|-h)
            head -20 "$0" | grep -E "^#" | sed 's/^# //' | sed 's/^#//'
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"
}

error() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $*" >&2
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."

    if ! command -v helm &> /dev/null; then
        error "helm is not installed. Please install helm first."
        exit 1
    fi

    if ! command -v kubectl &> /dev/null; then
        error "kubectl is not installed. Please install kubectl first."
        exit 1
    fi

    # Check if kubectl can connect to a cluster
    if ! kubectl cluster-info &> /dev/null; then
        error "Cannot connect to Kubernetes cluster."
        echo "  Ensure your cluster is running: ./scripts/k8s/start-minikube.sh"
        exit 1
    fi

    # Check if Plane repo is added
    if ! helm repo list 2>/dev/null | grep -q "^makeplane"; then
        log "Plane Helm repository not found. Adding it now..."
        "$SCRIPT_DIR/add-plane-repo.sh"
    fi

    log "Prerequisites met."
}

# Add default values file
setup_values() {
    log "Setting up values files..."

    if [ -f "$DEFAULT_VALUES_FILE" ]; then
        VALUES_FILES=("$DEFAULT_VALUES_FILE" "${VALUES_FILES[@]}")
        log "  Using values file: $DEFAULT_VALUES_FILE"
    else
        log "  WARNING: Default values file not found: $DEFAULT_VALUES_FILE"
        log "  Using chart defaults."
    fi
}

# Build Helm command
build_helm_command() {
    HELM_OPTS=(
        upgrade
        --install
        "$RELEASE_NAME"
        "$CHART_NAME"
        --namespace "$NAMESPACE"
        --create-namespace
    )

    # Add values files
    for vf in "${VALUES_FILES[@]}"; do
        HELM_OPTS+=(-f "$vf")
    done

    # Add set values
    for sv in "${SET_VALUES[@]}"; do
        HELM_OPTS+=(--set "$sv")
    done

    # Add optional flags
    if [ "$DRY_RUN" = true ]; then
        HELM_OPTS+=(--dry-run)
    fi

    if [ "$DEBUG" = true ]; then
        HELM_OPTS+=(--debug)
    fi

    if [ "$WAIT" = true ]; then
        HELM_OPTS+=(--wait --timeout "$TIMEOUT")
    fi
}

# Deploy the chart
deploy_chart() {
    log "Deploying Plane CE..."

    if [ "$DRY_RUN" = true ]; then
        log "  Running in dry-run mode (templates will be rendered but not applied)."
    fi

    log "  Running: helm ${HELM_OPTS[*]}"

    if ! helm "${HELM_OPTS[@]}"; then
        error "Helm deployment failed."
        exit 1
    fi

    if [ "$DRY_RUN" = false ]; then
        log "Deployment initiated."
    else
        log "Dry-run complete."
    fi
}

# Wait for pods to be ready
wait_for_pods() {
    if [ "$DRY_RUN" = true ] || [ "$WAIT" = true ]; then
        return 0
    fi

    log "Waiting for pods to be ready (this may take a few minutes)..."

    local max_attempts=60
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        local ready_pods
        ready_pods=$(kubectl get pods -n "$NAMESPACE" --no-headers 2>/dev/null | grep -c "Running" || echo "0")
        local total_pods
        total_pods=$(kubectl get pods -n "$NAMESPACE" --no-headers 2>/dev/null | wc -l | tr -d ' ')

        if [ "$total_pods" -gt 0 ]; then
            log "  Pods ready: $ready_pods/$total_pods"

            # Check if all pods are running
            local not_ready
            not_ready=$(kubectl get pods -n "$NAMESPACE" --no-headers 2>/dev/null | grep -cv "Running" || echo "0")

            if [ "$not_ready" -eq 0 ] && [ "$ready_pods" -gt 0 ]; then
                log "All pods are running."
                return 0
            fi
        fi

        sleep 5
        attempt=$((attempt + 1))
    done

    log "WARNING: Not all pods are ready after waiting. Check status manually."
}

# Get access URL
get_access_url() {
    if [ "$DRY_RUN" = true ]; then
        return 0
    fi

    log "Getting access URL..."

    # Check if we're on minikube
    local context
    context=$(kubectl config current-context 2>/dev/null || echo "")

    if [[ "$context" == *"minikube"* ]] || [[ "$context" == "dox-asdlc" ]]; then
        # Use minikube service command
        echo ""
        log "To access Plane CE on minikube, run:"
        echo "  minikube service ${RELEASE_NAME}-web -n $NAMESPACE --url"
        echo ""
        log "Or open in browser:"
        echo "  minikube service ${RELEASE_NAME}-web -n $NAMESPACE"
    else
        # Try to get NodePort
        local node_port
        node_port=$(kubectl get svc "${RELEASE_NAME}-web" -n "$NAMESPACE" -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || echo "")

        if [ -n "$node_port" ]; then
            log "Access Plane CE at: http://<node-ip>:$node_port"
        fi
    fi
}

# Verify deployment
verify_deployment() {
    if [ "$DRY_RUN" = true ]; then
        return 0
    fi

    log "Verifying deployment..."

    # Show release status
    helm status "$RELEASE_NAME" -n "$NAMESPACE" 2>/dev/null || true

    # Show pods
    echo ""
    log "Pods in namespace '$NAMESPACE':"
    kubectl get pods -n "$NAMESPACE" 2>/dev/null || log "  No pods yet."

    # Show services
    echo ""
    log "Services:"
    kubectl get svc -n "$NAMESPACE" 2>/dev/null || log "  No services yet."
}

# Print summary
print_summary() {
    if [ "$DRY_RUN" = true ]; then
        return 0
    fi

    echo ""
    echo "=========================================="
    echo "  Plane CE Deployment Complete"
    echo "=========================================="
    echo ""
    echo "Release:     $RELEASE_NAME"
    echo "Namespace:   $NAMESPACE"
    echo "Chart:       $CHART_NAME"
    echo ""
    echo "Commands:"
    echo "  Check status:     helm status $RELEASE_NAME -n $NAMESPACE"
    echo "  List pods:        kubectl get pods -n $NAMESPACE"
    echo "  View logs:        kubectl logs -n $NAMESPACE <pod-name>"
    echo "  Access UI:        minikube service ${RELEASE_NAME}-web -n $NAMESPACE"
    echo "  Uninstall:        ./scripts/k8s/teardown-plane.sh"
    echo ""
    echo "First-time setup:"
    echo "  1. Open the web UI"
    echo "  2. Create an admin account"
    echo "  3. Set up your workspace"
    echo "  4. Create your first project"
    echo ""
}

# Main execution
main() {
    log "Starting Plane CE deployment..."

    check_prerequisites
    setup_values
    build_helm_command
    deploy_chart
    wait_for_pods
    verify_deployment
    get_access_url
    print_summary

    log "Deployment process complete."
}

main "$@"
