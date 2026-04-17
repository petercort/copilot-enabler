# Token Usage Testing Scripts (Bash)

This directory contains pure Bash scripts to measure and compare token utilization across different LLM models and effort levels using the GitHub Copilot CLI.

## Overview

The token testing suite measures:

- **Models**: Claude Sonnet 4.6 and GPT-5.4
- **Effort Levels**: Low and High
- **Prompt Types**:
  - **Simple**: Generic request to explain the app and key functionality
  - **Complex**: Detailed prompt with specific file references and implementation context

## Output Metrics

Each test captures:
- **Input tokens**: Number of tokens in the prompt and context
- **Output tokens**: Number of tokens in the LLM response
- **Total tokens**: Sum of input + output
- **Response time**: Time to complete the request (milliseconds)
- **Model and effort level used**
- **Prompt type and length**

## Files

### `token-usage-test.sh` (Bash)
Main testing script using pure Bash and the Copilot CLI.

**Usage:**
```bash
./scripts/token-usage-test.sh
```

**Requirements:**
- Bash 4+
- GitHub Copilot CLI (`copilot` command available in PATH)
- `jq` for JSON processing (usually pre-installed on macOS/Linux)

### `analyze-token-results.sh` (Bash)
Results analyzer for viewing and comparing test runs.

**Usage:**
```bash
# View latest results
./scripts/analyze-token-results.sh

# Compare multiple runs
./scripts/analyze-token-results.sh --compare

# Export to CSV
./scripts/analyze-token-results.sh --csv
```

### `run-token-tests.sh` (Bash)
Convenient wrapper that runs tests with proper validation.

**Usage:**
```bash
./scripts/run-token-tests.sh
```

## Running Tests

### Quick Start

```bash
./scripts/run-token-tests.sh
```

### Test Matrix

The scripts automatically run all combinations:
- 2 models × 2 effort levels × 2 prompt types = **8 tests per run**

Test sequence:
1. Claude 4.6, Low effort, Simple prompt
2. Claude 4.6, Low effort, Complex prompt
3. Claude 4.6, High effort, Simple prompt
4. Claude 4.6, High effort, Complex prompt
5. GPT-5.4, Low effort, Simple prompt
6. GPT-5.4, Low effort, Complex prompt
7. GPT-5.4, High effort, Simple prompt
8. GPT-5.4, High effort, Complex prompt

## Output

All results are saved to `token-test-results/test-{timestamp}/`:

### Files Generated

- **`report.json`** — Aggregated summary with token usage statistics
  - Totals and averages by model
  - Totals and averages by effort level
  - Totals and averages by prompt type
  - Test counts and success rates

- **`all-results.json`** — Detailed results for each individual test
  - Input/output token counts
  - Response time
  - Model and effort level used
  - Success/failure status

- **`test-config.json`** — Test configuration and prompts used
  - Model list
  - Effort levels
  - Prompt types
  - Full text of both prompts

- **`results.csv`** — CSV export (created with `--csv` flag)
  - One row per test
  - Ready for Excel/Google Sheets

## Analyzing Results

### View Latest Results
```bash
./scripts/analyze-token-results.sh
```

### Compare Across Runs
```bash
./scripts/analyze-token-results.sh --compare
```

Displays token usage trends between test runs.

### Export to CSV
```bash
./scripts/analyze-token-results.sh --csv
```

The CSV file can be imported into Excel, Google Sheets, or other tools for further analysis.

## Customization

To modify the test parameters, edit the configuration section at the top of `token-usage-test.sh`:

```bash
# Models
MODELS=("claude-sonnet-4.6:Claude Sonnet 4.6" "gpt-5.4:GPT-5.4")

# Effort levels
EFFORTS=("low" "high")

# Simple prompt
read -r -d '' SIMPLE_PROMPT << 'EOF' || true
Your custom prompt here
EOF

# Complex prompt
read -r -d '' COMPLEX_PROMPT << 'EOF' || true
Your custom prompt here
EOF
```

## Troubleshooting

### "Copilot CLI not found"
Ensure the GitHub Copilot CLI is installed and available in your PATH:
```bash
which copilot
copilot --version
```

### "jq not found"
Install jq:
```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq

# Or download from: https://github.com/stedolan/jq
```

### "Failed to parse response"
Check that the Copilot CLI is returning valid JSON. Run a test command manually:
```bash
copilot explain "test prompt" --model claude-sonnet-4.6 --effort low --json
```

## Tips & Tricks

### Quick Analysis with jq
```bash
# Get latest report
cat token-test-results/test-*/report.json | jq '.'

# Show only model totals
jq '.tokenUsageByModel | to_entries[] | "\(.key): \(.value.totalTokens) tokens"' report.json

# Compare effort levels
jq '.tokenUsageByEffort | to_entries[] | "\(.key): \(.value.averageOutput)"' report.json

# Get all failed tests
jq '.[] | select(.success == false)' all-results.json
```

### Batch Testing
```bash
# Run 3 times and compare
for i in 1 2 3; do
  echo "Test run $i..."
  ./scripts/run-token-tests.sh
  sleep 60
done

./scripts/analyze-token-results.sh --compare
```

## Next Steps

1. Run baseline tests:
   ```bash
   ./scripts/run-token-tests.sh
   ```

2. Review results:
   ```bash
   ./scripts/analyze-token-results.sh
   ```

3. Export to CSV for detailed analysis:
   ```bash
   ./scripts/analyze-token-results.sh --csv
   ```

---

**Version**: 1.0  
**Created**: April 2024
