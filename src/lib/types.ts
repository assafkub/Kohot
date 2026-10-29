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

/** "admin" is the super admin, who manages every group. */
export type GroupRole = "admin" | "manager" | "player";

export interface Group {
  id: string;
  name: string;
  /** Only managers get the join code. */
  invite_code: string | null;
  role: GroupRole;
}

export function canManage(group: Group | null): boolean {
  return group?.role === "admin" || group?.role === "manager";
}

export interface Member {
  user_id: string;
  role: "manager" | "player";
  display_name: string | null;
  email: string | null;
}

/** A game as players see it: names and colors only. */
export interface PublishedGame {
  id: string;
  played_on: string;
  title?: string | null;
  published_at: string;
  teams: { name: string; color: string; players: { name: string }[] }[];
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
  /** Custom name; when missing, the default name for the date is shown. */
  title?: string | null;
  teams: SavedTeam[];
  created_at: string;
  /** Set when players can see the game. */
  published_at?: string | null;
}

export function clampRating(value: number): number {
  const rounded = Math.round(value * 2) / 2;
  return Math.min(MAX_RATING, Math.max(MIN_RATING, rounded));
}

export function formatRating(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
