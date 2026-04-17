# Quick Start: Token Usage Testing (Bash)

## What You've Got

Three pure Bash scripts to measure token utilization across different LLM models and effort levels.

### Files Created
- **`scripts/token-usage-test.sh`** — Main test script
- **`scripts/analyze-token-results.sh`** — Results analyzer
- **`scripts/run-token-tests.sh`** — Test runner wrapper
- **`scripts/TOKEN_TESTING_BASH.md`** — Full documentation
- **`TOKEN_TESTING_BASH_SUMMARY.md`** — Detailed summary

## Prerequisites

1. **GitHub Copilot CLI** — Required
   ```bash
   copilot --version
   ```

2. **jq** — JSON processor
   ```bash
   jq --version
   # If missing: brew install jq (macOS) or apt-get install jq (Linux)
   ```

3. **Bash 4+** — Usually pre-installed
   ```bash
   bash --version
   ```

## Run Tests

### Option 1: Test Runner (Easiest)
```bash
./scripts/run-token-tests.sh
```

### Option 2: Direct Test
```bash
./scripts/token-usage-test.sh
```

## What Gets Tested

**8 tests** covering all combinations:
- **Models**: Claude Sonnet 4.6, GPT-5.4
- **Effort**: Low, High
- **Prompts**: Simple, Complex

### Prompts

**Simple** (89 tokens):
> "Please explain what this VS Code extension does and what its key functionality is. Be concise."

**Complex** (2,357 tokens):
> Detailed prompt with file references to src/extension.ts, src/core/analyzer.ts, src/core/featureCatalog.ts, src/core/agents/, src/views/, package.json

## View Results

### Latest Run
```bash
./scripts/analyze-token-results.sh
```

### Compare Runs
```bash
./scripts/analyze-token-results.sh --compare
```

### Export to CSV
```bash
./scripts/analyze-token-results.sh --csv
```

## Output Location

```
token-test-results/test-2024-04-13_09-45-30/
├── report.json              # Summary stats
├── all-results.json         # Detailed test data
├── test-config.json         # Test configuration
└── results.csv              # Spreadsheet export
```

## Key Metrics Captured

Each test records:
- Input tokens — Tokens consumed by prompt + context
- Output tokens — Tokens generated in response
- Total tokens — Sum of input + output
- Response time — Time to complete (milliseconds)
- Model name — Which LLM was used
- Effort level — Low or High
- Prompt type — Simple or Complex
- Success status — Pass/fail indicator

## Expected Run Time

- ~2-3 minutes for all 8 tests
- Each test makes an API call
- Includes 500ms delay between requests

## Customization

Edit `scripts/token-usage-test.sh`:

```bash
# Add/remove models
MODELS=("claude-sonnet-4.6:Claude Sonnet 4.6" "gpt-5.4:GPT-5.4")

# Change effort levels
EFFORTS=("low" "high")

# Modify prompts
SIMPLE_PROMPT="Your custom prompt"
COMPLEX_PROMPT="Your detailed prompt"
```

## Troubleshooting

**"Copilot CLI not found"**
```bash
which copilot
# Install: https://github.com/github/copilot-cli
```

**"jq not found"**
```bash
brew install jq  # macOS
apt-get install jq  # Ubuntu/Debian
```

## Next Steps

1. Run tests: `./scripts/run-token-tests.sh`
2. Review results: `./scripts/analyze-token-results.sh`
3. Export to CSV: `./scripts/analyze-token-results.sh --csv`
4. Compare over time: `./scripts/analyze-token-results.sh --compare`

---

Happy testing! 🎉
