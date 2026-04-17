# Quick Reference: Analyzing Your Test Results

## Run Tests
```bash
./scripts/run-token-tests.sh
```

Results saved to: `token-test-results/test-TIMESTAMP/`

## View What Happened (Console Log)
```bash
cat token-test-results/test-TIMESTAMP/console-output.txt
```

## See Detailed Per-Test Results
```bash
# Pretty-print the breakdown
jq '.detailedBreakdown' token-test-results/test-TIMESTAMP/report.json

# For specific model
jq '.detailedBreakdown[] | select(.model == "Claude Sonnet 4.6")' \
  token-test-results/test-TIMESTAMP/report.json
```

## Compare Models Side-By-Side
```bash
# Show all tests with input→output
jq '.detailedBreakdown[] | .model as $m | .tests[] | "\($m): \(.effort)/\(.promptType) → \(.inputTokens)→\(.outputTokens) (\(.responseTime)ms)"' \
  token-test-results/test-TIMESTAMP/report.json
```

## Export for Excel/Analysis
```bash
# Create CSV
jq -r '.detailedBreakdown[] | .model as $m | .tests[] | "\($m),\(.effort),\(.promptType),\(.inputTokens),\(.outputTokens),\(.responseTime)"' \
  token-test-results/test-TIMESTAMP/report.json | \
  (echo "Model,Effort,Prompt,InputTokens,OutputTokens,TimeMS" && cat) > results.csv
```

## Key Files in Each Session

- **console-output.txt** - Everything the script printed (for review)
- **report.json** - Structured data including `detailedBreakdown` with per-test metrics
- **all-results.json** - Raw test data
- **test-config.json** - What prompts/models were tested

## Session Directory Location
```
token-test-results/
├── test-2026-04-13_11-09-41/  ← Older test
│   ├── console-output.txt
│   ├── report.json
│   ├── all-results.json
│   └── test-config.json
├── test-2026-04-13_11-18-13/  ← Newer test
│   ├── console-output.txt
│   ├── report.json
│   ├── all-results.json
│   └── test-config.json
└── ... more sessions
```

## Common Analysis Questions Answered

**Q: Did Claude or GPT do better?**
```bash
jq '.detailedBreakdown[] | {model: .model, avg_output: (.tests | map(.outputTokens) | add / length | floor)}' \
  token-test-results/test-TIMESTAMP/report.json
```

**Q: What's the impact of high effort?**
```bash
jq '.detailedBreakdown[0].tests | group_by(.effort) | map({effort: .[0].effort, avg_output: (map(.outputTokens) | add / length | floor)})' \
  token-test-results/test-TIMESTAMP/report.json
```

**Q: How long did each test take?**
```bash
jq '.detailedBreakdown[] | .model as $m | .tests | map("\($m) \(.effort) \(.promptType): \(.responseTime)ms")[]' \
  token-test-results/test-TIMESTAMP/report.json
```

**Q: Compare two test sessions**
```bash
# View both sessions' detailed breakdowns
echo "=== Session 1 ===" && \
jq '.detailedBreakdown' token-test-results/test-SESSION1/report.json

echo "=== Session 2 ===" && \
jq '.detailedBreakdown' token-test-results/test-SESSION2/report.json
```

## What Each Metric Means

- **inputTokens** - Tokens sent to the model (prompt + context)
- **outputTokens** - Tokens returned by the model (response)
- **responseTime** - Round-trip time in milliseconds
- **responseChars** - Number of characters in the response
- **effort** - "low" for concise, "high" for detailed reasoning
- **promptType** - "simple" (~79 chars) or "complex" (~805 chars with file refs)

## Tips for Analysis

1. **Track over time** - Run tests regularly and compare sessions
2. **Validate consistency** - Same input should produce similar output
3. **Spot trends** - Look for patterns in token scaling with complexity
4. **Compare costs** - Higher tokens = higher API costs
5. **Identify efficiency** - Which model produces more output per token?

## Next Steps

See **TOKEN_TESTING_ANALYSIS_GUIDE.md** for detailed analysis workflows.
