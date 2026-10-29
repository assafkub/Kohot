import type { BalancePlayer } from "./balance";
import { POSITION_EMOJI, POSITIONS, type SavedTeam } from "./types";

export const TEAM_STYLES = [
  { name: "שחורים", emoji: "⚫", swatch: "bg-zinc-900", header: "bg-zinc-900 text-white" },
  { name: "כחולים", emoji: "🔵", swatch: "bg-blue-600", header: "bg-blue-600 text-white" },
  { name: "לבנים", emoji: "⚪", swatch: "bg-white ring-1 ring-zinc-300", header: "bg-zinc-50" },
];

export function teamStyle(index: number) {
  return TEAM_STYLES[index % TEAM_STYLES.length];
}

/** `colors[i]` is the TEAM_STYLES index worn by team i (they can be swapped); default is the natural order. */
export function toSavedTeams(teams: BalancePlayer[][], colors?: number[]): SavedTeam[] {
  return teams.map((players, i) => ({
    name: teamStyle(colors?.[i] ?? i).name,
    color: teamStyle(colors?.[i] ?? i).emoji,
    total: players.reduce((s, p) => s + p.rating, 0),
    players: players.map(({ id, name, rating, positions }) => ({ id, name, rating, positions })),
  }));
}

const COLOR_WORD: Record<string, string> = { "⚫": "שחור", "🔵": "כחול", "⚪": "לבן" };

/** Spaces between columns; tabs looked bad in WhatsApp. */
const COLUMN_GAP = 5;

/**
 * WhatsApp message with the teams side by side, as the group writes it: a row of colors, then one row per place.
 * Each column is padded to its longest name plus a few spaces, so the columns roughly line up.
 * No ratings or averages, those stay in the app.
 */
export function shareText(teams: SavedTeam[]): string {
  const columns = teams.map((t, i) => [COLOR_WORD[t.color] ?? t.name ?? teamStyle(i).name, ...t.players.map((p) => p.name)]);
  const widths = columns.map((col) => Math.max(...col.map((cell) => cell.length)));
  const rows = Math.max(0, ...columns.map((col) => col.length));
  const lines: string[] = [];
  for (let r = 0; r < rows; r++) {
    const cells = columns.map((col, c) => (col[r] ?? "").padEnd(widths[c] + COLUMN_GAP));
    lines.push(cells.join("").trimEnd());
  }
  return lines.join("\n");
}

/** The color order of saved teams, for reopening them with the colors they had. */
export function savedColorOrder(teams: SavedTeam[]): number[] {
  return teams.map((t, i) => {
    const found = TEAM_STYLES.findIndex((s) => s.emoji === t.color);
    return found >= 0 ? found : i % TEAM_STYLES.length;
  });
}

export function positionSummary(players: { positions: SavedTeam["players"][number]["positions"] }[]): string {
  return POSITIONS.map((pos) => {
    const count = players.filter((p) => p.positions[0] === pos).length;
    return count ? `${POSITION_EMOJI[pos]}${count}` : "";
  })
    .filter(Boolean)
    .join(" ");
}
