import { HeuristicTokenizer, tokenizeBlocks, createTokenizer } from '../core/promptimizer/tokenize';
import { Block } from '../core/promptimizer/types';

describe('Promptimizer - tokenize', () => {
  test('heuristic is chars/4 rounded up and deterministic', () => {
    const t = new HeuristicTokenizer();
    expect(t.countBlock({ id: 'a', category: 'system', text: '' })).toBe(0);
    expect(t.countBlock({ id: 'a', category: 'system', text: 'abcd' })).toBe(1);
    expect(t.countBlock({ id: 'a', category: 'system', text: 'abcde' })).toBe(2);
    expect(t.countBlock({ id: 'a', category: 'system', text: 'abcd' }))
      .toBe(t.countBlock({ id: 'a', category: 'system', text: 'abcd' }));
  });

  test('tokenizeBlocks tokenizes per-block, not concatenated', () => {
    const t = new HeuristicTokenizer();
    const blocks: Block[] = [
      { id: 'a', category: 'system', text: 'abcd' },      // 1 token
      { id: 'b', category: 'user_message', text: 'abc' }, // 1 token (ceil(3/4))
    ];
    tokenizeBlocks(blocks, t);
    expect(blocks[0].tokens).toBe(1);
    expect(blocks[1].tokens).toBe(1);
    // If tokenized as concatenation "abcdabc" = 7 chars = 2 tokens; per-block is 1+1=2 either way.
    // Use longer to disambiguate:
    const b2: Block[] = [
      { id: 'a', category: 'system', text: 'xx' },   // ceil(2/4)=1
      { id: 'b', category: 'user_message', text: 'yy' }, // ceil(2/4)=1
    ];
    tokenizeBlocks(b2, t);
    const perBlockSum = (b2[0].tokens ?? 0) + (b2[1].tokens ?? 0);
    const concat = Math.ceil(('xx' + 'yy').length / 4);
    expect(perBlockSum).toBe(2);
    expect(concat).toBe(1); // concat tokenization would yield 1 — proves per-block is used
  });

  test('createTokenizer resolves known ids and throws on unknown', () => {
    expect(createTokenizer('heuristic').id).toBe('heuristic');
    expect(() => createTokenizer('nope')).toThrow(/Unknown tokenizer/);
  });
});
