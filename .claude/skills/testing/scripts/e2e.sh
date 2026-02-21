#!/bin/bash
set -euo pipefail

# e2e.sh - Run end-to-end tests with Docker containers
#
# Usage: ./tools/e2e.sh
# Output: JSON with E2E test results

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
TOOLS_LIB="$PROJECT_ROOT/tools/lib"
source "$TOOLS_LIB/common.sh"

main() {
    log_info "Running E2E tests"

    # Check if docker is available
    if ! command -v docker &> /dev/null; then
        emit_error "Docker is not installed. E2E tests require Docker."
        return 1
    fi

    # Check if docker compose is available
    if ! command -v docker-compose &> /dev/null; then
        emit_error "Docker Compose is not installed. E2E tests require Docker Compose."
        return 1
    fi

    # Check if pytest is available
    if ! command -v pytest &> /dev/null; then
        emit_error "pytest is not installed. Install with: pip install pytest"
        return 1
    fi

    # Ensure test directory exists
    if [[ ! -d "$PROJECT_ROOT/tests/e2e" ]]; then
        log_warn "E2E test directory not found: $PROJECT_ROOT/tests/e2e"
        emit_result '[]'
        return 0
    fi

    # Start Docker containers
    log_info "Starting Docker containers..."
    cd "$PROJECT_ROOT"

    if ! docker-compose -f docker/docker-compose.yml up -d 2>&1; then
        emit_error "Failed to start Docker containers. Check Docker Compose configuration."
        return 1
    fi

    # Give containers time to be ready
    sleep 3

    # Run E2E tests with pytest
    local pytest_output
    local report_file
    report_file=$(mktemp)
    trap "rm -f '$report_file'" EXIT

    # Try to run pytest with json-report if available
    if pytest --version 2>&1 | grep -q pytest; then
        pytest "$PROJECT_ROOT/tests/e2e" --tb=short -v --json-report --json-report-file="$report_file" 2>&1 || true

        if [[ -f "$report_file" ]]; then
            pytest_output=$(cat "$report_file")
        else
            # Fallback: simple pytest run
            pytest_output=$(pytest "$PROJECT_ROOT/tests/e2e" --tb=short -v 2>&1 || true)
        fi
    else
        emit_error "pytest command not found"
        return 1
    fi

    # Parse pytest output using parser
    local parsed_results
    parsed_results=$("$TOOLS_LIB/parsers/pytest.sh" "$pytest_output")

    # Emit standardized result
    emit_result "$parsed_results"
}

main "$@"
