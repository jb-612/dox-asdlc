#!/bin/bash
set -euo pipefail

# add-plane-repo.sh - Add Plane Helm repository
#
# Usage: ./scripts/k8s/add-plane-repo.sh
#
# This script adds the official Plane Helm repository and updates the cache.
# It is idempotent and can be run multiple times.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Configuration
REPO_NAME="makeplane"
REPO_URL="https://helm.plane.so/"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"
}

error() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $*" >&2
}

# Check prerequisites
check_prerequisites() {
    if ! command -v helm &> /dev/null; then
        error "helm is not installed. Please install helm first."
        exit 1
    fi
}

# Check if repo already exists
repo_exists() {
    helm repo list 2>/dev/null | grep -q "^$REPO_NAME"
}

# Add Helm repository
add_repo() {
    if repo_exists; then
        log "Repository '$REPO_NAME' already exists. Updating..."
    else
        log "Adding Helm repository '$REPO_NAME' from $REPO_URL..."
        if ! helm repo add "$REPO_NAME" "$REPO_URL"; then
            error "Failed to add repository."
            exit 1
        fi
        log "Repository added."
    fi
}

# Update repository cache
update_repo() {
    log "Updating Helm repository cache..."
    if ! helm repo update "$REPO_NAME"; then
        error "Failed to update repository."
        exit 1
    fi
    log "Repository updated."
}

# Verify chart availability
verify_chart() {
    log "Verifying Plane CE chart availability..."

    if helm search repo "$REPO_NAME/plane-ce" --versions | grep -q "plane-ce"; then
        log "Plane CE chart is available."
        echo ""
        log "Available versions:"
        helm search repo "$REPO_NAME/plane-ce" --versions | head -5
    else
        error "Plane CE chart not found in repository."
        exit 1
    fi
}

# Print summary
print_summary() {
    echo ""
    echo "=========================================="
    echo "  Plane Helm Repository Ready"
    echo "=========================================="
    echo ""
    echo "Repository: $REPO_NAME"
    echo "URL:        $REPO_URL"
    echo ""
    echo "To install Plane CE:"
    echo "  ./scripts/k8s/deploy-plane.sh"
    echo ""
    echo "Or manually:"
    echo "  helm install plane-app $REPO_NAME/plane-ce -n plane-ce --create-namespace"
    echo ""
}

# Main execution
main() {
    log "Setting up Plane Helm repository..."

    check_prerequisites
    add_repo
    update_repo
    verify_chart
    print_summary

    log "Setup complete."
}

main "$@"
