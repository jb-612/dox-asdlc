#!/bin/bash
set -euo pipefail

# deploy.sh - Deploy dox-asdlc to Kubernetes via Helm
#
# Usage: ./scripts/k8s/deploy.sh [options]
#
# Options:
#   --values <file>   Additional values file (can be repeated)
#   --set <key=val>   Set a value (can be repeated)
#   --dry-run         Render templates without installing
#   --debug           Enable Helm debug output
#   --wait            Wait for all pods to be ready
#   --timeout <dur>   Timeout for --wait (default: 5m)
#   --with-plane      Also deploy Plane CE for project management
#   --help            Show this help message

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"

# Configuration
RELEASE_NAME="dox-asdlc"
CHART_PATH="$PROJECT_ROOT/helm/dox-asdlc"
NAMESPACE="dox-asdlc"

# Default values file based on environment
DEFAULT_VALUES_FILE="$CHART_PATH/values-minikube.yaml"

# Helm options
HELM_OPTS=()
VALUES_FILES=()
SET_VALUES=()
DRY_RUN=false
DEBUG=false
WAIT=false
TIMEOUT="5m"
WITH_PLANE=false

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
        --with-plane)
            WITH_PLANE=true
            shift
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

    # Check if chart exists
    if [ ! -f "$CHART_PATH/Chart.yaml" ]; then
        error "Helm chart not found at: $CHART_PATH"
        exit 1
    fi

    # Check if custom images exist (warn if missing)
    check_custom_images

    log "Prerequisites met."
}

# Check if custom Docker images are available
check_custom_images() {
    local missing_images=()
    local images=("dox-asdlc/orchestrator" "dox-asdlc/workers" "dox-asdlc/hitl-ui")

    for img in "${images[@]}"; do
        if ! docker image inspect "$img:latest" &> /dev/null; then
            missing_images+=("$img")
        fi
    done

    if [ ${#missing_images[@]} -gt 0 ]; then
        echo ""
        log "WARNING: Custom images not found locally:"
        for img in "${missing_images[@]}"; do
            echo "    - $img:latest"
        done
        echo ""
        echo "  Build images first: ./scripts/build-images.sh --minikube"
        echo ""
        echo "  Continuing deployment (images may be pulled from registry if available)..."
        echo ""
    fi
}

# Detect environment and select values file
detect_environment() {
    log "Detecting environment..."

    # Check if running in minikube context
    local context
    context=$(kubectl config current-context 2>/dev/null || echo "")

    if [[ "$context" == *"minikube"* ]] || [[ "$context" == "dox-asdlc" ]]; then
        log "  Detected minikube environment."
        if [ -f "$DEFAULT_VALUES_FILE" ]; then
            VALUES_FILES=("$DEFAULT_VALUES_FILE" "${VALUES_FILES[@]}")
            log "  Using values file: $DEFAULT_VALUES_FILE"
        fi
    else
        log "  Non-minikube environment detected."
        log "  Using default values.yaml only."
    fi
}

# Lint the chart
lint_chart() {
    log "Linting Helm chart..."

    local lint_cmd=(helm lint "$CHART_PATH")

    for vf in "${VALUES_FILES[@]}"; do
        lint_cmd+=(-f "$vf")
    done

    if ! "${lint_cmd[@]}"; then
        error "Helm lint failed. Please fix the issues before deploying."
        exit 1
    fi

    log "Helm lint passed."
}

# Build Helm command
build_helm_command() {
    HELM_OPTS=(
        upgrade
        --install
        "$RELEASE_NAME"
        "$CHART_PATH"
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
    log "Deploying dox-asdlc..."

    if [ "$DRY_RUN" = true ]; then
        log "  Running in dry-run mode (templates will be rendered but not applied)."
    fi

    log "  Running: helm ${HELM_OPTS[*]}"

    if ! helm "${HELM_OPTS[@]}"; then
        error "Helm deployment failed."
        exit 1
    fi

    if [ "$DRY_RUN" = false ]; then
        log "Deployment successful."
    else
        log "Dry-run complete."
    fi
}

# Verify deployment
verify_deployment() {
    if [ "$DRY_RUN" = true ]; then
        return 0
    fi

    log "Verifying deployment..."

    # Show release status
    helm status "$RELEASE_NAME" -n "$NAMESPACE"

    # Show resources
    echo ""
    log "Resources in namespace $NAMESPACE:"
    kubectl get all -n "$NAMESPACE" 2>/dev/null || log "  No resources yet (subcharts not enabled)."

    # Show secrets (names only)
    echo ""
    log "Secrets:"
    kubectl get secrets -n "$NAMESPACE" 2>/dev/null || log "  No secrets yet."
}

# Print summary
print_summary() {
    if [ "$DRY_RUN" = true ]; then
        return 0
    fi

    echo ""
    echo "=========================================="
    echo "  dox-asdlc Deployment Complete"
    echo "=========================================="
    echo ""
    echo "Release:     $RELEASE_NAME"
    echo "Namespace:   $NAMESPACE"
    echo "Chart:       $CHART_PATH"
    echo ""
    echo "Commands:"
    echo "  Check status:     helm status $RELEASE_NAME -n $NAMESPACE"
    echo "  List pods:        kubectl get pods -n $NAMESPACE"
    echo "  View logs:        kubectl logs -n $NAMESPACE <pod-name>"
    echo "  Upgrade:          ./scripts/k8s/deploy.sh"
    echo "  Uninstall:        ./scripts/k8s/teardown.sh"
    echo ""
}

# Deploy Plane CE (if requested)
deploy_plane() {
    if [ "$WITH_PLANE" = false ]; then
        return 0
    fi

    log "Deploying Plane CE..."
    echo ""

    local plane_opts=()

    if [ "$DRY_RUN" = true ]; then
        plane_opts+=(--dry-run)
    fi

    if [ "$DEBUG" = true ]; then
        plane_opts+=(--debug)
    fi

    if [ "$WAIT" = true ]; then
        plane_opts+=(--wait --timeout "$TIMEOUT")
    fi

    if ! "$PROJECT_ROOT/scripts/k8s/deploy-plane.sh" "${plane_opts[@]}"; then
        error "Plane CE deployment failed."
        exit 1
    fi
}

# Main execution
main() {
    log "Starting dox-asdlc deployment..."

    check_prerequisites
    detect_environment
    lint_chart
    build_helm_command
    deploy_chart
    verify_deployment
    print_summary
    deploy_plane

    log "Deployment process complete."
}

main "$@"
