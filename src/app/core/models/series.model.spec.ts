import { describe, expect, it } from 'vitest';
import { getScoreHistory, isCompleted, PingPongSeries, validateScores } from './series.model';

const series = (player1Wins: number, player2Wins: number, targetWins = 30): PingPongSeries => ({
  id: '1', player1Name: 'Luca', player2Name: 'Marco', targetWins, player1Wins, player2Wins,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
});

describe('series model', () => {
  it('derives completion from either score', () => {
    expect(isCompleted(series(29, 20))).toBe(false);
    expect(isCompleted(series(30, 20))).toBe(true);
    expect(isCompleted(series(12, 30))).toBe(true);
  });

  it('validates score bounds and integers', () => {
    expect(validateScores(4, 3, 5)).toBeNull();
    expect(validateScores(-1, 3, 5)).toMatch(/negativi/);
    expect(validateScores(6, 3, 5)).toMatch(/superare/);
    expect(validateScores(1.5, 1, 5)).toMatch(/interi/);
  });

  it('shows the saved score of legacy series without changing their data', () => {
    const legacy = series(12, 9);
    expect(getScoreHistory(legacy)).toEqual([{
      timestamp: legacy.updatedAt, player1Wins: 12, player2Wins: 9, kind: 'baseline',
    }]);
    expect(legacy.scoreHistory).toBeUndefined();
  });

  it('keeps existing history in chronological order', () => {
    const current: PingPongSeries = {
      ...series(1, 0),
      scoreHistory: [
        { timestamp: '2026-01-01T00:00:00.000Z', player1Wins: 0, player2Wins: 0, kind: 'initial' },
        { timestamp: '2026-01-01T00:01:00.000Z', player1Wins: 1, player2Wins: 0, kind: 'update' },
      ],
    };
    expect(getScoreHistory(current)).toEqual(current.scoreHistory);
  });
});
