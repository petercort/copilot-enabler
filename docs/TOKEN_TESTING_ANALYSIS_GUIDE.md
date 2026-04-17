# Token Testing Suite - Analysis Guide

## Overview

The enhanced token testing suite now captures **detailed per-test outputs** and **complete session logs** for comprehensive analysis.

## Output Files Generated Per Session

Each test run creates 4 key files in a timestamped directory (`token-test-results/test-TIMESTAMP/`):

### 1. console-output.txt
**Full session console output** with colored formatting preserved
- Complete test progress (all 8 tests)
- Input/output token counts for each test
- Response times
- All status messages

```
🚀 Starting Copilot Response Measurement Test Suite
📦 Repository: /Users/petercort/Documents/petercort/copilot-enabler-vscode
📁 Output: .../token-test-results/test-2026-04-13_11-09-41

[1/8] Testing Claude Sonnet 4.6 (low) - simple prompt
   ✅ Input: 50700 tokens, Output: 425 tokens, Time: 26000ms
...
```

### 2. report.json
**Aggregated analysis** including detailed breakdown by test
- Test session metadata (timestamp, models, effort levels)
- Summary statistics (total/success/failed tests)
- **detailedBreakdown**: Per-test breakdown with specific outputs
- Complete raw details array

```json
{
  "testSession": { ... },
  "summary": { "totalTests": 8, "successfulTests": 8, ... },
  "detailedBreakdown": [
    {
      "model": "Claude Sonnet 4.6",
      "tests": [
        {
          "effort": "low",
          "promptType": "simple",
          "inputTokens": 50700,
          "outputTokens": 425,
          "responseTime": 26000,
          "responseChars": 887
        }
      ]
    }
  ],
  "details": [ ... ]
}
```

### 3. all-results.json
**Raw data** for all 8 test results
- Useful for custom analysis and visualization
- Contains complete test data without aggregation

### 4. test-config.json
**Test configuration** used for the session
- Model names and display names
- Effort levels tested
- Prompt types used
- Full prompt text (for reproducibility)

## Analyzing Results

### View Console Output
```bash
cat token-test-results/test-2026-04-13_11-09-41/console-output.txt
```

### Extract Detailed Breakdown
```bash
jq '.detailedBreakdown' token-test-results/test-2026-04-13_11-09-41/report.json
```

### Get Specific Model Results
```bash
# Claude Sonnet 4.6 results only
jq '.detailedBreakdown[] | select(.model == "Claude Sonnet 4.6")' \
  token-test-results/test-2026-04-13_11-09-41/report.json

# GPT-5.4 results only
jq '.detailedBreakdown[] | select(.model == "GPT-5.4")' \
  token-test-results/test-2026-04-13_11-09-41/report.json
```

### Compare Tests Side-by-Side
```bash
# View all tests with effort, prompt type, and token counts
jq '.detailedBreakdown[] | .model, (.tests[] | "  \(.effort) \(.promptType): \(.inputTokens) → \(.outputTokens) tokens")' \
  token-test-results/test-2026-04-13_11-09-41/report.json
```

### Analyze Token Patterns
```bash
# High effort vs low effort impact
jq '.detailedBreakdown[] | .model as $model | .tests | group_by(.effort) | map({effort: .[0].effort, avg_output: ((map(.outputTokens) | add) / length)})' \
  token-test-results/test-2026-04-13_11-09-41/report.json
```

### Export for Comparison
```bash
# Create CSV for comparison
jq -r '.detailedBreakdown[] | .model as $model | .tests[] | "\($model),\(.effort),\(.promptType),\(.inputTokens),\(.outputTokens),\(.responseTime)"' \
  token-test-results/test-2026-04-13_11-09-41/report.json
```

## Sample Results Analysis

### Test Session: 2026-04-13_11-09-41

**Claude Sonnet 4.6:**
- Low effort, simple prompt: 50.7k input → 425 output (26s)
- Low effort, complex prompt: 125.8k input → 2.2k output (51s)
- High effort, simple prompt: 50.8k input → 487 output (24s)
- High effort, complex prompt: 233k input → 3.1k output (77s)

**GPT-5.4:**
- Low effort, simple prompt: 46.5k input → 421 output (34s)
- Low effort, complex prompt: 189k input → 3.5k output (117s)
- High effort, simple prompt: 46.8k input → 874 output (33s)
- High effort, complex prompt: 236.4k input → 4.9k output (118s)

## Key Insights

1. **Output Token Comparison**
   - Claude Sonnet 4.6 (high, complex): 3,100 tokens
   - GPT-5.4 (high, complex): 4,900 tokens (58% more)

2. **Effort Level Impact**
   - Output increases significantly with high effort
   - Simple prompts: ~440-900 tokens
   - Complex prompts: ~2,200-4,900 tokens

3. **Response Time Correlation**
   - GPT-5.4 generally takes longer for complex prompts
   - Claude is faster but produces fewer tokens

4. **Input Token Variation**
   - Simple prompts: ~46-51k tokens
   - Complex prompts: ~125-236k tokens (3-4x increase)

## Workflow for Regular Analysis

1. **Run tests**
   ```bash
   ./scripts/run-token-tests.sh
   ```

2. **Get the session timestamp**
   ```bash
   ls -lt token-test-results/ | head -2
   ```

3. **Analyze your session**
   ```bash
   SESSION="test-2026-04-13_11-09-41"
   jq '.detailedBreakdown' token-test-results/$SESSION/report.json
   ```

4. **Compare with previous sessions**
   ```bash
   # View multiple sessions
   jq '.detailedBreakdown' token-test-results/test-*/report.json
   ```

5. **Track trends over time**
   - Save session results to a tracking file
   - Compare token usage patterns across runs
   - Identify model improvements or regressions

## Notes

- Token counts are captured from actual Copilot CLI output
- Response times include round-trip to API
- Each session is isolated and time-stamped for reproducibility
- Console output preserves all color formatting and progress indicators
- Report JSON is optimized for both human reading and programmatic analysis
