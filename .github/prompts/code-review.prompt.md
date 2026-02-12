---
mode: ask
description: "Review code for quality, patterns, and potential issues"
---

# Code Review for Copilot Enabler

You are reviewing code in the Copilot Enabler VS Code extension — a TypeScript project targeting ES2022 with strict mode enabled.

## Review Checklist

### Architecture
- [ ] Does new code follow the scanner → agent → analyzer pipeline?
- [ ] Are feature `detectHints` reachable from at least one scanner (`knownHints`, settings keys, workspace files, extension IDs)?
- [ ] Is recommendation deduplication maintained (by `featureID`, not `title`)?

### TypeScript
- [ ] Strict mode compliance — no `any` unless unavoidable
- [ ] `interface` preferred over `type` for object shapes
- [ ] Proper null/undefined handling (no non-null assertions without justification)
- [ ] Functions are `export`ed, not wrapped in unnecessary classes

### Testing
- [ ] New features have detection tests in `adoption.test.ts`
- [ ] Tests use realistic data modeled on actual Copilot log output
- [ ] Both positive AND negative detection cases covered
- [ ] Test counts remain consistent (check catalog size assertions)

### Detection Integrity
- [ ] Every string in a feature's `detectHints` is lowercase-matchable from at least one scanner
- [ ] `knownHints` in `logs.ts` does not contain dead entries (scanned but never matched)
- [ ] No overly broad hints that would cause false positives (e.g., single common words)
- [ ] Shared hints between features are intentional (e.g., `.prompt.md` shared by prompt files and custom agents)

### VS Code Extension
- [ ] Disposables are properly tracked via `context.subscriptions`
- [ ] Webview content is escaped with `escapeHtml()` to prevent XSS
- [ ] Commands are registered in both `package.json` and `extension.ts`

## Output Format

Provide findings as:
- **Critical**: Must fix before merging
- **Warning**: Should fix, impacts correctness or maintainability
- **Suggestion**: Nice to have, improves code quality
