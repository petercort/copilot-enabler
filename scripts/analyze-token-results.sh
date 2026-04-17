#!/bin/bash

# Token Test Results Analyzer
#
# Analyzes and compares results across multiple test runs.
#
# Usage:
#   ./scripts/analyze-token-results.sh              # Analyze latest run
#   ./scripts/analyze-token-results.sh --compare    # Compare all runs
#   ./scripts/analyze-token-results.sh --csv        # Export to CSV

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
RESULTS_DIR="$REPO_ROOT/token-test-results"

# Find test runs, sorted newest first
find_test_runs() {
    if [ ! -d "$RESULTS_DIR" ]; then
        echo -e "${RED}❌ Results directory not found: $RESULTS_DIR${NC}"
        exit 1
    fi
    
    find "$RESULTS_DIR" -maxdepth 1 -type d -name 'test-*' | sort -r
}

# Display latest results
display_latest() {
    local test_dir=$(find_test_runs | head -1)
    
    if [ -z "$test_dir" ]; then
        echo -e "${RED}❌ No test runs found. Run token tests first.${NC}"
        exit 1
    fi
    
    local timestamp=$(basename "$test_dir" | sed 's/test-//')
    local report="$test_dir/report.json"
    
    if [ ! -f "$report" ]; then
        echo -e "${RED}❌ Could not find report: $report${NC}"
        exit 1
    fi
    
    echo -e "\n${BLUE}📊 LATEST TEST RUN RESULTS${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}📅 Timestamp:${NC} $timestamp"
    echo -e "${CYAN}📁 Location:${NC} $test_dir"
    
    local success=$(jq '.summary.successfulTests' "$report")
    local total=$(jq '.summary.totalTests' "$report")
    echo -e "\n${GREEN}✅ Successful:${NC} $success/$total tests\n"
    
    # Display by model
    echo -e "${YELLOW}📦 TOKEN USAGE BY MODEL:${NC}"
    echo -e "${BLUE}────────────────────────────────────────────────────────────────────────────────${NC}"
    jq -r '.tokenUsageByModel | to_entries[] | 
        "\n  \(.key)\n    • Input:  \(.value.averageInput) avg | \(.value.totalInput) total\n    • Output: \(.value.averageOutput) avg | \(.value.totalOutput) total\n    • Total:  \(.value.totalTokens) tokens (\(.value.testCount) tests)"' "$report"
    
    # Display by effort
    echo -e "\n${YELLOW}💪 TOKEN USAGE BY EFFORT LEVEL:${NC}"
    echo -e "${BLUE}────────────────────────────────────────────────────────────────────────────────${NC}"
    jq -r '.tokenUsageByEffort | to_entries[] | 
        "\n  \(.key | ascii_upcase)\n    • Input:  \(.value.averageInput) avg | \(.value.totalInput) total\n    • Output: \(.value.averageOutput) avg | \(.value.totalOutput) total\n    • Total:  \(.value.totalTokens) tokens (\(.value.testCount) tests)"' "$report"
    
    # Display by prompt type
    echo -e "\n${YELLOW}📝 TOKEN USAGE BY PROMPT TYPE:${NC}"
    echo -e "${BLUE}────────────────────────────────────────────────────────────────────────────────${NC}"
    jq -r '.tokenUsageByPrompt | to_entries[] | 
        "\n  \(.key | ascii_upcase)\n    • Input:  \(.value.averageInput) avg | \(.value.totalInput) total\n    • Output: \(.value.averageOutput) avg | \(.value.totalOutput) total\n    • Total:  \(.value.totalTokens) tokens (\(.value.testCount) tests)"' "$report"
    
    echo -e "\n${BLUE}════════════════════════════════════════════════════════════════════════════════${NC}\n"
}

# Compare multiple runs
compare_runs() {
    local test_dirs=($(find_test_runs))
    
    if [ ${#test_dirs[@]} -eq 0 ]; then
        echo -e "${RED}❌ No test runs found.${NC}"
        exit 1
    fi
    
    if [ ${#test_dirs[@]} -eq 1 ]; then
        echo -e "${CYAN}ℹ️  Only one test run available.${NC}\n"
        display_latest
        return
    fi
    
    echo -e "\n${BLUE}📊 COMPARING TEST RUNS${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════════════════════════════${NC}\n"
    
    echo -e "${YELLOW}📦 MODEL COMPARISON (Latest 3 runs):${NC}\n"
    
    # Get latest 3 runs
    local count=0
    for test_dir in "${test_dirs[@]}"; do
        if [ $count -ge 3 ]; then
            break
        fi
        
        local report="$test_dir/report.json"
        if [ -f "$report" ]; then
            local timestamp=$(basename "$test_dir" | sed 's/test-//')
            
            echo -e "  ${CYAN}$timestamp${NC}"
            jq -r '.tokenUsageByModel | to_entries[] | "    \(.key): \(.value.totalTokens) tokens"' "$report"
            echo ""
        fi
        
        count=$((count + 1))
    done
    
    # Trend analysis if we have at least 2 runs
    if [ ${#test_dirs[@]} -ge 2 ]; then
        local latest_report="${test_dirs[0]}/report.json"
        local previous_report="${test_dirs[1]}/report.json"
        
        if [ -f "$latest_report" ] && [ -f "$previous_report" ]; then
            echo -e "${YELLOW}📈 TRENDS (Latest vs Previous):${NC}\n"
            
            jq -n \
                --slurpfile latest "$latest_report" \
                --slurpfile previous "$previous_report" \
                '
                $latest[0].tokenUsageByModel | to_entries[] |
                .value as $latest_stats |
                .key as $model |
                ($previous[0].tokenUsageByModel[$model] // empty) as $prev_stats |
                ($latest_stats.totalTokens - $prev_stats.totalTokens) as $change |
                (if $prev_stats.totalTokens > 0 then ($change / $prev_stats.totalTokens * 100) else 0 end) as $percent |
                {model: $model, change: $change, percent: $percent, latest: $latest_stats.totalTokens, previous: $prev_stats.totalTokens}
                ' | jq -r '
                if .change > 0 then
                    "  📈 \(.model)\n    Previous: \(.previous)\n    Latest:   \(.latest)\n    Change:   +\(.change) (\(.percent | round)%)\n"
                elif .change < 0 then
                    "  📉 \(.model)\n    Previous: \(.previous)\n    Latest:   \(.latest)\n    Change:   \(.change) (\(.percent | round)%)\n"
                else
                    "  ➡️  \(.model)\n    Previous: \(.previous)\n    Latest:   \(.latest)\n    Change:   0 (0%)\n"
                end
                '
        fi
    fi
    
    echo -e "${BLUE}════════════════════════════════════════════════════════════════════════════════${NC}\n"
}

# Export to CSV
export_csv() {
    local test_dir=$(find_test_runs | head -1)
    
    if [ -z "$test_dir" ]; then
        echo -e "${RED}❌ No test runs found.${NC}"
        exit 1
    fi
    
    local results_file="$test_dir/all-results.json"
    local csv_file="$test_dir/results.csv"
    
    if [ ! -f "$results_file" ]; then
        echo -e "${RED}❌ Could not find results: $results_file${NC}"
        exit 1
    fi
    
    # Create CSV header
    echo "Test #,Model,Effort,Prompt Type,Prompt Length,Input Tokens,Output Tokens,Total Tokens,Response Time (ms),Success" > "$csv_file"
    
    # Add data rows
    jq -r '.[] | [.testNumber, .modelDisplay, .effort, .promptType, .promptLength, .inputTokens // 0, .outputTokens // 0, ((.inputTokens // 0) + (.outputTokens // 0)), .responseTime, (if .success then "Yes" else "No" end)] | @csv' "$results_file" >> "$csv_file"
    
    local row_count=$(tail -n +2 "$csv_file" | wc -l)
    
    echo -e "${GREEN}✅ CSV exported to:${NC} $csv_file"
    echo -e "\n${CYAN}📊 Summary:${NC}"
    echo -e "   Total rows: $row_count"
    echo -e "   Ready for import into Excel, Google Sheets, or other tools\n"
}

# Show help
show_help() {
    cat << 'EOF'
Token Test Results Analyzer

Usage:
  ./scripts/analyze-token-results.sh [COMMAND]

Commands:
  (none)       Analyze latest test run
  --compare    Compare multiple test runs
  --csv        Export latest results to CSV
  --help       Show this help message

Examples:
  ./scripts/analyze-token-results.sh
  ./scripts/analyze-token-results.sh --compare
  ./scripts/analyze-token-results.sh --csv

EOF
}

# Main
COMMAND="${1:-latest}"

if [ "$COMMAND" = "--help" ] || [ "$COMMAND" = "-h" ]; then
    show_help
elif [ "$COMMAND" = "--compare" ]; then
    compare_runs
elif [ "$COMMAND" = "--csv" ]; then
    export_csv
elif [ "$COMMAND" = "latest" ] || [ -z "$COMMAND" ]; then
    display_latest
else
    echo -e "${RED}❌ Unknown command: $COMMAND${NC}\n"
    show_help
    exit 1
fi
