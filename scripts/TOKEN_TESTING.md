# Token Usage Testing Scripts

This directory contains automated testing scripts to measure and compare token utilization across different LLM models and effort levels using the GitHub Copilot CLI.

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
Main testing script using Bash and the Copilot CLI.

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
# Using Node.js
npm install  # if not already done
node scripts/token-usage-test.js

# OR using Python
python3 scripts/token-usage-test.py
```

### Test Matrix

The scripts automatically run all combinations:
- 2 models × 2 effort levels × 2 prompt types = **8 tests per run**

Example test schedule:
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
  - Full response data
  - Input/output token counts
  - Response time
  - Model and effort level used
  - Success/failure status

- **`test-config.json`** — Test configuration and prompts used
  - Model list
  - Effort levels
  - Prompt types
  - Full text of both prompts

### Example Output

```
================================================================================
📈 TOKEN USAGE TEST RESULTS
================================================================================

📅 Session: 2024-01-15_14-23-45
📁 Results saved to: /path/to/token-test-results/test-2024-01-15_14-23-45

✅ Successful: 8/8

📊 TOKEN USAGE BY MODEL:
────────────────────────────────────────────────────────────────────────────────

  Claude Sonnet 4.6:
    • Avg Input:  1,245 tokens
    • Avg Output: 892 tokens
    • Total:      8,548 tokens (4 tests)

  GPT-5.4:
    • Avg Input:  1,201 tokens
    • Avg Output: 1,034 tokens
    • Total:      8,940 tokens (4 tests)

📊 TOKEN USAGE BY EFFORT LEVEL:
────────────────────────────────────────────────────────────────────────────────

  LOW:
    • Avg Input:  1,150 tokens
    • Avg Output: 623 tokens
    • Total:      7,052 tokens (4 tests)

  HIGH:
    • Avg Input:  1,296 tokens
    • Avg Output: 1,303 tokens
    • Total:      10,436 tokens (4 tests)

📊 TOKEN USAGE BY PROMPT TYPE:
────────────────────────────────────────────────────────────────────────────────

  SIMPLE:
    • Avg Input:  89 tokens
    • Avg Output: 412 tokens
    • Total:      4,012 tokens (4 tests)

  COMPLEX:
    • Avg Input:  2,357 tokens
    • Avg Output: 1,514 tokens
    • Total:      15,476 tokens (4 tests)

================================================================================

💾 Full results saved as JSON for detailed analysis

Files:
  • report.json (aggregated summary)
  • all-results.json (detailed test results)
```

## Analyzing Results

### Using the JSON Output

The JSON files can be analyzed with any tool. Some examples:

**jq** — Quick command-line analysis:
```bash
# Get average tokens by model
jq '.tokenUsageByModel | to_entries[] | "\(.key): \(.value.averageInput) in, \(.value.averageOutput) out"' report.json

# Get all failed tests
jq '.[] | select(.success == false)' all-results.json

# Compare effort levels
jq '.tokenUsageByEffort' report.json
```

**Python** — Custom analysis:
```python
import json

with open('token-test-results/test-2024-01-15/all-results.json') as f:
    results = json.load(f)

# Filter by model
claude_results = [r for r in results if r['model'] == 'claude-sonnet-4.6']
print(f"Claude total tokens: {sum(r['inputTokens'] + r['outputTokens'] for r in claude_results)}")

# Compare prompt types
simple = [r for r in results if r['promptType'] == 'simple']
complex_p = [r for r in results if r['promptType'] == 'complex']

simple_avg = sum(r['inputTokens'] + r['outputTokens'] for r in simple) / len(simple)
complex_avg = sum(r['inputTokens'] + r['outputTokens'] for r in complex_p) / len(complex_p)

print(f"Simple prompt avg: {simple_avg}")
print(f"Complex prompt avg: {complex_avg}")
print(f"Complexity multiplier: {complex_avg / simple_avg:.2f}x")
```

**Excel/Google Sheets** — Import `all-results.json` for pivot tables and charts

## Customization

To modify the test parameters, edit the configuration section at the top of either script:

### JavaScript (token-usage-test.js)
```javascript
const MODELS = [
  { name: 'claude-sonnet-4.6', displayName: 'Claude Sonnet 4.6' },
  { name: 'gpt-5.4', displayName: 'GPT-5.4' }
];

const EFFORT_LEVELS = ['low', 'high'];
```

### Python (token-usage-test.py)
```python
MODELS = [
    {"name": "claude-sonnet-4.6", "displayName": "Claude Sonnet 4.6"},
    {"name": "gpt-5.4", "displayName": "GPT-5.4"},
]

EFFORT_LEVELS = ["low", "high"]
```

Edit the `getSimplePrompt()` and `getComplexPrompt()` functions to change prompt text.

## Troubleshooting

### "Copilot CLI not found"
Ensure the GitHub Copilot CLI is installed and available in your PATH:
```bash
which copilot
copilot --version
```

### "Failed to parse response"
Check that the Copilot CLI is returning valid JSON. Run a test command manually:
```bash
copilot explain "test prompt" --model claude-sonnet-4.6 --effort low --json
```

### Slow tests
- Ensure you have a stable internet connection
- The scripts have a 500ms delay between requests — adjust by modifying the `setTimeout` (JS) or `time.sleep()` (Python) calls
- Consider running fewer models/efforts for quick tests

### Different token counts than expected
Token counts depend on:
- The actual Copilot model's tokenizer
- Context from your VS Code workspace
- The specific prompt and response length

## Next Steps

- [ ] Run tests multiple times to establish baselines
- [ ] Compare different prompt strategies
- [ ] Track changes over time as prompts/models evolve
- [ ] Use results to optimize token usage in production
- [ ] Share findings with your team

---

**Created by**: Copilot Token Testing Suite  
**Last Updated**: 2024
