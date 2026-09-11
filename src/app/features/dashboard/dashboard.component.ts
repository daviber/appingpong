import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { SeriesApiService } from '../../core/api/series-api.service';
import { RuntimeConfigService } from '../../core/config/runtime-config.service';
import { EditableSeries, isCompleted, PingPongSeries, SeriesPatch, validateScores, winnerName } from '../../core/models/series.model';
import { TrashTalkEngine } from '../../trash-talk/trash-talk.engine';
import { TrashTalkMemory } from '../../trash-talk/trash-talk.types';

type Modal = 'create' | 'correct' | 'edit' | 'delete' | null;

@Component({
  selector: 'app-dashboard',
  imports: [FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  readonly Math = Math;
  private readonly api = inject(SeriesApiService);
  readonly config = inject(RuntimeConfigService);
  private readonly trashEngine = new TrashTalkEngine();
  private readonly memories = new Map<string, TrashTalkMemory>();

  readonly series = signal<PingPongSeries[]>([]);
  readonly selectedSeriesId = signal<string | null>(null);
  readonly loading = signal(true);
  readonly notice = signal<string | null>(null);
  readonly modal = signal<Modal>(null);
  readonly saving = signal(false);
  readonly busyScore = signal<1 | 2 | null>(null);
  readonly trashText = signal('Il tavolo aspetta il primo punto.');
  readonly targetMode = signal<30 | 50 | 'custom'>(30);

  readonly sortedSeries = computed(() => [...this.series()].sort((a, b) => {
    const completionOrder = Number(isCompleted(a)) - Number(isCompleted(b));
    return completionOrder || b.updatedAt.localeCompare(a.updatedAt);
  }));
  readonly selectedSeries = computed(() =>
    this.series().find(series => series.id === this.selectedSeriesId()) ?? null);

  createDraft = { player1Name: '', player2Name: '', customTarget: 10 };
  scoreDraft = { player1Wins: 0, player2Wins: 0 };
  editDraft = { player1Name: '', player2Name: '', targetWins: 30 };

  ngOnInit(): void {
    if (this.config.error()) { this.loading.set(false); return; }
    this.loadSeries();
  }

  select(series: PingPongSeries): void {
    this.selectedSeriesId.set(series.id);
    this.refreshPhrase(series);
  }

  openCreate(): void {
    this.createDraft = { player1Name: '', player2Name: '', customTarget: 10 };
    this.targetMode.set(30);
    this.modal.set('create');
  }

  create(): void {
    const targetMode = this.targetMode();
    const targetWins = targetMode === 'custom' ? Number(this.createDraft.customTarget) : targetMode;
    const input: EditableSeries = {
      player1Name: this.createDraft.player1Name.trim(),
      player2Name: this.createDraft.player2Name.trim(),
      targetWins,
    };
    if (!input.player1Name || !input.player2Name) return this.showError('Inserisci entrambi i nomi.');
    const validation = validateScores(0, 0, targetWins);
    if (validation) return this.showError(validation);
    this.saving.set(true);
    this.api.create(input).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: created => {
        this.series.update(items => [created, ...items]);
        this.selectedSeriesId.set(created.id);
        this.modal.set(null);
        this.refreshPhrase(created);
      },
      error: error => this.fail('Impossibile creare la serie.', error),
    });
  }

  changeWin(player: 1 | 2, delta: -1 | 1): void {
    const current = this.selectedSeries();
    if (!current || this.busyScore()) return;
    if (delta > 0 && isCompleted(current)) return;
    const currentScore = player === 1 ? current.player1Wins : current.player2Wins;
    if (delta < 0 && currentScore === 0) return;
    const previous = { ...current };
    const patch: SeriesPatch = player === 1
      ? { player1Wins: current.player1Wins + delta }
      : { player2Wins: current.player2Wins + delta };
    const optimistic = { ...current, ...patch, updatedAt: new Date().toISOString() };
    this.replaceSeries(optimistic);
    this.busyScore.set(player);
    this.api.update(current.id, patch).pipe(finalize(() => this.busyScore.set(null))).subscribe({
      next: updated => { this.remember(previous); this.replaceSeries(updated); this.refreshPhrase(updated); },
      error: error => { this.replaceSeries(previous); this.fail('Punteggio non aggiornato. Valore precedente ripristinato.', error); },
    });
  }

  openCorrection(): void {
    const current = this.selectedSeries();
    if (!current) return;
    this.scoreDraft = { player1Wins: current.player1Wins, player2Wins: current.player2Wins };
    this.modal.set('correct');
  }

  saveCorrection(): void {
    const current = this.selectedSeries();
    if (!current) return;
    const p1 = Number(this.scoreDraft.player1Wins);
    const p2 = Number(this.scoreDraft.player2Wins);
    const validation = validateScores(p1, p2, current.targetWins);
    if (validation) return this.showError(validation);
    this.savePatch(current, { player1Wins: p1, player2Wins: p2 }, 'Punteggio corretto.');
  }

  openEdit(): void {
    const current = this.selectedSeries();
    if (!current) return;
    this.editDraft = { player1Name: current.player1Name, player2Name: current.player2Name, targetWins: current.targetWins };
    this.modal.set('edit');
  }

  saveEdit(): void {
    const current = this.selectedSeries();
    if (!current) return;
    const patch = {
      player1Name: this.editDraft.player1Name.trim(),
      player2Name: this.editDraft.player2Name.trim(),
      targetWins: Number(this.editDraft.targetWins),
    };
    if (!patch.player1Name || !patch.player2Name) return this.showError('Inserisci entrambi i nomi.');
    const validation = validateScores(current.player1Wins, current.player2Wins, patch.targetWins);
    if (validation) return this.showError(validation);
    this.savePatch(current, patch, 'Serie aggiornata.');
  }

  askDelete(series: PingPongSeries, event?: Event): void {
    event?.stopPropagation();
    this.selectedSeriesId.set(series.id);
    this.modal.set('delete');
  }

  deleteSelected(): void {
    const current = this.selectedSeries();
    if (!current) return;
    this.saving.set(true);
    this.api.delete(current.id).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        const remaining = this.series().filter(item => item.id !== current.id);
        this.series.set(remaining);
        this.modal.set(null);
        const next = this.sortItems(remaining)[0] ?? null;
        this.selectedSeriesId.set(next?.id ?? null);
        if (next) this.refreshPhrase(next);
      },
      error: error => this.fail('Impossibile eliminare la serie.', error),
    });
  }

  closeModal(): void { if (!this.saving()) this.modal.set(null); }
  completed(series: PingPongSeries): boolean { return isCompleted(series); }
  winner(series: PingPongSeries): string | null { return winnerName(series); }
  progress(score: number, target: number): number { return Math.min(100, (score / target) * 100); }
  updatedLabel(value: string): string {
    const updated = new Date(value);
    if (Number.isNaN(updated.getTime())) return 'Data non disponibile';
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const updatedDay = new Date(updated.getFullYear(), updated.getMonth(), updated.getDate()).getTime();
    const time = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' }).format(updated);
    if (updatedDay === today) return `Oggi, ${time}`;
    if (updatedDay === today - 86_400_000) return `Ieri, ${time}`;
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }).format(updated);
  }
  ballPosition(series: PingPongSeries): number {
    const relativeLead = (series.player2Wins - series.player1Wins) / series.targetWins;
    return Math.max(12, Math.min(88, 50 + relativeLead * 76));
  }

  private loadSeries(): void {
    this.loading.set(true);
    this.api.list().pipe(finalize(() => this.loading.set(false))).subscribe({
      next: items => {
        this.series.set(items);
        const first = this.sortItems(items)[0] ?? null;
        this.selectedSeriesId.set(first?.id ?? null);
        if (first) this.refreshPhrase(first);
      },
      error: error => this.fail('Worker non raggiungibile. Controlla la connessione e riprova.', error),
    });
  }

  private savePatch(current: PingPongSeries, patch: SeriesPatch, success: string): void {
    this.saving.set(true);
    this.api.update(current.id, patch).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: updated => {
        this.remember(current);
        this.replaceSeries(updated);
        this.modal.set(null);
        this.refreshPhrase(updated);
        this.showNotice(success);
      },
      error: error => this.fail('Impossibile aggiornare la serie.', error),
    });
  }

  private replaceSeries(updated: PingPongSeries): void {
    this.series.update(items => items.map(item => item.id === updated.id ? updated : item));
  }

  private refreshPhrase(series: PingPongSeries): void {
    this.trashText.set(this.trashEngine.pick(series, this.memories.get(series.id)).text);
  }

  private remember(series: PingPongSeries): void {
    this.memories.set(series.id, {
      previousLeader: series.player1Wins === series.player2Wins ? null : series.player1Wins > series.player2Wins ? 1 : 2,
      previousLead: Math.abs(series.player1Wins - series.player2Wins),
    });
  }

  private sortItems(items: PingPongSeries[]): PingPongSeries[] {
    return [...items].sort((a, b) => Number(isCompleted(a)) - Number(isCompleted(b)) || b.updatedAt.localeCompare(a.updatedAt));
  }

  private fail(message: string, error: unknown): void { console.error(message, error); this.showError(message); }
  private showError(message: string): void { this.notice.set(message); window.setTimeout(() => this.notice.set(null), 5000); }
  private showNotice(message: string): void { this.notice.set(message); window.setTimeout(() => this.notice.set(null), 3000); }
}
