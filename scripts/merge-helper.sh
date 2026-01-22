#!/bin/bash
# Merge helper for parallel Claude CLI branches.
#
# Usage: ./scripts/merge-helper.sh <branch1> <branch2>
#
# Analyzes two branches for potential merge conflicts and provides
# recommendations for merge order and integration points.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

usage() {
    echo "Usage: $0 <branch1> <branch2>"
    echo ""
    echo "Analyzes two branches for merge compatibility and provides recommendations."
    echo ""
    echo "Options:"
    echo "  -h, --help    Show this help message"
    echo ""
    echo "Example:"
    echo "  $0 ui/P05-F01-hitl-ui agent/P03-F01-worker-pool"
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

section_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
}

# Check if branch exists
check_branch_exists() {
    local branch="$1"
    if ! git rev-parse --verify "$branch" >/dev/null 2>&1; then
        log_error "Branch '$branch' does not exist"
        return 1
    fi
    return 0
}

# Get files changed in a branch compared to main
get_changed_files() {
    local branch="$1"
    local base="${2:-main}"
    git diff --name-only "$base"..."$branch" 2>/dev/null || true
}

# Check for file conflicts between branches
check_file_conflicts() {
    local branch1="$1"
    local branch2="$2"
    local base="${3:-main}"

    local files1
    local files2
    files1=$(get_changed_files "$branch1" "$base")
    files2=$(get_changed_files "$branch2" "$base")

    # Find common files
    local common_files
    common_files=$(comm -12 <(echo "$files1" | sort) <(echo "$files2" | sort))

    echo "$common_files"
}

# Check contract versions
check_contract_compatibility() {
    local branch1="$1"
    local branch2="$2"

    section_header "Contract Compatibility Check"

    local contract_files=("contracts/current/events.json" "contracts/current/hitl_api.json" "contracts/current/knowledge_store.json")

    for contract in "${contract_files[@]}"; do
        local version1
        local version2

        # Get version from each branch
        version1=$(git show "$branch1:$contract" 2>/dev/null | python3 -c "import json,sys; print(json.load(sys.stdin).get('version','N/A'))" 2>/dev/null || echo "N/A")
        version2=$(git show "$branch2:$contract" 2>/dev/null | python3 -c "import json,sys; print(json.load(sys.stdin).get('version','N/A'))" 2>/dev/null || echo "N/A")

        local basename
        basename=$(basename "$contract")

        if [[ "$version1" == "$version2" ]]; then
            log_success "$basename: Both branches use v$version1"
        elif [[ "$version1" == "N/A" || "$version2" == "N/A" ]]; then
            log_info "$basename: Version not found in one or both branches"
        else
            log_warning "$basename: Version mismatch - $branch1 (v$version1) vs $branch2 (v$version2)"
        fi
    done
}

# Check for pending coordination messages
check_pending_messages() {
    section_header "Coordination Messages Check"

    local pending_dir="$PROJECT_ROOT/.claude/coordination/pending-acks"
    local messages_dir="$PROJECT_ROOT/.claude/coordination/messages"

    # Count pending acks
    local pending_count
    pending_count=$(find "$pending_dir" -name "*.json" 2>/dev/null | wc -l | tr -d ' ')

    if [[ "$pending_count" -gt 0 ]]; then
        log_warning "Found $pending_count pending acknowledgments"
        find "$pending_dir" -name "*.json" -exec basename {} \; 2>/dev/null | while read -r f; do
            echo "  - $f"
        done
    else
        log_success "No pending acknowledgments"
    fi

    # Check recent messages
    local recent_messages
    recent_messages=$(find "$messages_dir" -name "*.json" -mtime -1 2>/dev/null | wc -l | tr -d ' ')

    if [[ "$recent_messages" -gt 0 ]]; then
        log_info "Found $recent_messages messages from the last 24 hours"
    fi
}

# Analyze integration points
analyze_integration_points() {
    local branch1="$1"
    local branch2="$2"

    section_header "Integration Points Analysis"

    # Check if branches modify shared interfaces
    local shared_files=("src/core/interfaces.py" "src/core/events.py")

    for shared in "${shared_files[@]}"; do
        local in_branch1
        local in_branch2
        in_branch1=$(git diff --name-only main..."$branch1" 2>/dev/null | grep -c "^$shared$" || echo 0)
        in_branch2=$(git diff --name-only main..."$branch2" 2>/dev/null | grep -c "^$shared$" || echo 0)

        if [[ "$in_branch1" -gt 0 && "$in_branch2" -gt 0 ]]; then
            log_error "$shared modified in BOTH branches - manual merge required"
        elif [[ "$in_branch1" -gt 0 ]]; then
            log_info "$shared modified in $branch1"
        elif [[ "$in_branch2" -gt 0 ]]; then
            log_info "$shared modified in $branch2"
        fi
    done
}

# Recommend merge order
recommend_merge_order() {
    local branch1="$1"
    local branch2="$2"

    section_header "Merge Order Recommendation"

    # Determine types
    local type1=""
    local type2=""

    if [[ "$branch1" == ui/* ]]; then
        type1="ui"
    elif [[ "$branch1" == agent/* ]]; then
        type1="agent"
    elif [[ "$branch1" == contracts/* ]]; then
        type1="contracts"
    fi

    if [[ "$branch2" == ui/* ]]; then
        type2="ui"
    elif [[ "$branch2" == agent/* ]]; then
        type2="agent"
    elif [[ "$branch2" == contracts/* ]]; then
        type2="contracts"
    fi

    echo ""
    echo "Recommended merge order to main:"
    echo ""

    # Order: contracts -> agent -> ui
    if [[ "$type1" == "contracts" || "$type2" == "contracts" ]]; then
        if [[ "$type1" == "contracts" ]]; then
            echo "  1. $branch1 (contracts - merge first)"
        else
            echo "  1. $branch2 (contracts - merge first)"
        fi
    fi

    if [[ "$type1" == "agent" && "$type2" == "ui" ]]; then
        echo "  2. $branch1 (agent - provides backend)"
        echo "  3. $branch2 (ui - consumes backend)"
    elif [[ "$type1" == "ui" && "$type2" == "agent" ]]; then
        echo "  2. $branch2 (agent - provides backend)"
        echo "  3. $branch1 (ui - consumes backend)"
    elif [[ "$type1" == "agent" ]]; then
        echo "  2. $branch1 (agent)"
    elif [[ "$type2" == "agent" ]]; then
        echo "  2. $branch2 (agent)"
    fi

    if [[ "$type1" == "ui" && "$type2" != "agent" ]]; then
        echo "  2. $branch1 (ui)"
    elif [[ "$type2" == "ui" && "$type1" != "agent" ]]; then
        echo "  2. $branch2 (ui)"
    fi

    echo ""
    echo "After merging all branches:"
    echo "  - Run: ./tools/e2e.sh"
    echo "  - Verify contract compatibility"
}

# Generate summary
generate_summary() {
    local branch1="$1"
    local branch2="$2"
    local conflicts="$3"

    section_header "Summary"

    if [[ -n "$conflicts" ]]; then
        local conflict_count
        conflict_count=$(echo "$conflicts" | wc -l | tr -d ' ')
        log_warning "Found $conflict_count potentially conflicting files:"
        echo "$conflicts" | while read -r f; do
            [[ -n "$f" ]] && echo "  - $f"
        done
        echo ""
        log_info "Review these files carefully during merge"
    else
        log_success "No direct file conflicts detected"
    fi
}

main() {
    if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
        usage
        exit 0
    fi

    local branch1="${1:-}"
    local branch2="${2:-}"

    if [[ -z "$branch1" || -z "$branch2" ]]; then
        usage
        exit 1
    fi

    cd "$PROJECT_ROOT"

    echo ""
    echo "Merge Helper - Parallel CLI Branch Analysis"
    echo "Analyzing: $branch1 <-> $branch2"

    # Verify branches exist
    check_branch_exists "$branch1" || exit 1
    check_branch_exists "$branch2" || exit 1

    # Check for file conflicts
    local conflicts
    conflicts=$(check_file_conflicts "$branch1" "$branch2")

    # Run all checks
    check_contract_compatibility "$branch1" "$branch2"
    check_pending_messages
    analyze_integration_points "$branch1" "$branch2"
    recommend_merge_order "$branch1" "$branch2"
    generate_summary "$branch1" "$branch2" "$conflicts"

    echo ""
}

main "$@"
