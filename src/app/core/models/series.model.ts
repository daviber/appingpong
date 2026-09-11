export interface PingPongSeries {
  id: string;
  player1Name: string;
  player2Name: string;
  targetWins: number;
  player1Wins: number;
  player2Wins: number;
  createdAt: string;
  updatedAt: string;
}

export type EditableSeries = Pick<PingPongSeries, 'player1Name' | 'player2Name' | 'targetWins'>;
export type SeriesPatch = Partial<Pick<PingPongSeries, 'player1Name' | 'player2Name' | 'targetWins' | 'player1Wins' | 'player2Wins'>>;

export const isCompleted = (series: PingPongSeries): boolean =>
  series.player1Wins >= series.targetWins || series.player2Wins >= series.targetWins;

export const winnerName = (series: PingPongSeries): string | null => {
  if (!isCompleted(series)) return null;
  return series.player1Wins >= series.targetWins ? series.player1Name : series.player2Name;
};

export function validateScores(player1Wins: number, player2Wins: number, targetWins: number): string | null {
  if (!Number.isInteger(targetWins) || targetWins < 1 || targetWins > 200) return 'Il target deve essere tra 1 e 200.';
  if (![player1Wins, player2Wins].every(Number.isInteger)) return 'I punteggi devono essere numeri interi.';
  if (player1Wins < 0 || player2Wins < 0) return 'I punteggi non possono essere negativi.';
  if (player1Wins > targetWins || player2Wins > targetWins) return 'I punteggi non possono superare il target.';
  return null;
}
