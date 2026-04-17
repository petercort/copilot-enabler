# 🎯 Token Testing Suite — Index & Guide

## What You Have

A **complete pure Bash** automated testing framework for measuring token utilization across different LLM models and effort levels using the Copilot CLI.

## Start Here

👉 **Read first:** `QUICKSTART_TOKEN_TESTS.md` (5 minutes)

Then run:
```bash
./scripts/run-token-tests.sh
```

## 📚 Documentation

### For Different Needs

| Document | Time | Purpose |
|----------|------|---------|
| `QUICKSTART_TOKEN_TESTS.md` | 5 min | Get started quickly |
| `TOKEN_TESTING_README.md` | 10 min | Complete overview |
| `TOKEN_TESTING_BASH_SUMMARY.md` | 15 min | Deep dive with examples |
| `TOKEN_TESTING_CHECKLIST.md` | 2 min | Setup verification |
| `scripts/TOKEN_TESTING_BASH.md` | Reference | Technical details |

## 🔧 Scripts

```bash
# Main test runner
./scripts/run-token-tests.sh

# View latest results
./scripts/analyze-token-results.sh

# Compare multiple runs
./scripts/analyze-token-results.sh --compare

# Export to CSV
./scripts/analyze-token-results.sh --csv
```

## 📊 What It Tests

- **8 tests per run** (all combinations)
- **2 models**: Claude Sonnet 4.6, GPT-5.4
- **2 effort levels**: Low, High
- **2 prompts**: Simple (~89 tokens), Complex (~2,357 tokens)

## 📈 Output

Results saved to: `token-test-results/test-{TIMESTAMP}/`

- `report.json` — Aggregated statistics
- `all-results.json` — Detailed test data
- `test-config.json` — Configuration
- `results.csv` — Spreadsheet export

## 💡 Key Features

✅ Pure Bash (no Node/Python)  
✅ Only needs jq (usually pre-installed)  
✅ Color-coded output  
✅ JSON + CSV exports  
✅ Trend analysis  
✅ Customizable  
✅ Well documented  
✅ 2-3 minute runtime  

## 🚀 First Run

```bash
# 1. Make scripts executable
chmod +x scripts/*.sh

# 2. Run tests (choose one)
./scripts/run-token-tests.sh      # Easy wrapper
./scripts/token-usage-test.sh     # Direct script

# 3. View results
./scripts/analyze-token-results.sh

# 4. Export to CSV
./scripts/analyze-token-results.sh --csv

# 5. Compare future runs
./scripts/analyze-token-results.sh --compare
```

## 📁 File Structure

```
Root:
  QUICKSTART_TOKEN_TESTS.md         ← Start here!
  TOKEN_TESTING_README.md
  TOKEN_TESTING_BASH_SUMMARY.md
  TOKEN_TESTING_CHECKLIST.md

scripts/:
  token-usage-test.sh               ← Main script
  analyze-token-results.sh          ← Analyzer
  run-token-tests.sh                ← Wrapper
  TOKEN_TESTING_BASH.md             ← Technical ref
```

## ⚡ Common Commands

```bash
# Run everything
./scripts/run-token-tests.sh

# Analyze latest
./scripts/analyze-token-results.sh

# See trends
./scripts/analyze-token-results.sh --compare

# Spreadsheet export
./scripts/analyze-token-results.sh --csv

# Manual jq analysis
jq '.tokenUsageByModel' token-test-results/test-*/report.json
```

## 🎯 Next Steps

1. ✅ Read `QUICKSTART_TOKEN_TESTS.md`
2. ✅ Run `./scripts/run-token-tests.sh`
3. ✅ Review `./scripts/analyze-token-results.sh` output
4. ✅ Export with `--csv` flag
5. ✅ Track trends over time

---

**Everything ready! Start with QUICKSTART_TOKEN_TESTS.md** 🚀
