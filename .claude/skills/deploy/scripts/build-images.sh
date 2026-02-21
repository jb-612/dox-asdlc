#!/bin/bash
set -euo pipefail

# build-images.sh - Build Docker images for dox-asdlc services
#
# Usage: ./scripts/build-images.sh [options] [services...]
#
# Services (default: all):
#   orchestrator    Build orchestrator image
#   workers         Build workers image
#   hitl-ui         Build HITL UI image
#
# Options:
#   --tag <tag>       Image tag (default: latest)
#   --registry <reg>  Registry prefix (default: dox-asdlc)
#   --push            Push images to registry after building
#   --minikube        Load images into minikube (for local k8s dev)
#   --no-cache        Build without Docker cache
#   --mcp             Build MCP sidecar images (mcp-redis, mcp-elasticsearch)
#   --help            Show this help message

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"

# Configuration
REGISTRY="dox-asdlc"
TAG="latest"
PUSH=false
MINIKUBE=false
NO_CACHE=false
BUILD_MCP=false

# Services to build
SERVICES=""

# Available services (space-separated)
AVAILABLE_SERVICES="orchestrator workers hitl-ui"

# MCP services (space-separated)
MCP_SERVICES="mcp-redis mcp-elasticsearch"

# Get Dockerfile path for a service
get_dockerfile() {
    local service=$1
    case "$service" in
        orchestrator) echo "docker/orchestrator/Dockerfile" ;;
        workers) echo "docker/workers/Dockerfile" ;;
        hitl-ui) echo "docker/hitl-ui/Dockerfile" ;;
        mcp-redis) echo "docker/mcp-redis/Dockerfile" ;;
        mcp-elasticsearch) echo "docker/mcp-elasticsearch/Dockerfile" ;;
        *) echo "" ;;
    esac
}

# Check if service is valid
is_valid_service() {
    local service=$1
    for s in $AVAILABLE_SERVICES; do
        if [ "$s" = "$service" ]; then
            return 0
        fi
    done
    return 1
}

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"
}

error() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $*" >&2
}

show_help() {
    head -20 "$0" | grep -E "^#" | sed 's/^# //' | sed 's/^#//'
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --tag|-t)
            TAG="$2"
            shift 2
            ;;
        --registry|-r)
            REGISTRY="$2"
            shift 2
            ;;
        --push)
            PUSH=true
            shift
            ;;
        --minikube)
            MINIKUBE=true
            shift
            ;;
        --no-cache)
            NO_CACHE=true
            shift
            ;;
        --mcp)
            BUILD_MCP=true
            shift
            ;;
        --help|-h)
            show_help
            exit 0
            ;;
        -*)
            error "Unknown option: $1"
            show_help
            exit 1
            ;;
        *)
            # Service name
            if is_valid_service "$1"; then
                SERVICES="$SERVICES $1"
            else
                error "Unknown service: $1"
                echo "Available services: $AVAILABLE_SERVICES"
                exit 1
            fi
            shift
            ;;
    esac
done

# Trim leading space from SERVICES
SERVICES="${SERVICES# }"

# Default to all services if none specified AND --mcp not used alone
if [ -z "$SERVICES" ] && [ "$BUILD_MCP" = false ]; then
    SERVICES="$AVAILABLE_SERVICES"
fi

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."

    if ! command -v docker &> /dev/null; then
        error "docker is not installed. Please install Docker first."
        exit 1
    fi

    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        error "Docker daemon is not running. Please start Docker."
        exit 1
    fi

    # Check if minikube is available when --minikube is used
    if [ "$MINIKUBE" = true ]; then
        if ! command -v minikube &> /dev/null; then
            error "minikube is not installed but --minikube was specified."
            exit 1
        fi
        if ! minikube status &> /dev/null; then
            error "minikube is not running. Start it with: minikube start"
            exit 1
        fi
    fi

    log "Prerequisites met."
}

# Build a single image
build_image() {
    local service=$1
    local dockerfile
    dockerfile=$(get_dockerfile "$service")
    local image_name="${REGISTRY}/${service}:${TAG}"

    log "Building $image_name..."

    local build_cmd="docker build -f $PROJECT_ROOT/$dockerfile -t $image_name"

    if [ "$NO_CACHE" = true ]; then
        build_cmd="$build_cmd --no-cache"
    fi

    # Add build context (project root)
    build_cmd="$build_cmd $PROJECT_ROOT"

    if ! eval "$build_cmd"; then
        error "Failed to build $image_name"
        return 1
    fi

    log "Successfully built $image_name"

    # Also tag as latest if using a different tag
    if [ "$TAG" != "latest" ]; then
        docker tag "$image_name" "${REGISTRY}/${service}:latest"
        log "Also tagged as ${REGISTRY}/${service}:latest"
    fi
}

# Build a single MCP image
build_mcp_image() {
    local service=$1
    local dockerfile
    dockerfile=$(get_dockerfile "$service")
    local context_dir="$PROJECT_ROOT/docker/${service}"
    local image_name="${REGISTRY}/${service}:${TAG}"

    log "Building MCP image $image_name..."

    local build_cmd="docker build -f $PROJECT_ROOT/$dockerfile -t $image_name"

    if [ "$NO_CACHE" = true ]; then
        build_cmd="$build_cmd --no-cache"
    fi

    # Add build context (the specific docker directory for MCP images)
    build_cmd="$build_cmd $context_dir"

    if ! eval "$build_cmd"; then
        error "Failed to build $image_name"
        return 1
    fi

    log "Successfully built $image_name"

    # Also tag as latest if using a different tag
    if [ "$TAG" != "latest" ]; then
        docker tag "$image_name" "${REGISTRY}/${service}:latest"
        log "Also tagged as ${REGISTRY}/${service}:latest"
    fi
}

# Push image to registry
push_image() {
    local service=$1
    local image_name="${REGISTRY}/${service}:${TAG}"

    log "Pushing $image_name..."

    if ! docker push "$image_name"; then
        error "Failed to push $image_name"
        return 1
    fi

    log "Successfully pushed $image_name"
}

# Load image into minikube
load_into_minikube() {
    local service=$1
    local image_name="${REGISTRY}/${service}:${TAG}"

    log "Loading $image_name into minikube..."

    if ! minikube image load "$image_name"; then
        error "Failed to load $image_name into minikube"
        return 1
    fi

    log "Successfully loaded $image_name into minikube"
}

# Build all requested services
build_all() {
    local failed=0

    for service in $SERVICES; do
        if ! build_image "$service"; then
            failed=$((failed + 1))
        fi
    done

    return $failed
}

# Build all MCP images
build_all_mcp() {
    local failed=0

    for service in $MCP_SERVICES; do
        if ! build_mcp_image "$service"; then
            failed=$((failed + 1))
        fi
    done

    return $failed
}

# Push all images
push_all() {
    local failed=0

    for service in $SERVICES; do
        if ! push_image "$service"; then
            failed=$((failed + 1))
        fi
    done

    return $failed
}

# Push all MCP images
push_all_mcp() {
    local failed=0

    for service in $MCP_SERVICES; do
        if ! push_image "$service"; then
            failed=$((failed + 1))
        fi
    done

    return $failed
}

# Load all images into minikube
load_all_minikube() {
    local failed=0

    for service in $SERVICES; do
        if ! load_into_minikube "$service"; then
            failed=$((failed + 1))
        fi
    done

    return $failed
}

# Load all MCP images into minikube
load_all_mcp_minikube() {
    local failed=0

    for service in $MCP_SERVICES; do
        if ! load_into_minikube "$service"; then
            failed=$((failed + 1))
        fi
    done

    return $failed
}

# Print summary
print_summary() {
    echo ""
    echo "=========================================="
    echo "  Image Build Summary"
    echo "=========================================="
    echo ""
    echo "Registry:  $REGISTRY"
    echo "Tag:       $TAG"

    if [ -n "$SERVICES" ]; then
        echo "Services:  $SERVICES"
        echo ""
        echo "Images built:"
        for service in $SERVICES; do
            echo "  - ${REGISTRY}/${service}:${TAG}"
        done
    fi

    if [ "$BUILD_MCP" = true ]; then
        echo ""
        echo "MCP sidecar images built:"
        for service in $MCP_SERVICES; do
            echo "  - ${REGISTRY}/${service}:${TAG}"
        done
    fi
    echo ""

    if [ "$MINIKUBE" = true ]; then
        echo "Images loaded into minikube."
        echo ""
    fi

    if [ "$PUSH" = true ]; then
        echo "Images pushed to registry."
        echo ""
    fi

    echo "Next steps:"
    if [ "$MINIKUBE" = true ]; then
        echo "  Deploy to minikube:  ./scripts/k8s/deploy.sh"
    else
        echo "  Load into minikube:  ./scripts/build-images.sh --minikube"
        echo "  Push to registry:    ./scripts/build-images.sh --push --registry <your-registry>"
    fi
    echo ""
}

# Main execution
main() {
    log "Starting image build process..."
    if [ -n "$SERVICES" ]; then
        log "Services: $SERVICES"
    fi
    if [ "$BUILD_MCP" = true ]; then
        log "MCP images: $MCP_SERVICES"
    fi
    log "Tag: $TAG"

    check_prerequisites

    # Build regular services (unless only --mcp was specified)
    if [ -n "$SERVICES" ]; then
        if ! build_all; then
            error "Some images failed to build."
            exit 1
        fi
    fi

    # Build MCP images if --mcp flag was passed
    if [ "$BUILD_MCP" = true ]; then
        log "Building MCP sidecar images..."
        if ! build_all_mcp; then
            error "Some MCP images failed to build."
            exit 1
        fi
    fi

    if [ "$PUSH" = true ]; then
        if [ -n "$SERVICES" ]; then
            if ! push_all; then
                error "Some images failed to push."
                exit 1
            fi
        fi
        if [ "$BUILD_MCP" = true ]; then
            if ! push_all_mcp; then
                error "Some MCP images failed to push."
                exit 1
            fi
        fi
    fi

    if [ "$MINIKUBE" = true ]; then
        if [ -n "$SERVICES" ]; then
            if ! load_all_minikube; then
                error "Some images failed to load into minikube."
                exit 1
            fi
        fi
        if [ "$BUILD_MCP" = true ]; then
            if ! load_all_mcp_minikube; then
                error "Some MCP images failed to load into minikube."
                exit 1
            fi
        fi
    fi

    print_summary

    log "Build process complete."
}

main "$@"
