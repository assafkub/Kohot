import { readStored, writeStored } from "./storage";
import type { Game } from "./types";

/** The game being prepared on the Today screen, kept per group in this browser. */
export interface DraftGame {
  date: string;
  /** Set once the game was saved to history; later changes update the same game. */
  gameId: string | null;
}

export interface StoredResult {
  key: string;
  teams: string[][];
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

/** "רביעי 29.10" */
export function gameTitle(dateIso: string): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${WEEKDAYS[date.getDay()]} ${d}.${m}`;
}

export function readDraftGame(groupId: string): DraftGame {
  return readStored<DraftGame>(draftKeys(groupId).game, { date: todayIso(), gameId: null });
}

/** Opens a saved game on the Today screen for viewing or editing. */
export function openGameAsDraft(groupId: string, game: Game) {
  const keys = draftKeys(groupId);
  const teams = game.teams.map((t) => t.players.map((p) => p.id));
  writeStored(keys.attendance, teams.flat());
  writeStored(keys.result, { key: "", teams } satisfies StoredResult);
  writeStored(keys.game, { date: game.played_on, gameId: game.id } satisfies DraftGame);
}
