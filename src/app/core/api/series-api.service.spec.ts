import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RuntimeConfigService } from '../config/runtime-config.service';
import { PingPongSeries, ScoreHistoryEntry } from '../models/series.model';
import { SeriesApiService } from './series-api.service';

const url = 'http://localhost:8787/api/series';
const legacy: PingPongSeries = {
  id: 'legacy', player1Name: 'Luca', player2Name: 'Marco', targetWins: 30,
  player1Wins: 12, player2Wins: 9,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:01:00.000Z',
};
const baseline: ScoreHistoryEntry = {
  timestamp: legacy.updatedAt, player1Wins: 12, player2Wins: 9, kind: 'baseline',
};

describe('Series API history compatibility', () => {
  let api: SeriesApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        { provide: RuntimeConfigService, useValue: { apiBaseUrl: 'http://localhost:8787' } },
      ],
    });
    api = TestBed.inject(SeriesApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads legacy series alongside series with history', () => {
    const items = [legacy, { ...legacy, id: 'new', scoreHistory: [baseline] }];
    let received: PingPongSeries[] | undefined;
    api.list().subscribe(series => received = series);
    http.expectOne(url).flush({ series: items });
    expect(received).toEqual(items);
  });

  it('keeps server history after a score update without sending history in the request', () => {
    const updated: PingPongSeries = {
      ...legacy, player1Wins: 13, updatedAt: '2026-01-01T00:02:00.000Z',
      scoreHistory: [baseline, { timestamp: '2026-01-01T00:02:00.000Z', player1Wins: 13, player2Wins: 9, kind: 'update' }],
    };
    let received: PingPongSeries | undefined;
    api.update(legacy.id, { player1Wins: 13 }).subscribe(series => received = series);
    const request = http.expectOne(`${url}/${legacy.id}`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ player1Wins: 13 });
    request.flush({ series: updated });
    expect(received).toEqual(updated);
  });

  it('accepts historical scores above a target reduced later', () => {
    const updated = { ...legacy, targetWins: 20, scoreHistory: [{ ...baseline, player1Wins: 30 }] };
    let received: PingPongSeries | undefined;
    api.update(legacy.id, { targetWins: 20 }).subscribe(series => received = series);
    http.expectOne(`${url}/${legacy.id}`).flush({ series: updated });
    expect(received).toEqual(updated);
  });

  it.each([
    { scoreHistory: null },
    { scoreHistory: {} },
    { scoreHistory: [null] },
    { scoreHistory: [{ ...baseline, timestamp: 'invalid' }] },
    { scoreHistory: [{ ...baseline, player1Wins: -1 }] },
    { scoreHistory: [{ ...baseline, player2Wins: 1.5 }] },
    { scoreHistory: [{ ...baseline, kind: 'unknown' }] },
  ])('rejects malformed history: $scoreHistory', ({ scoreHistory }) => {
    let receivedError: Error | undefined;
    api.list().subscribe({ error: error => receivedError = error });
    http.expectOne(url).flush({ series: [{ ...legacy, scoreHistory }] });
    expect(receivedError?.message).toBe('Risposta API non valida');
  });
});
