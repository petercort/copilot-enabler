import { computeStability, hashBlock } from '../core/promptimizer/diff';
import { IngestedSession } from '../core/promptimizer/types';

function sess(): IngestedSession {
  return {
    session_id: 's',
    turns: [
      { session_id: 's', turn: 0, blocks: [
        { id: 'sys', category: 'system', text: 'stable text' },
        { id: 'msg', category: 'user_message', text: 'first' },
      ] },
      { session_id: 's', turn: 1, blocks: [
        { id: 'sys', category: 'system', text: 'stable text' },
        { id: 'msg', category: 'user_message', text: 'second' },
      ] },
      { session_id: 's', turn: 2, blocks: [
        { id: 'sys', category: 'system', text: 'stable text' },
        { id: 'msg', category: 'user_message', text: 'third' },
      ] },
    ],
  };
}

describe('Promptimizer - diff/stability', () => {
  test('marks persistent blocks as stable on subsequent turns', () => {
    const s = sess();
    computeStability([s]);
    expect(s.turns[0].blocks[0].stable).toBe(false);
    expect(s.turns[1].blocks[0].stable).toBe(true);
    expect(s.turns[2].blocks[0].stable).toBe(true);
    // churning block is never stable
    expect(s.turns[1].blocks[1].stable).toBe(false);
    expect(s.turns[2].blocks[1].stable).toBe(false);
  });

  test('mutation invalidates stability on the mutated turn', () => {
    const s = sess();
    s.turns[2].blocks[0].text = 'CHANGED';
    computeStability([s]);
    expect(s.turns[1].blocks[0].stable).toBe(true);
    expect(s.turns[2].blocks[0].stable).toBe(false);
  });

  test('hashBlock ignores CRLF / surrounding whitespace', () => {
    expect(hashBlock({ id: 'x', category: 'system', text: 'a\r\nb' }))
      .toBe(hashBlock({ id: 'x', category: 'system', text: '  a\nb  ' }));
  });
});
