import { detectHintsInText } from '../core/scanner/logs';

describe('Scanner - Logs', () => {
  describe('detectHintsInText', () => {
    test('detects known hints in text', () => {
      const hints = new Map<string, boolean>();
      detectHintsInText('user activated agent mode for their project', hints);
      expect(hints.get('agent mode')).toBe(true);
    });

    test('detects multiple hints', () => {
      const hints = new Map<string, boolean>();
      detectHintsInText('used @workspace and @terminal participants with inline chat', hints);
      expect(hints.get('@workspace')).toBe(true);
      expect(hints.get('@terminal')).toBe(true);
      expect(hints.get('inline chat')).toBe(true);
    });

    test('does not detect non-matching text', () => {
      const hints = new Map<string, boolean>();
      detectHintsInText('just a regular log line with nothing special', hints);
      expect(hints.size).toBe(0);
    });

    test('detects file-related hints', () => {
      const hints = new Map<string, boolean>();
      detectHintsInText('found copilot-instructions.md and .copilotignore files', hints);
      expect(hints.get('copilot-instructions.md')).toBe(true);
      expect(hints.get('.copilotignore')).toBe(true);
    });

    test('detects MCP hints', () => {
      const hints = new Map<string, boolean>();
      detectHintsInText('configured mcpservers in mcp.json', hints);
      expect(hints.get('mcpservers')).toBe(true);
      expect(hints.get('mcp')).toBe(true);
    });
  });
});
