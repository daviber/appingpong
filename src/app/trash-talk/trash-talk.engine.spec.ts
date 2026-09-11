import { describe, expect, it } from 'vitest';
import { PHRASE_COUNT } from './trash-talk.phrases';
import { classifyContext, TrashTalkEngine } from './trash-talk.engine';
import { TrashTalkInput } from './trash-talk.types';

const input = (player1Wins: number, player2Wins: number, targetWins = 50): TrashTalkInput => ({
  player1Name: 'Luca', player2Name: 'Marco', player1Wins, player2Wins, targetWins,
});

describe('trash talk engine', () => {
  it('contains at least 300 phrases', () => expect(PHRASE_COUNT).toBeGreaterThanOrEqual(300));
  it('classifies relative score contexts', () => {
    expect(classifyContext(input(0, 0))).toBe('START');
    expect(classifyContext(input(24, 23))).toBe('SLIGHT_LEAD');
    expect(classifyContext(input(32, 20))).toBe('BIG_LEAD');
    expect(classifyContext(input(46, 44))).toBe('LATE_CLOSE');
    expect(classifyContext(input(49, 31))).toBe('ONE_AWAY');
    expect(classifyContext(input(50, 49))).toBe('COMPLETED_CLOSE');
    expect(classifyContext(input(50, 21))).toBe('COMPLETED_DOMINANT');
  });
  it('does not repeat recent phrase ids', () => {
    let value: string | null = null;
    const storage = { getItem: () => value, setItem: (_: string, next: string) => { value = next; } };
    const engine = new TrashTalkEngine(storage);
    const ids = Array.from({ length: 13 }, () => engine.pick(input(0, 0), undefined, () => 0).id);
    expect(new Set(ids.slice(0, 12)).size).toBe(12);
    expect(ids[12]).not.toBe(ids[11]);
  });
});
