#!/bin/bash

# Token Usage Testing Script (Simplified for Copilot CLI)
#
# Captures actual token usage from Copilot CLI and generates detailed reports

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="$REPO_ROOT/token-test-results"
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
SESSION_DIR="$OUTPUT_DIR/test-$TIMESTAMP"

# Models
MODELS=("claude-sonnet-4.6:Claude Sonnet 4.6" "gpt-5.4:GPT-5.4")

# Effort levels
EFFORTS=("low" "high")

# Create output directory
mkdir -p "$SESSION_DIR"

# Log file for console output
CONSOLE_OUTPUT="$SESSION_DIR/console-output.txt"

# Function to log messages (both to console and file)
log_msg() {
    echo -e "$1" | tee -a "$CONSOLE_OUTPUT"
}

# Simple prompt
read -r -d '' SIMPLE_PROMPT << 'EOF' || true
Explain what this VS Code extension does and its key functionality. Be concise.
EOF

# Complex prompt
read -r -d '' COMPLEX_PROMPT << 'EOF' || true
I need you to analyze this GitHub Copilot extension codebase and explain what it does.

Key files to reference:
- src/extension.ts (entry point)
- src/core/analyzer.ts (analysis orchestration)
- src/core/featureCatalog.ts (feature tracking)
- src/core/agents/ (agent implementations)
- src/views/ (UI components and webviews)
- package.json (contributes, commands, configuration)

Please provide:
1. A high-level overview of what the extension does
2. The key functionality it provides (Scorecard, Feature Catalog, Recommendations, Implementation, Export)
3. What data sources it analyzes (Settings, Workspace Files, Extensions, Copilot Logs)
4. The main commands available to users
5. How the three agents (CoreAgent, CustomizationsAgent, AdoptionAgent) contribute to analysis

Be detailed but organized.
EOF

# Temporary files
TMP_RESULTS="$SESSION_DIR/.results.tmp"

# Initialize results file
echo "[]" > "$TMP_RESULTS"

log_msg "${BLUE}🚀 Starting Copilot Response Measurement Test Suite${NC}"
log_msg "${CYAN}📦 Repository: $REPO_ROOT${NC}"
log_msg "${CYAN}📁 Output: $SESSION_DIR${NC}"
log_msg "${CYAN}🔧 Models: ${MODELS[@]}${NC}"
log_msg "${CYAN}💪 Effort Levels: ${EFFORTS[@]}${NC}"
log_msg "${CYAN}📝 Prompt Types: simple, complex${NC}"
log_msg ""

# Check Copilot CLI
if ! command -v copilot &> /dev/null; then
    log_msg "${RED}❌ Copilot CLI not found in PATH${NC}"
    log_msg "Install from: https://github.com/github/copilot-cli"
    exit 1
fi

log_msg "${GREEN}✅ Copilot CLI found${NC}\n"

# Test counter
TEST_NUM=0
TOTAL_TESTS=$((${#MODELS[@]} * ${#EFFORTS[@]} * 2))
SUCCESS_COUNT=0

# Test loop
for model_pair in "${MODELS[@]}"; do
    IFS=':' read -r MODEL_NAME MODEL_DISPLAY <<< "$model_pair"
    
    for effort in "${EFFORTS[@]}"; do
        for prompt_type in simple complex; do
            TEST_NUM=$((TEST_NUM + 1))
            
            # Select prompt
            if [ "$prompt_type" = "simple" ]; then
                PROMPT="$SIMPLE_PROMPT"
            else
                PROMPT="$COMPLEX_PROMPT"
            fi
            
            PROMPT_LEN=${#PROMPT}
            
            log_msg "${YELLOW}[$TEST_NUM/$TOTAL_TESTS]${NC} Testing ${CYAN}$MODEL_DISPLAY${NC} (${CYAN}$effort${NC}) - ${CYAN}$prompt_type${NC} prompt"
            
            START_TIME=$(date +%s)
            
            # Run copilot command with non-interactive mode
            OUTPUT=$(copilot -p "$PROMPT" --model "$MODEL_NAME" --effort "$effort" --allow-all-tools 2>&1) || OUTPUT=""
            
            END_TIME=$(date +%s)
            RESPONSE_TIME=$(( (END_TIME - START_TIME) * 1000 ))
            
            # Parse token usage from output
            # Format: "Tokens    ↑ 24.5k • ↓ 34 • 0 (cached)"
            TOKEN_LINE=$(echo "$OUTPUT" | grep "Tokens" || echo "")
            
            if [ -n "$TOKEN_LINE" ]; then
                # Extract input tokens (after ↑)
                INPUT_TOKENS=$(echo "$TOKEN_LINE" | sed 's/.*↑[[:space:]]*//; s/[[:space:]].*//')
                # Extract output tokens (after ↓)
                OUTPUT_TOKENS=$(echo "$TOKEN_LINE" | sed 's/.*↓[[:space:]]*//; s/[[:space:]][^0-9].*//')
            else
                INPUT_TOKENS=""
                OUTPUT_TOKENS=""
            fi
            
            # Convert k/m notation to actual numbers
            if [[ "$INPUT_TOKENS" == *"k" ]]; then
                INPUT_TOKENS=$(echo "${INPUT_TOKENS%k} * 1000" | bc 2>/dev/null || echo "0")
                INPUT_TOKENS=${INPUT_TOKENS%.*}
            fi
            if [[ "$OUTPUT_TOKENS" == *"k" ]]; then
                OUTPUT_TOKENS=$(echo "${OUTPUT_TOKENS%k} * 1000" | bc 2>/dev/null || echo "0")
                OUTPUT_TOKENS=${OUTPUT_TOKENS%.*}
            fi
            
            INPUT_TOKENS=${INPUT_TOKENS:-0}
            OUTPUT_TOKENS=${OUTPUT_TOKENS:-0}
            
            # Extract response body (before the "Changes" line)
            RESPONSE_BODY=$(echo "$OUTPUT" | sed '/^Changes/,$d')
            
            # Check if we got a response
            if [ -n "$RESPONSE_BODY" ] && [ ${#RESPONSE_BODY} -gt 10 ]; then
                SUCCESS="true"
                SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
                
                log_msg "   ${GREEN}✅${NC} Input: ${INPUT_TOKENS:-?} tokens, Output: ${OUTPUT_TOKENS:-?} tokens, Time: ${RESPONSE_TIME}ms"
                
                # Append to results
                RESULT=$(jq -n \
                    --arg test_num "$TEST_NUM" \
                    --arg model "$MODEL_NAME" \
                    --arg model_display "$MODEL_DISPLAY" \
                    --arg effort "$effort" \
                    --arg prompt_type "$prompt_type" \
                    --arg prompt_len "$PROMPT_LEN" \
                    --arg input_tokens "$INPUT_TOKENS" \
                    --arg output_tokens "$OUTPUT_TOKENS" \
                    --arg response_time "$RESPONSE_TIME" \
                    --arg success "$SUCCESS" \
                    --arg response_len "${#RESPONSE_BODY}" \
                    '{
                        testNumber: ($test_num | tonumber),
                        model: $model,
                        modelDisplay: $model_display,
                        effort: $effort,
                        promptType: $prompt_type,
                        promptLength: ($prompt_len | tonumber),
                        inputTokens: ($input_tokens | tonumber),
                        outputTokens: ($output_tokens | tonumber),
                        responseCharacters: ($response_len | tonumber),
                        responseTime: ($response_time | tonumber),
                        success: ($success == "true")
                    }')
                
                jq ". += [$RESULT]" "$TMP_RESULTS" > "${TMP_RESULTS}.new" && mv "${TMP_RESULTS}.new" "$TMP_RESULTS"
            else
                log_msg "   ${RED}❌${NC} No response or timeout"
                
                RESULT=$(jq -n \
                    --arg test_num "$TEST_NUM" \
                    --arg model "$MODEL_NAME" \
                    --arg model_display "$MODEL_DISPLAY" \
                    --arg effort "$effort" \
                    --arg prompt_type "$prompt_type" \
                    --arg prompt_len "$PROMPT_LEN" \
                    --arg response_time "$RESPONSE_TIME" \
                    '{
                        testNumber: ($test_num | tonumber),
                        model: $model,
                        modelDisplay: $model_display,
                        effort: $effort,
                        promptType: $prompt_type,
                        promptLength: ($prompt_len | tonumber),
                        responseTime: ($response_time | tonumber),
                        success: false,
                        error: "No response or timeout"
                    }')
                
                jq ". += [$RESULT]" "$TMP_RESULTS" > "${TMP_RESULTS}.new" && mv "${TMP_RESULTS}.new" "$TMP_RESULTS"
            fi
            
            sleep 1
        done
    done
done

# Generate report
log_msg "\n${BLUE}📊 Generating Reports${NC}\n"

ALL_RESULTS=$(cat "$TMP_RESULTS")

# Save all results
echo "$ALL_RESULTS" | jq '.' > "$SESSION_DIR/all-results.json"
log_msg "${GREEN}✅${NC} Results saved: $SESSION_DIR/all-results.json"

# Generate aggregated report using jq
REPORT=$(jq -n \
    --arg timestamp "$TIMESTAMP" \
    --arg session_dir "$SESSION_DIR" \
    --arg repo "$REPO_ROOT" \
    --argjson results "$ALL_RESULTS" \
    '{
        testSession: {
            timestamp: $timestamp,
            sessionDir: $session_dir,
            repo: $repo,
            models: ["Claude Sonnet 4.6", "GPT-5.4"],
            effortLevels: ["low", "high"],
            promptTypes: ["simple", "complex"],
            note: "Token counts are captured from Copilot CLI output (↑ = input tokens, ↓ = output tokens)"
        },
        summary: {
            totalTests: ($results | length),
            successfulTests: ($results | map(select(.success == true)) | length),
            failedTests: ($results | map(select(.success == false)) | length)
        },
        details: $results
    }')

# Add detailed breakdown by test
REPORT=$(echo "$REPORT" | jq \
    --argjson results "$ALL_RESULTS" \
    '.detailedBreakdown = (
        $results | group_by(.model) | map(
            {
                model: .[0].modelDisplay,
                tests: (
                    . | map(
                        {
                            effort: .effort,
                            promptType: .promptType,
                            inputTokens: .inputTokens,
                            outputTokens: .outputTokens,
                            responseTime: .responseTime,
                            responseChars: .responseCharacters,
                            promptLength: .promptLength
                        }
                    )
                )
            }
        )
    )')

# Save report
echo "$REPORT" | jq '.' > "$SESSION_DIR/report.json"
log_msg "${GREEN}✅${NC} Report saved: $SESSION_DIR/report.json"

# Save test config
CONFIG=$(jq -n \
    --arg simple "$SIMPLE_PROMPT" \
    --arg complex "$COMPLEX_PROMPT" \
    '{
        models: [
            {name: "claude-sonnet-4.6", displayName: "Claude Sonnet 4.6"},
            {name: "gpt-5.4", displayName: "GPT-5.4"}
        ],
        effortLevels: ["low", "high"],
        promptTypes: ["simple", "complex"],
        prompts: {
            simple: $simple,
            complex: $complex
        }
    }')

echo "$CONFIG" | jq '.' > "$SESSION_DIR/test-config.json"
log_msg "${GREEN}✅${NC} Config saved: $SESSION_DIR/test-config.json"

# Display results
log_msg "\n${BLUE}════════════════════════════════════════════════════════════════════════════════${NC}"
log_msg "${BLUE}📈 RESPONSE MEASUREMENT TEST RESULTS${NC}"
log_msg "${BLUE}════════════════════════════════════════════════════════════════════════════════${NC}\n"

log_msg "${CYAN}📅 Session:${NC} $TIMESTAMP"
log_msg "${CYAN}📁 Results:${NC} $SESSION_DIR"
log_msg "${GREEN}✅ Successful:${NC} $SUCCESS_COUNT/$TOTAL_TESTS\n"

log_msg "${YELLOW}📊 DETAILED TEST RESULTS BY MODEL:${NC}"
log_msg "${BLUE}────────────────────────────────────────────────────────────────────────────────${NC}"

echo "$REPORT" | jq -r '.detailedBreakdown[] | "\n  \(.model):" + (.tests | map("\n    \(.effort | ascii_upcase) effort, \(.promptType) prompt:\n      • Input: \(.inputTokens) tokens\n      • Output: \(.outputTokens) tokens\n      • Time: \(.responseTime) ms\n      • Chars: \(.responseChars)") | join(""))' | tee -a "$CONSOLE_OUTPUT"

log_msg "\n${BLUE}════════════════════════════════════════════════════════════════════════════════${NC}"
log_msg "\n${CYAN}✅ Token usage captured from Copilot CLI output${NC}\n"

log_msg "${GREEN}✨ Test session complete!${NC}"
log_msg "${CYAN}💾 Results saved to: $SESSION_DIR${NC}"
log_msg "${CYAN}📝 Console output: $CONSOLE_OUTPUT${NC}\n"

# Cleanup
rm -f "$TMP_RESULTS"

