import {
  ruleBoilerplate,
  ruleToolResultBloat,
  runGeneralRules,
} from '../core/promptimizer/recommend/general';
import { IngestedSession } from '../core/promptimizer/types';

// Build a session with duplicate boilerplate across user messages.
function boilerplateSession(): IngestedSession {
  const boiler = 'REMINDER: ' + 'please always respond in JSON following the schema. '.repeat(60);
  return {
    session_id: 's1',
    model: 'claude-sonnet-4.6',
    turns: [0, 1, 2].map((i) => ({
      session_id: 's1',
      turn: i,
      blocks: [
        {
          id: `u-${i}`,
          category: 'user_message',
          text: `${boiler}\n\nActual question ${i}: do the thing.`,
          tokens: 420,
        },
      ],
    })),
  };
}

// Build a session with an oversized tool result.
function bloatedToolResultSession(): IngestedSession {
  return {
    session_id: 's2',
    model: 'claude-sonnet-4.6',
    turns: [
      {
        session_id: 's2',
        turn: 0,
        blocks: [
          { id: 'u0', category: 'user_message', text: 'read the file', tokens: 10 },
          {
            id: 'tr0',
            category: 'tool_result',
            text: 'x'.repeat(20000),
            tokens: 5000,
            name: 'view',
          },
        ],
      },
      {
        session_id: 's2',
        turn: 1,
        blocks: [{ id: 'u1', category: 'user_message', text: 'now what?', tokens: 10 }],
      },
    ],
  };
}

describe('Promptimizer general rules', () => {
  test('R-BP1 fires when the same paragraph repeats across user messages', () => {
    const s = boilerplateSession();
    const finding = ruleBoilerplate(s, 'claude-sonnet-4.6');
    expect(finding).toBeDefined();
    expect(finding!.rule).toBe('R-BP1');
    expect(finding!.category).toBe('authoring');
    expect(finding!.evidence.tokens).toBeGreaterThanOrEqual(300);
    expect((finding!.evidence as { occurrences?: number }).occurrences).toBe(3);
    expect(finding!.estimated_savings.usd_per_100_turns).toBeGreaterThan(0);
  });

  test('R-BP1 does not fire for single-turn sessions', () => {
    const s: IngestedSession = {
      session_id: 'solo',
      turns: [
        { session_id: 'solo', turn: 0, blocks: [{ id: 'u', category: 'user_message', text: 'hi', tokens: 2 }] },
      ],
    };
    expect(ruleBoilerplate(s, 'claude-sonnet-4.6')).toBeUndefined();
  });

  test('R-TR1 fires when a single tool_result exceeds 3000 tokens', () => {
    const s = bloatedToolResultSession();
    const finding = ruleToolResultBloat(s, 'claude-sonnet-4.6');
    expect(finding).toBeDefined();
    expect(finding!.rule).toBe('R-TR1');
    expect(finding!.category).toBe('hygiene');
    expect((finding!.evidence as { count?: number }).count).toBe(1);
    expect(finding!.estimated_savings.tokens_per_turn).toBeGreaterThan(0);
  });

  test('runGeneralRules aggregates across sessions', () => {
    const findings = runGeneralRules([boilerplateSession(), bloatedToolResultSession()], 'claude-sonnet-4.6');
    const rules = findings.map((f) => f.rule).sort();
    expect(rules).toEqual(['R-BP1', 'R-TR1']);
  });
});
