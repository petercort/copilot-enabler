# 🎯 Token Usage Testing Suite — Bash Version

Complete automated testing framework for measuring token utilization across different LLM models and effort levels.

## What Was Created

Three pure Bash scripts to:

✅ **Measure token consumption** for Claude Sonnet 4.6 and GPT-5.4  
✅ **Compare effort levels** (Low vs High) to see impact on token usage  
✅ **Test prompt complexity** (Simple vs Complex with file references)  
✅ **Capture detailed metrics** including input/output tokens, response time  
✅ **Analyze trends** across multiple test runs  
✅ **Export results** as JSON or CSV for further analysis  

## 📁 Files Created

| File | Purpose | Type |
|------|---------|------|
| `scripts/token-usage-test.sh` | Main testing script (Bash) | 14 KB, 500+ lines |
| `scripts/analyze-token-results.sh` | Results analyzer (Bash) | 9 KB, 300+ lines |
| `scripts/run-token-tests.sh` | Test runner wrapper (Bash) | 1 KB |
| `scripts/TOKEN_TESTING_BASH.md` | Documentation | Markdown |
| `QUICKSTART_TOKEN_TESTS.md` | Quick start guide | Markdown |

## 🚀 Quick Start

### Run Tests (Pick One)

```bash
# Easiest — includes validation
./scripts/run-token-tests.sh

# Or run directly
./scripts/token-usage-test.sh

# Or analyze results
./scripts/analyze-token-results.sh
```

### Expected Output

```
🚀 Starting Copilot Token Usage Test Suite
📦 Repository: /path/to/copilot-enabler-vscode
📁 Output: /path/to/token-test-results/test-2024-04-13_09-45-30
🔧 Models: claude-sonnet-4.6, gpt-5.4
💪 Effort Levels: low, high
📝 Prompt Types: simple, complex

[1/8] Testing Claude Sonnet 4.6 (low) - simple prompt
   ✅ Input: 350, Output: 412, Time: 2341ms

[2/8] Testing Claude Sonnet 4.6 (low) - complex prompt
   ✅ Input: 2357, Output: 1514, Time: 3245ms

...

════════════════════════════════════════════════════════════════════════════════
📈 TOKEN USAGE TEST RESULTS
════════════════════════════════════════════════════════════════════════════════

📅 Session: 2024-04-13_09-45-30
📁 Results: /path/to/token-test-results/test-2024-04-13_09-45-30

✅ Successful: 8/8

📦 TOKEN USAGE BY MODEL:
...
```

## 📊 Test Coverage

### Test Matrix
- **2 Models**: Claude Sonnet 4.6, GPT-5.4
- **2 Effort Levels**: Low, High
- **2 Prompt Types**: Simple, Complex
- **Total Tests**: 8

### Prompts

**Simple Prompt** (~89 tokens):
```
"Please explain what this VS Code extension does and what its key functionality is. Be concise."
```

**Complex Prompt** (~2,357 tokens):
```
"I need you to analyze this GitHub Copilot extension codebase and explain what it does.

Key files to reference:
- src/extension.ts (entry point)
- src/core/analyzer.ts (analysis orchestration)
- src/core/featureCatalog.ts (feature tracking)
- src/core/agents/ (agent implementations)
- src/views/ (UI components and webviews)
- package.json (contributes, commands, configuration)

Please provide:
1. A high-level overview of what the extension does
2. The key functionality it provides...
3. What data sources it analyzes...
4. The main commands available to users
5. How the three agents contribute to analysis

Be detailed but organized."
```

## 📈 Output & Results

### Files Generated (per test run)

```
token-test-results/test-2024-04-13_09-45-30/
├── report.json              # Aggregated statistics
├── all-results.json         # Detailed test data
├── test-config.json         # Test configuration
└── results.csv              # CSV export (optional)
```

### Metrics Captured

**Per Test:**
- Input tokens
- Output tokens
- Total tokens
- Response time (ms)
- Model & effort level
- Prompt type
- Success/failure status

**Aggregated:**
- Totals by model
- Averages by model
- Totals by effort level
- Averages by effort level
- Totals by prompt type
- Averages by prompt type
- Test counts & success rates

## 🔍 Analyzing Results

### View Latest Run
```bash
./scripts/analyze-token-results.sh
```

Shows:
- Total tests and success count
- Token usage by model
- Token usage by effort level
- Token usage by prompt type

### Compare Multiple Runs
```bash
./scripts/analyze-token-results.sh --compare
```

Shows:
- Model comparison across last 3 runs
- Trend analysis (up/down/stable)
- Token usage changes with percentages

### Export to CSV
```bash
./scripts/analyze-token-results.sh --csv
```

Creates `results.csv` with:
- One row per test
- Columns: Test #, Model, Effort, Prompt Type, Prompt Length, Input Tokens, Output Tokens, Total Tokens, Response Time, Success
- Ready for Excel/Google Sheets

## 🛠️ How It Works

### Bash Features Used
- Pure Bash (no external dependencies except `jq`)
- `jq` for JSON processing
- `copilot` CLI invocation
- Color-coded output
- Timestamp generation
- Result aggregation
- CSV generation

### Execution Flow

1. **Setup**
   - Validate Copilot CLI is available
   - Create output directory with timestamp
   - Initialize result files

2. **Test Loop** (8 iterations)
   - For each model/effort/prompt combination:
     - Build prompt text
     - Invoke: `copilot explain <prompt> --model <model> --effort <effort> --json`
     - Parse JSON response
     - Extract token counts
     - Record timing and status
     - 500ms delay between requests

3. **Aggregation**
   - Calculate totals and averages by model
   - Calculate totals and averages by effort level
   - Calculate totals and averages by prompt type
   - Compute success rates

4. **Output**
   - Save JSON reports
   - Display console summary with colors
   - Optionally export to CSV

### Performance

- **Expected runtime**: 2-3 minutes for 8 tests
- **API calls**: 8 total (one per test)
- **Network overhead**: Included in response time

## 📋 Key Commands

```bash
# Run tests
./scripts/run-token-tests.sh                  # With validation
./scripts/token-usage-test.sh                 # Direct run

# Analyze results
./scripts/analyze-token-results.sh            # Latest results
./scripts/analyze-token-results.sh --compare  # Compare runs
./scripts/analyze-token-results.sh --csv      # Export CSV
./scripts/analyze-token-results.sh --help     # Show help

# Manual analysis with jq
jq '.tokenUsageByModel' token-test-results/test-*/report.json
jq '.tokenUsageByEffort' token-test-results/test-*/report.json
jq '.[] | select(.success == false)' token-test-results/test-*/all-results.json
```

## 🔧 Customization

### Add/Remove Models
Edit `token-usage-test.sh`:
```bash
MODELS=("claude-sonnet-4.6:Claude Sonnet 4.6" "gpt-5.4:GPT-5.4")
```

### Change Effort Levels
```bash
EFFORTS=("low" "high" "maximum")
```

### Modify Prompts
Edit the `SIMPLE_PROMPT` and `COMPLEX_PROMPT` variables.

### Adjust Delays
Change the sleep duration:
```bash
sleep 0.5  # seconds between requests
```

## ❓ FAQ

**Q: What if Copilot CLI fails?**  
A: Check `copilot --version`. Ensure you're logged in and have network access.

**Q: Can I modify the prompts?**  
A: Yes! Edit `SIMPLE_PROMPT` and `COMPLEX_PROMPT` in `token-usage-test.sh`.

**Q: How do I compare across multiple runs?**  
A: Use `./scripts/analyze-token-results.sh --compare` — it auto-detects all runs.

**Q: What's the cost implication?**  
A: Token counts help estimate API costs. Check your LLM provider's pricing per 1M tokens.

**Q: Can I use this in CI/CD?**  
A: Yes! Add to GitHub Actions or other CI pipelines. Scripts exit with proper codes.

**Q: What does jq requirement?**  
A: jq parses JSON. It's usually pre-installed on macOS/Linux. Install with: `brew install jq` or `apt-get install jq`.

## 📚 Documentation

- **Quick Start**: `QUICKSTART_TOKEN_TESTS.md`
- **Full Docs**: `scripts/TOKEN_TESTING_BASH.md`
- **Script Comments**: See inline comments in bash files

## 🎯 Recommended Next Steps

1. **Run baseline tests**
   ```bash
   ./scripts/run-token-tests.sh
   ```

2. **Review results**
   ```bash
   ./scripts/analyze-token-results.sh
   ```

3. **Export for analysis**
   ```bash
   ./scripts/analyze-token-results.sh --csv
   ```

4. **Track over time**
   - Run regularly (weekly/monthly)
   - Compare with `--compare` flag
   - Build trend data

5. **Optimize based on findings**
   - Refine prompts to reduce tokens
   - Compare models for cost/performance
   - Choose effort levels strategically

## 💡 Examples

### Run 3 times and compare
```bash
for i in 1 2 3; do
  echo "Test run $i..."
  ./scripts/run-token-tests.sh
  sleep 120
done

./scripts/analyze-token-results.sh --compare
```

### Create baseline before changes
```bash
mkdir -p token-baselines
cp -r token-test-results/test-* token-baselines/baseline-v1/

# Make your changes...

./scripts/run-token-tests.sh
./scripts/analyze-token-results.sh --compare
```

### Quick stats with jq
```bash
# Get all model totals
jq '.tokenUsageByModel | to_entries[] | "\(.key): \(.value.totalTokens)"' report.json

# Filter by effort
jq '.tokenUsageByEffort.high' report.json

# Find slowest test
jq 'max_by(.responseTime)' all-results.json
```

## ✅ What's Included

- ✅ 3 executable Bash scripts
- ✅ Color-coded console output
- ✅ JSON report generation
- ✅ CSV export capability
- ✅ Trend analysis across runs
- ✅ Comprehensive documentation
- ✅ Error handling and validation
- ✅ No external dependencies (except jq)

## 📞 Support

- Check documentation files for detailed info
- Review script comments for implementation details
- Analyze JSON outputs for raw test data
- Run scripts with `--help` for usage info

---

**Version**: 1.0 (Bash Edition)  
**Created**: April 2024  
**Author**: Copilot Token Testing Suite  

Ready to test! 🚀
