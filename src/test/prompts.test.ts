import { implementableFeatures, canImplement, systemPrompts } from '../core/prompts';

describe('Prompts', () => {
  test('has system prompts for implementable features', () => {
    expect(Object.keys(systemPrompts).length).toBeGreaterThan(0);
  });

  test('implementableFeatures returns a set of feature IDs', () => {
    const features = implementableFeatures();
    expect(features.size).toBeGreaterThan(0);
    expect(features.has('custom-instructions-file')).toBe(true);
    expect(features.has('skill-mcp-servers')).toBe(true);
  });

  test('canImplement returns true for known features', () => {
    expect(canImplement('custom-instructions-file')).toBe(true);
    expect(canImplement('custom-copilotignore')).toBe(true);
  });

  test('canImplement returns false for unknown features', () => {
    expect(canImplement('mode-ask')).toBe(false);
    expect(canImplement('nonexistent')).toBe(false);
  });

  test('all prompt values are non-empty strings', () => {
    for (const [key, prompt] of Object.entries(systemPrompts)) {
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(50);
    }
  });
});
