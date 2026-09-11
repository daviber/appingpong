import { describe, expect, it } from 'vitest';
import { createSeries, updateSeries } from '../../worker/src/series';

describe('Worker series mutations', () => {
  it('creates minimal persisted data', () => {
    const created = createSeries({ player1Name: ' Luca ', player2Name: ' Marco ', targetWins: 30 }, '2026-01-01T00:00:00.000Z', 'uuid');
    expect(created).toMatchObject({ id: 'uuid', player1Name: 'Luca', player2Name: 'Marco', targetWins: 30, player1Wins: 0, player2Wins: 0 });
  });
  it('allows reopening through downward score correction', () => {
    const completed = createSeries({ player1Name: 'Luca', player2Name: 'Marco', targetWins: 5 }, '2026-01-01T00:00:00.000Z', 'uuid');
    const won = updateSeries(completed, { player1Wins: 5 });
    const reopened = updateSeries(won, { player1Wins: 4 });
    expect(reopened.player1Wins).toBe(4);
  });
});
