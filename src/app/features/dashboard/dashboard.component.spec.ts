import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SeriesApiService } from '../../core/api/series-api.service';
import { RuntimeConfigService } from '../../core/config/runtime-config.service';
import { getScoreHistory, PingPongSeries } from '../../core/models/series.model';
import { DashboardComponent } from './dashboard.component';

const legacy: PingPongSeries = {
  id: 'legacy', player1Name: 'Luca', player2Name: 'Marco', targetWins: 30,
  player1Wins: 12, player2Wins: 9,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:01:00.000Z',
};

describe('Dashboard score history', () => {
  let component: DashboardComponent;
  let response: Subject<PingPongSeries>;
  let update: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    response = new Subject<PingPongSeries>();
    update = vi.fn().mockReturnValue(response);
    TestBed.configureTestingModule({
      providers: [
        { provide: SeriesApiService, useValue: { update } },
        { provide: RuntimeConfigService, useValue: {} },
      ],
    });
    component = TestBed.runInInjectionContext(() => new DashboardComponent());
    component.series.set([legacy]);
    component.selectedSeriesId.set(legacy.id);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('keeps history confirmed during optimistic updates and then displays server history newest first', () => {
    const baseline = getScoreHistory(legacy);
    component.changeWin(1, 1);
    expect(component.selectedSeries()?.player1Wins).toBe(13);
    expect(component.scoreHistory()).toEqual(baseline);
    expect(update).toHaveBeenCalledWith(legacy.id, { player1Wins: 13 });

    const updated: PingPongSeries = {
      ...legacy, player1Wins: 13, updatedAt: '2026-01-01T00:02:00.000Z',
      scoreHistory: [...baseline, {
        timestamp: '2026-01-01T00:02:00.000Z', player1Wins: 13, player2Wins: 9, kind: 'update',
      }],
    };
    response.next(updated);
    response.complete();
    expect(component.scoreHistory()).toEqual([...updated.scoreHistory!].reverse());
    expect(updated.scoreHistory?.[0].kind).toBe('baseline');
    expect(component.partialHistory()).toBe(true);
    expect(component.busyScore()).toBeNull();
  });

  it('restores legacy data and history when a score update fails', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const baseline = component.scoreHistory();
    component.changeWin(2, -1);
    expect(component.selectedSeries()?.player2Wins).toBe(8);
    response.error(new Error('Network unavailable'));

    expect(component.selectedSeries()).toEqual(legacy);
    expect(component.selectedSeries()?.scoreHistory).toBeUndefined();
    expect(component.scoreHistory()).toEqual(baseline);
    expect(component.notice()).toMatch(/ripristinato/);
    expect(component.busyScore()).toBeNull();
  });
});
