# Feature System Design

## Overview

The Copilot Enabler feature system has been redesigned to use a **self-registering pattern** where each feature is defined in its own file. This makes adding new Copilot features a single-file operation with automatic propagation to the matrix, dashboard, tree view, report, and recommendations.

## Problem Statement

Previously, adding a new feature required touching 4+ files:
- `src/core/featureCatalog.ts` — add Feature object to ~500-line array
- `src/core/prompts.ts` — optionally add system prompt  
- `src/test/featureCatalog.test.ts` — update hardcoded count
- Agent files (optional) — custom detection logic

This made the contribution workflow cumbersome and error-prone.

## Solution

**One file = one feature.** A `FeatureDefinition` type bundles metadata + prompt + detection logic. Features live in `src/core/features/*.ts`, collected by a registry barrel.

### Architecture

```
src/core/features/
├── definition.ts          # FeatureDefinition interface
├── registry.ts           # Barrel that collects all features
├── _template.ts          # Template for new features
├── mode-ask.ts          # Individual feature files...
├── mode-edit.ts
├── mode-agent.ts
└── ...                  # (25 total feature files)

scripts/
└── new-feature.js       # CLI generator

src/core/
├── featureCatalog.ts    # Re-exports from registry
└── prompts.ts           # Derives from feature definitions
```

### Key Components

#### FeatureDefinition Interface

Located in `src/core/features/definition.ts`, this interface extends the base `Feature` interface to include optional system prompts:

```typescript
export interface FeatureDefinition extends Feature {
  /** Optional system prompt for interactive Copilot implementation sessions */
  systemPrompt?: string;
}
```

#### Feature Files

Each feature is defined in its own TypeScript file (e.g., `mode-ask.ts`):

```typescript
import { defineFeature } from './definition';

export const modeAsk = defineFeature({
  id: 'mode-ask',
  name: 'Ask Mode',
  category: 'Modes',
  description: '...',
  docsURL: '...',
  detectHints: ['ask mode', 'askMode', 'mode:ask'],
  tags: ['core'],
  impact: 'low',
  difficulty: 'low',
  setupSteps: ['...'],
  // systemPrompt: '...' (optional)
});
```

#### Registry

The `registry.ts` file imports all feature definitions and exports them as an array:

```typescript
import { modeAsk } from './mode-ask';
import { modeEdit } from './mode-edit';
// ... more imports

export const allFeatureDefinitions: FeatureDefinition[] = [
  modeAsk,
  modeEdit,
  // ... all features
];
```

#### Generator Script

The `scripts/new-feature.js` script provides an interactive CLI for creating new features:

```bash
npm run new-feature
```

This script:
1. Prompts for feature details (ID, name, category, etc.)
2. Generates a new feature file in `src/core/features/`
3. Updates `registry.ts` to import and register the new feature
4. Provides next steps for the contributor

### Backward Compatibility

The existing `featureCatalog.ts` file has been updated to re-export from the registry, maintaining full backward compatibility:

```typescript
import { getFeatureDefinitions } from './features/registry';

export function catalog(): Feature[] {
  return getFeatureDefinitions();
}
```

Similarly, `prompts.ts` now derives its `systemPrompts` object from feature definitions:

```typescript
export const systemPrompts: Record<string, string> = {};

for (const feature of getFeatureDefinitions()) {
  if (feature.systemPrompt) {
    systemPrompts[feature.id] = feature.systemPrompt;
  }
}
```

### Testing

Tests have been updated to be dynamic rather than hardcoded:

**Before:**
```typescript
expect(features.length).toBe(25);
```

**After:**
```typescript
expect(features.length).toBeGreaterThan(0);
```

This allows the test suite to automatically adapt as features are added or removed.

## Contributor Workflow

Adding a new feature is now a simple process:

1. Run the generator:
   ```bash
   npm run new-feature
   ```

2. Answer the prompts (ID, name, category, description, etc.)

3. Review and edit the generated file if needed

4. Run tests:
   ```bash
   npm test
   ```

5. Commit your changes

## Benefits

### For Contributors
- **Single-file operation**: Add a feature by creating one file
- **Guided workflow**: Interactive generator ensures all fields are filled
- **No merge conflicts**: Individual files reduce conflict likelihood
- **Type safety**: `defineFeature` helper provides compile-time validation

### For Maintainers
- **Easier code reviews**: Changes are localized to single files
- **Better organization**: Features are organized by file rather than in a monolithic array
- **Self-documenting**: Each feature file is self-contained
- **Scalability**: Can easily support hundreds of features

### For the Codebase
- **Reduced coupling**: Feature definitions are decoupled from consumers
- **Automatic propagation**: Changes automatically flow to all consumers
- **Consistency**: Template ensures uniform structure
- **Flexibility**: Easy to add new fields to `FeatureDefinition` interface

## Migration Summary

All 25 existing features have been migrated to individual files:

**Modes** (3 features):
- mode-ask.ts
- mode-edit.ts
- mode-agent.ts

**Chat** (7 features):
- chat-panel.ts
- chat-inline.ts
- chat-quick.ts
- setting-model-selection.ts
- chat-participant-workspace.ts
- chat-participant-terminal.ts
- chat-participant-vscode.ts

**Completion** (3 features):
- completion-inline.ts
- completion-nes.ts
- completion-multiline.ts

**Customization** (8 features):
- custom-instructions-file.ts
- custom-copilotignore.ts
- custom-language-enable.ts
- custom-mode-instructions.ts
- custom-prompt-files.ts
- custom-agent-skills.ts
- custom-agents.ts
- skill-mcp-servers.ts

**Context** (4 features):
- context-file.ts
- context-selection.ts
- context-codebase.ts
- context-problems.ts

## Future Enhancements

Potential future improvements to the feature system:

1. **Enhanced Detection**: Add custom `detect()` functions to feature definitions for more sophisticated detection logic beyond simple keyword matching.

2. **Per-Feature Tests**: Generate test files alongside feature files to ensure comprehensive coverage.

3. **Version Filtering**: Add a `since` field to indicate minimum VS Code version requirements.

4. **Feature Dependencies**: Track dependencies between features (e.g., "requires chat-panel").

5. **Auto-Documentation**: Generate feature catalog documentation from definitions.

6. **Validation**: Add runtime validation to ensure feature definitions are complete and valid.

## Open Questions

1. **Per-feature vs. per-category files**: Should very related features be grouped in category files, or maintain strict one-file-per-feature?
   - **Decision**: Maintain one-file-per-feature for consistency and simplicity.

2. **Detection context**: Should `detect()` take full `AnalysisContext` or a lighter type?
   - **Decision**: Deferred to Phase 4 (optional enhancement).

3. **Version filtering**: Add `since` field for VS Code version filtering?
   - **Decision**: Not needed for current use case, can add later if needed.

## Conclusion

The feature system redesign successfully achieves the goal of making feature additions a single-file operation. The new system is more maintainable, scalable, and contributor-friendly while maintaining full backward compatibility with existing code.
