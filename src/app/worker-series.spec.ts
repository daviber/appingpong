import { describe, expect, it } from 'vitest';
import { createSeries, StoredSeries, updateSeries } from '../../worker/src/series';

const createdAt = '2026-01-01T00:00:00.000Z';
const firstUpdate = '2026-01-01T00:01:00.000Z';
const secondUpdate = '2026-01-01T00:02:00.000Z';

const legacySeries = (): StoredSeries => ({
  id: 'legacy', player1Name: 'Luca', player2Name: 'Marco', targetWins: 30,
  player1Wins: 12, player2Wins: 9, createdAt, updatedAt: firstUpdate,
});

describe('Worker series mutations', () => {
  it('creates minimal persisted data', () => {
    const created = createSeries({ player1Name: ' Luca ', player2Name: ' Marco ', targetWins: 30 }, createdAt, 'uuid');
    expect(created).toMatchObject({ id: 'uuid', player1Name: 'Luca', player2Name: 'Marco', targetWins: 30, player1Wins: 0, player2Wins: 0 });
    expect(created.scoreHistory).toEqual([{ timestamp: createdAt, player1Wins: 0, player2Wins: 0, kind: 'initial' }]);
  });
  it('allows reopening through downward score correction', () => {
    const completed = createSeries({ player1Name: 'Luca', player2Name: 'Marco', targetWins: 5 }, '2026-01-01T00:00:00.000Z', 'uuid');
    const won = updateSeries(completed, { player1Wins: 5 });
    const reopened = updateSeries(won, { player1Wins: 4 });
    expect(reopened.player1Wins).toBe(4);
  });

  it('appends server timestamps and both scores for increments and downward corrections', () => {
    const created = createSeries({ player1Name: 'Luca', player2Name: 'Marco', targetWins: 30 }, createdAt, 'uuid');
    const p1Scored = updateSeries(created, { player1Wins: 1 }, firstUpdate);
    const p2Scored = updateSeries(p1Scored, { player2Wins: 1 }, secondUpdate);
    const correctedAt = '2026-01-01T00:03:00.000Z';
    const corrected = updateSeries(p2Scored, { player1Wins: 0, player2Wins: 0 }, correctedAt);

    expect(corrected.scoreHistory).toEqual([
      { timestamp: createdAt, player1Wins: 0, player2Wins: 0, kind: 'initial' },
      { timestamp: firstUpdate, player1Wins: 1, player2Wins: 0, kind: 'update' },
      { timestamp: secondUpdate, player1Wins: 1, player2Wins: 1, kind: 'update' },
      { timestamp: correctedAt, player1Wins: 0, player2Wins: 0, kind: 'update' },
    ]);
    expect(corrected.updatedAt).toBe(correctedAt);
    expect(created.scoreHistory).toHaveLength(1);
    expect(p1Scored.scoreHistory).toHaveLength(2);
  });

  it('preserves legacy data and adds an honest baseline on the first score change', () => {
    const legacy = legacySeries();
    const updated = updateSeries(legacy, { player1Wins: 13 }, secondUpdate);

    expect(updated).toMatchObject({ ...legacy, player1Wins: 13, updatedAt: secondUpdate });
    expect(updated.scoreHistory).toEqual([
      { timestamp: firstUpdate, player1Wins: 12, player2Wins: 9, kind: 'baseline' },
      { timestamp: secondUpdate, player1Wins: 13, player2Wins: 9, kind: 'update' },
    ]);
    expect(legacy.scoreHistory).toBeUndefined();
  });

  it('does not create score events for metadata edits or unchanged scores', () => {
    const legacy = legacySeries();
    const renamed = updateSeries(legacy, { player1Name: ' Luigi ', targetWins: 50 }, secondUpdate);
    expect(renamed.player1Name).toBe('Luigi');
    expect(renamed.scoreHistory).toBeUndefined();

    const withHistory = updateSeries(legacy, { player1Wins: 13 }, secondUpdate);
    const unchanged = updateSeries(withHistory, { player1Wins: 13, player2Wins: 9 }, secondUpdate);
    const edited = updateSeries(unchanged, { player2Name: 'Mario', targetWins: 50 }, secondUpdate);
    expect(edited.scoreHistory).toEqual(withHistory.scoreHistory);
    expect(edited.scoreHistory).toHaveLength(2);
  });

  it('keeps scores recorded before reopening and reducing the target', () => {
    const legacy = { ...legacySeries(), player1Wins: 30 };
    const reopened = updateSeries(legacy, { player1Wins: 12 }, secondUpdate);
    const reduced = updateSeries(reopened, { targetWins: 20 }, secondUpdate);

    expect(reduced.scoreHistory).toEqual(reopened.scoreHistory);
    expect(reduced.scoreHistory?.[0].player1Wins).toBe(30);
  });

  it('rejects invalid changes without altering saved history', () => {
    const current = updateSeries(legacySeries(), { player1Wins: 13 }, secondUpdate);
    const before = JSON.stringify(current);
    expect(() => updateSeries(current, { player1Wins: 31 }, secondUpdate)).toThrow(/integer/);
    expect(() => updateSeries(current, { player1Wins: 14, player1Name: '' }, secondUpdate)).toThrow(/characters/);
    expect(JSON.stringify(current)).toBe(before);
  });

  it('prevents clients from replacing or clearing score history', () => {
    const current = legacySeries();
    expect(() => updateSeries(current, { scoreHistory: [] } as never, secondUpdate)).toThrow(/unsupported fields/);
  });
});
