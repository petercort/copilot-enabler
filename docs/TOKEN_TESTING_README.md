# 🎯 Token Testing Suite — What Was Created

## Summary

A complete **pure Bash** automated testing framework for measuring token utilization across different LLM models and effort levels using the GitHub Copilot CLI.

## 📁 Files Created

### Scripts (3 files, ~25 KB total)

| File | Size | Purpose |
|------|------|---------|
| `scripts/token-usage-test.sh` | 15 KB | Main test runner — executes all combinations, captures tokens, generates reports |
| `scripts/analyze-token-results.sh` | 9.2 KB | Results analyzer — views, compares, and exports test runs |
| `scripts/run-token-tests.sh` | 967 B | Wrapper — validates environment and runs tests |

### Documentation (4 files)

| File | Purpose |
|------|---------|
| `QUICKSTART_TOKEN_TESTS.md` | 5-minute quick start guide |
| `TOKEN_TESTING_BASH_SUMMARY.md` | Comprehensive summary with examples |
| `scripts/TOKEN_TESTING_BASH.md` | Full technical documentation |
| `scripts/TOKEN_TESTING.md` | Legacy docs (can be ignored) |

## 🚀 Quick Start

```bash
# Run tests
./scripts/run-token-tests.sh

# View results
./scripts/analyze-token-results.sh

# Compare across runs
./scripts/analyze-token-results.sh --compare

# Export to CSV
./scripts/analyze-token-results.sh --csv
```

## 📊 What It Tests

### Test Matrix (8 tests total)
- **Models**: Claude Sonnet 4.6, GPT-5.4
- **Effort Levels**: Low, High
- **Prompt Types**: Simple (~89 tokens), Complex (~2,357 tokens)

### Example Test Sequence
```
[1/8] Testing Claude Sonnet 4.6 (low) - simple prompt     ✅
[2/8] Testing Claude Sonnet 4.6 (low) - complex prompt    ✅
[3/8] Testing Claude Sonnet 4.6 (high) - simple prompt    ✅
[4/8] Testing Claude Sonnet 4.6 (high) - complex prompt   ✅
[5/8] Testing GPT-5.4 (low) - simple prompt              ✅
[6/8] Testing GPT-5.4 (low) - complex prompt             ✅
[7/8] Testing GPT-5.4 (high) - simple prompt             ✅
[8/8] Testing GPT-5.4 (high) - complex prompt            ✅
```

## 📈 Output

### Files Generated Per Test Run
```
token-test-results/test-2024-04-13_09-45-30/
├── report.json              # Aggregated statistics
├── all-results.json         # Detailed per-test data
├── test-config.json         # Test configuration
└── results.csv              # CSV export (optional)
```

### Metrics Captured
- **Input tokens** — Tokens consumed
- **Output tokens** — Tokens generated
- **Total tokens** — Sum
- **Response time** — milliseconds
- **Model & effort** — Test parameters
- **Prompt type** — Simple or Complex
- **Success status** — Pass/fail

### Report Structure
```json
{
  "summary": {
    "totalTests": 8,
    "successfulTests": 8,
    "failedTests": 0
  },
  "tokenUsageByModel": {
    "Claude Sonnet 4.6": {
      "averageInput": 1245,
      "averageOutput": 892,
      "totalTokens": 8548,
      "testCount": 4
    },
    "GPT-5.4": { ... }
  },
  "tokenUsageByEffort": {
    "low": { ... },
    "high": { ... }
  },
  "tokenUsageByPrompt": {
    "simple": { ... },
    "complex": { ... }
  }
}
```

## 🔧 How It Works

### Technology Stack
- **Language**: Pure Bash (no external dependencies except jq)
- **JSON**: Processed with jq
- **CLI**: Invokes copilot command with --json flag
- **Output**: Colored console + JSON reports + CSV exports

### Workflow
1. **Setup** — Validates Copilot CLI, creates output directory
2. **Test Loop** — Runs 8 tests with 500ms delays
3. **Capture** — Extracts token counts from JSON response
4. **Aggregate** — Calculates totals and averages
5. **Report** — Displays summary and saves files

### Performance
- Expected runtime: 2-3 minutes
- API calls: 8 total
- Network-only overhead

## 💡 Key Features

✅ **Pure Bash** — No Node.js or Python required  
✅ **Simple to Run** — Just one command  
✅ **Comprehensive Output** — JSON + CSV  
✅ **Compare Runs** — Track changes over time  
✅ **Colorized Display** — Easy to read console output  
✅ **Well Documented** — Multiple markdown guides  
✅ **Customizable** — Edit prompts and models  
✅ **Robust Error Handling** — Validates environment  

## 📚 Documentation

### For Quick Start
→ **`QUICKSTART_TOKEN_TESTS.md`** — 5-minute guide to get running

### For Detailed Info
→ **`TOKEN_TESTING_BASH_SUMMARY.md`** — Complete overview with examples
→ **`scripts/TOKEN_TESTING_BASH.md`** — Technical reference

### Inside the Code
→ Script comments explain each section

## 🎯 Use Cases

### 1. Baseline Measurement
```bash
./scripts/run-token-tests.sh
# Creates baseline token metrics
```

### 2. Model Comparison
```bash
./scripts/analyze-token-results.sh
# Shows which model uses fewer tokens
```

### 3. Effort Level Impact
```bash
jq '.tokenUsageByEffort' token-test-results/test-*/report.json
# Compares low vs high effort token usage
```

### 4. Prompt Complexity Analysis
```bash
jq '.tokenUsageByPrompt' token-test-results/test-*/report.json
# Measures simple vs complex prompt overhead
```

### 5. Trend Tracking
```bash
./scripts/analyze-token-results.sh --compare
# Monitors changes across multiple runs
```

## 🔄 Workflow Example

### Run 1: Baseline
```bash
./scripts/run-token-tests.sh
# Results: token-test-results/test-2024-04-13_09-45-30/
```

### Modify Prompts
```bash
# Edit scripts/token-usage-test.sh
# Update SIMPLE_PROMPT and COMPLEX_PROMPT
```

### Run 2: Optimized
```bash
./scripts/run-token-tests.sh
# Results: token-test-results/test-2024-04-13_10-30-45/
```

### Compare
```bash
./scripts/analyze-token-results.sh --compare
# Shows token usage improvement/regression
```

## ⚙️ Customization

### Add a Model
```bash
# In token-usage-test.sh
MODELS=(
  "claude-sonnet-4.6:Claude Sonnet 4.6"
  "gpt-5.4:GPT-5.4"
  "claude-opus-4.5:Claude Opus 4.5"  # Add this
)
```

### Change Effort Levels
```bash
EFFORTS=("low" "high" "maximum")
```

### Modify Prompts
```bash
SIMPLE_PROMPT="Your custom simple prompt"
COMPLEX_PROMPT="Your custom complex prompt"
```

### Adjust Delays
```bash
sleep 1  # Change from 0.5 seconds
```

## ❓ FAQ

**Q: Do I need Node.js or Python?**
A: No! Pure Bash only. Just need `copilot` CLI and `jq`.

**Q: How long do tests take?**
A: 2-3 minutes for 8 tests (includes network time).

**Q: Can I customize the prompts?**
A: Yes! Edit `SIMPLE_PROMPT` and `COMPLEX_PROMPT` in token-usage-test.sh.

**Q: How do I compare models?**
A: Run `./scripts/analyze-token-results.sh` to see token usage by model.

**Q: Can I export results?**
A: Yes! Use `./scripts/analyze-token-results.sh --csv` for spreadsheet import.

**Q: What if Copilot CLI fails?**
A: Check `copilot --version` and ensure you're logged in with network access.

**Q: Can I run this in CI/CD?**
A: Yes! Scripts have proper exit codes and error handling.

## 📊 Example Output

```
════════════════════════════════════════════════════════════════════════════════
📈 TOKEN USAGE TEST RESULTS
════════════════════════════════════════════════════════════════════════════════

📅 Session: 2024-04-13_09-45-30
📁 Results: /path/to/token-test-results/test-2024-04-13_09-45-30

✅ Successful: 8/8

📦 TOKEN USAGE BY MODEL:

  Claude Sonnet 4.6
    • Avg Input:  1245 tokens
    • Avg Output: 892 tokens
    • Total:      8548 tokens (4 tests)

  GPT-5.4
    • Avg Input:  1201 tokens
    • Avg Output: 1034 tokens
    • Total:      8940 tokens (4 tests)

💪 TOKEN USAGE BY EFFORT LEVEL:

  LOW
    • Avg Input:  1150 tokens
    • Avg Output: 623 tokens
    • Total:      7052 tokens (4 tests)

  HIGH
    • Avg Input:  1296 tokens
    • Avg Output: 1303 tokens
    • Total:      10396 tokens (4 tests)

📝 TOKEN USAGE BY PROMPT TYPE:

  SIMPLE
    • Avg Input:  89 tokens
    • Avg Output: 412 tokens
    • Total:      2004 tokens (4 tests)

  COMPLEX
    • Avg Input:  2357 tokens
    • Avg Output: 1514 tokens
    • Total:      15484 tokens (4 tests)
```

## 🎓 What You Can Learn

- Which model is more token-efficient
- How effort level impacts token usage
- Cost implications of prompt complexity
- Trend analysis over multiple test runs
- Real-world token consumption patterns

## ✅ Prerequisites Checklist

- [ ] GitHub Copilot CLI installed (`copilot --version`)
- [ ] jq installed (`jq --version`)
- [ ] Bash 4+ available (`bash --version`)
- [ ] Network access to Copilot API
- [ ] Read/write access to repo directory

## 🚀 Next Steps

1. **Run Tests**
   ```bash
   ./scripts/run-token-tests.sh
   ```

2. **View Results**
   ```bash
   ./scripts/analyze-token-results.sh
   ```

3. **Export Data**
   ```bash
   ./scripts/analyze-token-results.sh --csv
   ```

4. **Track Over Time**
   ```bash
   ./scripts/analyze-token-results.sh --compare
   ```

## 📞 Support & Resources

- **Quick Start**: Read `QUICKSTART_TOKEN_TESTS.md`
- **Full Docs**: See `TOKEN_TESTING_BASH_SUMMARY.md`
- **Technical**: Check `scripts/TOKEN_TESTING_BASH.md`
- **Code Comments**: Review script source files
- **Help**: Run `./scripts/analyze-token-results.sh --help`

---

**Version**: 1.0 (Pure Bash Edition)  
**Created**: April 2024  
**Technology**: Bash, jq, Copilot CLI  

Ready to measure tokens! 🎉
