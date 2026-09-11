import { PHRASES } from './trash-talk.phrases';
import { PhraseContext, TrashTalkInput, TrashTalkMemory, TrashTalkResult } from './trash-talk.types';

const STORAGE_KEY = 'appingpong:recent-phrases';

export function classifyContext(input: TrashTalkInput, memory?: TrashTalkMemory): PhraseContext {
  const { player1Wins: p1, player2Wins: p2, targetWins: target } = input;
  const max = Math.max(p1, p2);
  const lead = Math.abs(p1 - p2);
  const leader: 1 | 2 | null = p1 === p2 ? null : p1 > p2 ? 1 : 2;
  const ratio = lead / target;
  const progress = max / target;
  const remaining = target - max;
  if (p1 === 0 && p2 === 0) return 'START';
  if (remaining <= 0) return ratio <= .08 ? 'COMPLETED_CLOSE' : 'COMPLETED_DOMINANT';
  if (memory?.previousLeader && leader && memory.previousLeader !== leader) return 'COMEBACK';
  if (p1 === p2) return 'TIED';
  if (remaining === 1) return 'ONE_AWAY';
  if (memory && lead < memory.previousLead && ratio <= .08) return 'ALMOST_TIED';
  if (progress >= .75 && ratio <= .08) return 'LATE_CLOSE';
  if (ratio <= .04) return 'SLIGHT_LEAD';
  if (ratio <= .10) return 'MEDIUM_LEAD';
  if (ratio <= .25) return 'BIG_LEAD';
  return 'DOMINATION';
}

export class TrashTalkEngine {
  constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | null =
    typeof sessionStorage === 'undefined' ? null : sessionStorage) {}

  pick(input: TrashTalkInput, memory?: TrashTalkMemory, random = Math.random): TrashTalkResult {
    const context = classifyContext(input, memory);
    const pool = PHRASES[context];
    const recent = this.recentIds();
    const available = pool.filter(phrase => !recent.includes(phrase.id));
    const candidates = available.length ? available : pool;
    const phrase = candidates[Math.floor(random() * candidates.length)] ?? pool[0];
    this.saveRecent([...recent.filter(id => id !== phrase.id), phrase.id].slice(-12));
    return { id: phrase.id, context, text: this.interpolate(phrase.text, input) };
  }

  private recentIds(): string[] {
    try {
      const value = JSON.parse(this.storage?.getItem(STORAGE_KEY) ?? '[]');
      return Array.isArray(value) ? value.filter(id => typeof id === 'string').slice(-12) : [];
    } catch { return []; }
  }

  private saveRecent(ids: string[]): void {
    try { this.storage?.setItem(STORAGE_KEY, JSON.stringify(ids)); } catch { /* storage optional */ }
  }

  private interpolate(text: string, input: TrashTalkInput): string {
    const p1Leads = input.player1Wins >= input.player2Wins;
    const leader = p1Leads ? input.player1Name : input.player2Name;
    const trailer = p1Leads ? input.player2Name : input.player1Name;
    const leaderScore = Math.max(input.player1Wins, input.player2Wins);
    const trailerScore = Math.min(input.player1Wins, input.player2Wins);
    const values: Record<string, string | number> = {
      leader, trailer, leaderScore, trailerScore, lead: leaderScore - trailerScore,
      target: input.targetWins, remaining: Math.max(0, input.targetWins - leaderScore),
    };
    return text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
  }
}
