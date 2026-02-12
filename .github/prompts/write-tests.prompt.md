---
mode: agent
tools: ["read_file", "create_file", "run_in_terminal"]
description: "Generate Jest tests following the project's adoption.test.ts patterns"
---

# Write Tests for Copilot Enabler

You are writing Jest tests for the Copilot Enabler VS Code extension.

## Test Setup

- Framework: Jest with `ts-jest` preset
- Test location: `src/test/*.test.ts`
- VS Code is mocked: `jest.mock('vscode', () => ({ ... }), { virtual: true })`
- Run with: `npx jest --no-coverage`

## Test Patterns to Follow

### Helper functions
```typescript
function logEntry(message: string): LogEntry { ... }
function hintsFrom(keys: string[]): Map<string, boolean> { ... }
function buildContext(opts: { logHints?, settingsHints?, ... }): AnalysisContext { ... }
function byId(id: string): Feature { ... }
```

### Detection tests (per feature)
```typescript
test('feature-id: detects "hint" in log text', () => {
  const hints = new Map<string, boolean>();
  detectHintsInText('realistic log line containing hint', hints);
  expect(hints.get('hint')).toBe(true);
  const feature = byId('feature-id');
  expect(featureDetected(feature, hints)).toBe(true);
});
```

### Scanner source tests
Group by source: `Log-based detection`, `Settings-based detection`, `Workspace-based detection`, `Extension-based detection`.

### Agent tests
```typescript
const ctx = buildContext({ logHints: hintsFrom(['...']) });
const agent = new SomeAgent();
const report = agent.analyze(ctx);
expect(report.featuresUsed.map(f => f.id)).toContain('feature-id');
```

## Rules

1. Always read the source file before writing tests for it.
2. Use realistic data — model test inputs on actual Copilot log output and VS Code settings.
3. Test both positive detection AND negative cases (no false positives).
4. After writing tests, run `npx jest --no-coverage` and fix any failures.
5. Never mock internal modules — only mock `vscode`.
