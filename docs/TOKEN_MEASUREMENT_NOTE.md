# ⚠️ Important Note: Token Measurement Approach

## Why Token Counts Are Estimated

The GitHub Copilot CLI does **not expose actual token usage data** through its command-line interface. Therefore, this testing suite uses a **proxy measurement approach**:

### Measurement Method

- **Estimated Input Tokens**: Calculated from prompt character length (~4 characters per token)
- **Estimated Output Tokens**: Calculated from response character length (~4 characters per token)
- **Actual Measurements**: Response time and response length (characters)

### Why This Matters

These token estimates are **approximate**. The actual token counts depend on:
- The specific tokenizer used by each model
- Special formatting and escape sequences
- Model-specific optimizations

### What This Suite Measures

✅ **Response Time** — How long each request takes  
✅ **Response Length** — Number of characters in response  
✅ **Estimated Tokens** — Rough token count proxy  
✅ **Model Differences** — Relative performance between models  
✅ **Effort Impact** — Low vs High effort level effects  
✅ **Prompt Complexity** — Simple vs Complex prompt effects  

### How to Use the Results

The data is useful for:
- **Comparing relative performance** between models
- **Measuring impact of effort levels** on response length
- **Analyzing prompt complexity effects**
- **Tracking response time trends**

The data is **not suitable for**:
- **Precise billing/cost estimation** (use actual API metrics for that)
- **Exact token count comparisons** (the ~4 chars/token is approximate)
- **Production token budgeting** (get actual counts from your API provider)

## Alternative: Getting Real Token Counts

To get actual token usage:

1. **Use the Copilot Web Dashboard** — Shows actual token usage in your GitHub settings
2. **Check Your GitHub Enterprise Billing** — Provides exact token consumption
3. **Use Model Provider APIs Directly** — Call OpenAI/Anthropic APIs directly and capture token counts
4. **Check Copilot Logs** — Look in VS Code logs for token usage information

## Running the Tests

```bash
./scripts/run-token-tests.sh
```

The suite will:
1. Run 8 tests (2 models × 2 effort levels × 2 prompt types)
2. Measure response time and length
3. Estimate token counts from character length
4. Generate reports with all measurements
5. Save results to JSON and CSV

## Interpreting Results

```json
{
  "estimatedInputTokens": 350,        // ~1,400 chars / 4
  "estimatedOutputTokens": 450,       // ~1,800 chars / 4
  "responseCharacters": 1800,         // Actual character count
  "responseTime": 2341                // Milliseconds
}
```

**Remember**: These are estimates, not actual token counts!

---

If you need precise token usage, please contact your GitHub representative or check your API provider's usage dashboard.
