#!/bin/bash

# Token Usage Testing Runner
# Runs the token usage tests with proper checks

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Copilot Token Usage Test Runner${NC}\n"

# Check for copilot CLI
if ! command -v copilot &> /dev/null; then
    echo -e "${RED}❌ GitHub Copilot CLI not found in PATH${NC}"
    echo "Install it first: https://github.com/github/copilot-cli"
    exit 1
fi

echo -e "${GREEN}✅ Copilot CLI found: $(copilot --version)${NC}\n"

# Make test script executable
chmod +x "$SCRIPT_DIR/token-usage-test.sh" "$SCRIPT_DIR/analyze-token-results.sh" 2>/dev/null || true

# Run the test script
echo -e "${BLUE}📊 Running token usage tests...${NC}\n"
"$SCRIPT_DIR/token-usage-test.sh"

echo -e "\n${GREEN}✨ Tests complete!${NC}"
echo -e "For more info, see: ${YELLOW}scripts/TOKEN_TESTING.md${NC}\n"
