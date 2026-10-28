export const POSITIONS = ["GK", "CB", "FB", "MID", "FWD"] as const;
export type Position = (typeof POSITIONS)[number];

export const POSITION_LABEL: Record<Position, string> = {
  GK: "שוער",
  CB: "בלם",
  FB: "מגן",
  MID: "אמצע",
  FWD: "חלוץ",
};

export const POSITION_EMOJI: Record<Position, string> = {
  GK: "🧤",
  CB: "🧱",
  FB: "🛡️",
  MID: "⚙️",
  FWD: "🎯",
};

export const MIN_RATING = 1;
export const MAX_RATING = 7;
export const DEFAULT_RATING = 4;

export interface Player {
  id: string;
  group_id: string;
  name: string;
  rating: number;
  /** First position is the main one. */
  positions: Position[];
  active: boolean;
  created_at: string;
}

export interface PlayerInput {
  name: string;
  rating: number;
  positions: Position[];
}

export interface Group {
  id: string;
  name: string;
  invite_code: string;
}

export interface SavedTeamPlayer {
  id: string;
  name: string;
  rating: number;
  positions: Position[];
}

export interface SavedTeam {
  name: string;
  color: string;
  total: number;
  players: SavedTeamPlayer[];
}

export interface Game {
  id: string;
  group_id: string;
  played_on: string;
  teams: SavedTeam[];
  created_at: string;
}

export function clampRating(value: number): number {
  const rounded = Math.round(value * 2) / 2;
  return Math.min(MAX_RATING, Math.max(MIN_RATING, rounded));
}

export function formatRating(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
