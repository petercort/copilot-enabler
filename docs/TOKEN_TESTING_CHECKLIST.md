# ✅ Token Testing Suite — Setup Checklist

## What Was Created

A **pure Bash** automated testing framework to measure token utilization across LLM models with the Copilot CLI.

## Verify Installation

```bash
# 1. Check scripts exist
ls -lh scripts/token-usage-test.sh scripts/analyze-token-results.sh scripts/run-token-tests.sh

# 2. Check documentation exists
ls -lh QUICKSTART_TOKEN_TESTS.md TOKEN_TESTING_README.md TOKEN_TESTING_BASH_SUMMARY.md

# 3. Verify scripts are executable
file scripts/*.sh | grep executable
```

## Prerequisites Check

```bash
# ✅ Copilot CLI
copilot --version

# ✅ jq (JSON processor)
jq --version

# ✅ Bash 4+
bash --version
```

## First Test Run

```bash
# 1. Make scripts executable (if needed)
chmod +x scripts/*.sh

# 2. Run tests
./scripts/run-token-tests.sh

# 3. View results
./scripts/analyze-token-results.sh

# 4. Export to CSV
./scripts/analyze-token-results.sh --csv
```

## Files Summary

### Root Directory (7 files)

```
📄 README.md                      # Original extension README
📄 QUICKSTART_TOKEN_TESTS.md      # Quick start guide (👈 START HERE)
📄 TOKEN_TESTING_README.md        # Complete overview
📄 TOKEN_TESTING_BASH_SUMMARY.md  # Detailed guide with examples
```

### scripts/ Directory (6 files)

```
🔧 token-usage-test.sh             # Main test runner (15 KB)
🔧 analyze-token-results.sh        # Results analyzer (9.2 KB)
🔧 run-token-tests.sh              # Wrapper script (967 B)
📄 TOKEN_TESTING_BASH.md           # Technical reference
📄 TOKEN_TESTING.md                # Legacy documentation
```

## Test Coverage

- **8 tests per run** (all combinations)
- **2 models** (Claude Sonnet 4.6, GPT-5.4)
- **2 effort levels** (Low, High)
- **2 prompt types** (Simple, Complex)

## Key Commands

```bash
# Run tests
./scripts/run-token-tests.sh

# View latest results
./scripts/analyze-token-results.sh

# Compare multiple runs
./scripts/analyze-token-results.sh --compare

# Export to CSV
./scripts/analyze-token-results.sh --csv

# Get help
./scripts/analyze-token-results.sh --help
```

## Output Location

```
token-test-results/
└── test-{TIMESTAMP}/
    ├── report.json          # Aggregated stats
    ├── all-results.json     # Detailed data
    ├── test-config.json     # Configuration
    └── results.csv          # CSV export
```

## Customization

Edit `scripts/token-usage-test.sh`:

```bash
# Change models
MODELS=("claude-sonnet-4.6:Claude Sonnet 4.6" "gpt-5.4:GPT-5.4")

# Change effort levels
EFFORTS=("low" "high")

# Modify prompts
SIMPLE_PROMPT="Your custom prompt"
COMPLEX_PROMPT="Your detailed prompt"
```

## Documentation Roadmap

1. **Quick Start** (5 min)
   → `QUICKSTART_TOKEN_TESTS.md`

2. **Overview** (10 min)
   → `TOKEN_TESTING_README.md`

3. **Full Details** (15 min)
   → `TOKEN_TESTING_BASH_SUMMARY.md`

4. **Technical Reference**
   → `scripts/TOKEN_TESTING_BASH.md`

## What You Get

✅ Automated token measurement  
✅ Multi-model comparison  
✅ Effort level analysis  
✅ Prompt complexity testing  
✅ Trend tracking  
✅ CSV export  
✅ Color-coded output  
✅ Comprehensive documentation  

## Next Steps

1. ✅ Read `QUICKSTART_TOKEN_TESTS.md`
2. ✅ Run `./scripts/run-token-tests.sh`
3. ✅ View results with `./scripts/analyze-token-results.sh`
4. ✅ Export to CSV with `--csv` flag
5. ✅ Compare runs with `--compare` flag

---

Everything is ready to go! 🚀
