import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { EditableSeries, PingPongSeries, SeriesPatch } from '../models/series.model';
import { RuntimeConfigService } from '../config/runtime-config.service';

function validSeries(value: unknown): value is PingPongSeries {
  if (!value || typeof value !== 'object') return false;
  const s = value as Record<string, unknown>;
  return typeof s['id'] === 'string' && typeof s['player1Name'] === 'string' &&
    typeof s['player2Name'] === 'string' && typeof s['targetWins'] === 'number' && Number.isInteger(s['targetWins']) &&
    typeof s['player1Wins'] === 'number' && Number.isInteger(s['player1Wins']) &&
    typeof s['player2Wins'] === 'number' && Number.isInteger(s['player2Wins']) &&
    typeof s['createdAt'] === 'string' && typeof s['updatedAt'] === 'string';
}

@Injectable({ providedIn: 'root' })
export class SeriesApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);
  private get url(): string { return `${this.config.apiBaseUrl}/api/series`; }

  list(): Observable<PingPongSeries[]> {
    return this.http.get<{ series: unknown }>(this.url).pipe(map(({ series }) => {
      if (!Array.isArray(series) || !series.every(validSeries)) throw new Error('Risposta API non valida');
      return series;
    }));
  }

  create(input: EditableSeries): Observable<PingPongSeries> {
    return this.http.post<{ series: unknown }>(this.url, input).pipe(map(({ series }) => {
      if (!validSeries(series)) throw new Error('Risposta API non valida');
      return series;
    }));
  }

  update(id: string, patch: SeriesPatch): Observable<PingPongSeries> {
    return this.http.patch<{ series: unknown }>(`${this.url}/${encodeURIComponent(id)}`, patch).pipe(map(({ series }) => {
      if (!validSeries(series)) throw new Error('Risposta API non valida');
      return series;
    }));
  }

  delete(id: string): Observable<void> { return this.http.delete<void>(`${this.url}/${encodeURIComponent(id)}`); }
}
