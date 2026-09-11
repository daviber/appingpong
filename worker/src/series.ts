export interface StoredSeries {
  id: string;
  player1Name: string;
  player2Name: string;
  targetWins: number;
  player1Wins: number;
  player2Wins: number;
  createdAt: string;
  updatedAt: string;
}

export type SeriesInput = Partial<Pick<StoredSeries, 'player1Name' | 'player2Name' | 'targetWins' | 'player1Wins' | 'player2Wins'>>;

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}

function name(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 40) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} must contain between 1 and 40 characters`);
  }
  return value.trim();
}

function integer(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${field} must be an integer between ${min} and ${max}`);
  }
  return Number(value);
}

export function createSeries(input: SeriesInput, now = new Date().toISOString(), id: string = crypto.randomUUID()): StoredSeries {
  const targetWins = integer(input.targetWins, 'targetWins', 1, 200);
  return {
    id,
    player1Name: name(input.player1Name, 'player1Name'),
    player2Name: name(input.player2Name, 'player2Name'),
    targetWins,
    player1Wins: 0,
    player2Wins: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function updateSeries(current: StoredSeries, patch: SeriesInput, now = new Date().toISOString()): StoredSeries {
  const allowed = new Set(['player1Name', 'player2Name', 'targetWins', 'player1Wins', 'player2Wins']);
  if (!Object.keys(patch).length || Object.keys(patch).some(key => !allowed.has(key))) {
    throw new ApiError(400, 'BAD_REQUEST', 'Request contains no editable fields or unsupported fields');
  }
  const targetWins = patch.targetWins === undefined ? current.targetWins : integer(patch.targetWins, 'targetWins', 1, 200);
  const player1Wins = patch.player1Wins === undefined ? current.player1Wins : integer(patch.player1Wins, 'player1Wins', 0, targetWins);
  const player2Wins = patch.player2Wins === undefined ? current.player2Wins : integer(patch.player2Wins, 'player2Wins', 0, targetWins);
  if (targetWins < Math.max(player1Wins, player2Wins)) throw new ApiError(400, 'VALIDATION_ERROR', 'targetWins cannot be lower than current score');
  const wasCompleted = current.player1Wins >= current.targetWins || current.player2Wins >= current.targetWins;
  if (wasCompleted && (player1Wins > current.player1Wins || player2Wins > current.player2Wins)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'A completed series can only be corrected downwards');
  }
  return {
    ...current,
    player1Name: patch.player1Name === undefined ? current.player1Name : name(patch.player1Name, 'player1Name'),
    player2Name: patch.player2Name === undefined ? current.player2Name : name(patch.player2Name, 'player2Name'),
    targetWins,
    player1Wins,
    player2Wins,
    updatedAt: now,
  };
}
