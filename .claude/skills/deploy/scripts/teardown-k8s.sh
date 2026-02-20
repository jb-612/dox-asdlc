#!/bin/bash
set -euo pipefail

# teardown.sh - Remove dox-asdlc deployment from Kubernetes
#
# Usage: ./scripts/k8s/teardown.sh [options]
#
# Options:
#   --delete-namespace    Also delete the namespace
#   --delete-data         Delete PersistentVolumeClaims (data loss!)
#   --force               Skip confirmation prompts
#   --help                Show this help message

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"

# Configuration
RELEASE_NAME="dox-asdlc"
NAMESPACE="dox-asdlc"

# Options
DELETE_NAMESPACE=false
DELETE_DATA=false
FORCE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --delete-namespace)
            DELETE_NAMESPACE=true
            shift
            ;;
        --delete-data)
            DELETE_DATA=true
            shift
            ;;
        --force|-f)
            FORCE=true
            shift
            ;;
        --help|-h)
            head -18 "$0" | grep -E "^#" | sed 's/^# //' | sed 's/^#//'
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

warn() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $*"
}

# Confirm action with user
confirm() {
    local message="$1"

    if [ "$FORCE" = true ]; then
        return 0
    fi

    read -p "$message [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "Operation cancelled."
        exit 0
    fi
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."

    if ! command -v helm &> /dev/null; then
        error "helm is not installed."
        exit 1
    fi

    if ! command -v kubectl &> /dev/null; then
        error "kubectl is not installed."
        exit 1
    fi

    # Check if kubectl can connect
    if ! kubectl cluster-info &> /dev/null; then
        error "Cannot connect to Kubernetes cluster."
        exit 1
    fi

    log "Prerequisites met."
}

# Check if release exists
release_exists() {
    helm list -n "$NAMESPACE" 2>/dev/null | grep -q "$RELEASE_NAME"
}

# Show what will be deleted
show_resources() {
    log "Resources to be deleted:"

    echo ""
    echo "Helm release:"
    if release_exists; then
        helm list -n "$NAMESPACE" | grep "$RELEASE_NAME" || true
    else
        echo "  Release '$RELEASE_NAME' not found."
    fi

    echo ""
    echo "Kubernetes resources in namespace '$NAMESPACE':"
    kubectl get all -n "$NAMESPACE" 2>/dev/null || echo "  No resources found."

    if [ "$DELETE_DATA" = true ]; then
        echo ""
        echo "PersistentVolumeClaims (will be DELETED):"
        kubectl get pvc -n "$NAMESPACE" 2>/dev/null || echo "  No PVCs found."
    fi

    echo ""
}

# Uninstall Helm release
uninstall_release() {
    if ! release_exists; then
        log "Release '$RELEASE_NAME' not found. Skipping uninstall."
        return 0
    fi

    log "Uninstalling Helm release '$RELEASE_NAME'..."

    if ! helm uninstall "$RELEASE_NAME" -n "$NAMESPACE"; then
        error "Failed to uninstall release."
        exit 1
    fi

    log "Release uninstalled."
}

# Delete PersistentVolumeClaims
delete_pvcs() {
    if [ "$DELETE_DATA" = false ]; then
        log "Preserving PersistentVolumeClaims (data retained)."
        return 0
    fi

    warn "Deleting PersistentVolumeClaims (DATA WILL BE LOST)..."

    local pvcs
    pvcs=$(kubectl get pvc -n "$NAMESPACE" -o name 2>/dev/null || true)

    if [ -z "$pvcs" ]; then
        log "No PVCs found."
        return 0
    fi

    for pvc in $pvcs; do
        log "  Deleting $pvc..."
        kubectl delete "$pvc" -n "$NAMESPACE" --wait=false
    done

    log "PVCs deleted."
}

# Delete namespace
delete_namespace() {
    if [ "$DELETE_NAMESPACE" = false ]; then
        log "Preserving namespace '$NAMESPACE'."
        return 0
    fi

    # Check if namespace exists
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log "Namespace '$NAMESPACE' not found. Skipping."
        return 0
    fi

    log "Deleting namespace '$NAMESPACE'..."

    if ! kubectl delete namespace "$NAMESPACE" --wait=false; then
        error "Failed to delete namespace."
        exit 1
    fi

    log "Namespace deletion initiated (may take a moment to complete)."
}

# Print summary
print_summary() {
    echo ""
    echo "=========================================="
    echo "  dox-asdlc Teardown Complete"
    echo "=========================================="
    echo ""
    echo "Actions performed:"
    echo "  - Helm release uninstalled: $RELEASE_NAME"
    if [ "$DELETE_DATA" = true ]; then
        echo "  - PersistentVolumeClaims deleted (data removed)"
    else
        echo "  - PersistentVolumeClaims preserved"
    fi
    if [ "$DELETE_NAMESPACE" = true ]; then
        echo "  - Namespace deletion initiated: $NAMESPACE"
    else
        echo "  - Namespace preserved: $NAMESPACE"
    fi
    echo ""
    echo "To redeploy:"
    echo "  ./scripts/k8s/deploy.sh"
    echo ""
}

# Main execution
main() {
    log "Starting dox-asdlc teardown..."

    check_prerequisites
    show_resources

    # Confirmation
    local confirm_msg="This will uninstall the dox-asdlc release."
    if [ "$DELETE_DATA" = true ]; then
        confirm_msg="$confirm_msg PVCs WILL BE DELETED (data loss)."
    fi
    if [ "$DELETE_NAMESPACE" = true ]; then
        confirm_msg="$confirm_msg Namespace will be deleted."
    fi
    confirm "$confirm_msg Proceed?"

    uninstall_release
    delete_pvcs
    delete_namespace
    print_summary

    log "Teardown complete."
}

main "$@"
