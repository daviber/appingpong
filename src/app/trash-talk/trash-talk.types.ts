export type PhraseContext =
  | 'START' | 'TIED' | 'SLIGHT_LEAD' | 'MEDIUM_LEAD' | 'BIG_LEAD' | 'DOMINATION'
  | 'COMEBACK' | 'ALMOST_TIED' | 'LATE_CLOSE' | 'ONE_AWAY'
  | 'COMPLETED_CLOSE' | 'COMPLETED_DOMINANT';

export interface TrashTalkInput {
  player1Name: string;
  player2Name: string;
  player1Wins: number;
  player2Wins: number;
  targetWins: number;
}

export interface TrashTalkMemory { previousLeader: 1 | 2 | null; previousLead: number; }
export interface TrashTalkResult { id: string; context: PhraseContext; text: string; }
export interface Phrase { id: string; text: string; }
