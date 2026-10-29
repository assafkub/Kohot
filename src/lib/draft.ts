import { readStored, writeStored } from "./storage";
import { savedColorOrder } from "./teams";
import type { Game } from "./types";

/** The game being prepared on the Today screen, kept per group in this browser. */
export interface DraftGame {
  date: string;
  /** Set once the game was saved to history; later changes update the same game. */
  gameId: string | null;
  /** Custom name, or null to follow the date ("כדורגל חמישי - 29.10"). */
  title?: string | null;
  /** draftSignature() at the last save to history; any difference means unsaved changes. */
  savedSig?: string | null;
}

export interface StoredResult {
  key: string;
  teams: string[][];
  /** TEAM_STYLES index worn by each team; missing means the natural order. */
  colors?: number[];
}

export const draftKeys = (groupId: string) => ({
  attendance: `kohot:attendance:${groupId}`,
  result: `kohot:result:${groupId}`,
  game: `kohot:game:${groupId}`,
});

const WEEKDAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Default name for a game on this date: "כדורגל חמישי - 29.10". */
export function defaultGameTitle(dateIso: string): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `כדורגל ${WEEKDAYS[date.getDay()]} - ${d}.${m}`;
}

export function gameTitle(game: { title?: string | null; played_on: string }): string {
  return game.title?.trim() || defaultGameTitle(game.played_on);
}

export function shortDate(dateIso: string): string {
  const [, m, d] = dateIso.split("-").map(Number);
  return `${d}.${m}`;
}

export function readDraftGame(groupId: string): DraftGame {
  return readStored<DraftGame>(draftKeys(groupId).game, { date: todayIso(), gameId: null });
}

export const DEFAULT_COLORS = [0, 1, 2];

export function draftSignature(
  date: string,
  title: string | null | undefined,
  teams: string[][],
  colors: number[] = DEFAULT_COLORS,
): string {
  return JSON.stringify([date, title ?? null, teams, colors]);
}

/** After games were deleted from history, the draft that pointed at one of them becomes an unsaved draft again. */
export function forgetSavedGame(groupId: string, gameId?: string) {
  const game = readDraftGame(groupId);
  if (!game.gameId || (gameId && game.gameId !== gameId)) return;
  writeStored(draftKeys(groupId).game, { ...game, gameId: null, savedSig: null } satisfies DraftGame);
}

/** Opens a saved game on the Today screen for viewing or editing. */
export function openGameAsDraft(groupId: string, game: Game) {
  const keys = draftKeys(groupId);
  const teams = game.teams.map((t) => t.players.map((p) => p.id));
  writeStored(keys.attendance, teams.flat());
  const colors = savedColorOrder(game.teams);
  writeStored(keys.result, { key: "", teams, colors } satisfies StoredResult);
  writeStored(keys.game, {
    date: game.played_on,
    gameId: game.id,
    title: game.title ?? null,
    savedSig: draftSignature(game.played_on, game.title, teams, colors),
  } satisfies DraftGame);
}
