import type { BalancePlayer } from "./balance";
import { formatRating, POSITION_EMOJI, POSITIONS, type SavedTeam } from "./types";

export const TEAM_STYLES = [
  { name: "שחורים", emoji: "⚫", swatch: "bg-zinc-900", header: "bg-zinc-900 text-white" },
  { name: "כחולים", emoji: "🔵", swatch: "bg-blue-600", header: "bg-blue-600 text-white" },
  { name: "לבנים", emoji: "⚪", swatch: "bg-white ring-1 ring-zinc-300", header: "bg-zinc-50" },
];

export function teamStyle(index: number) {
  return TEAM_STYLES[index % TEAM_STYLES.length];
}

export function toSavedTeams(teams: BalancePlayer[][]): SavedTeam[] {
  return teams.map((players, i) => ({
    name: teamStyle(i).name,
    color: teamStyle(i).emoji,
    total: players.reduce((s, p) => s + p.rating, 0),
    players: players.map(({ id, name, rating, positions }) => ({ id, name, rating, positions })),
  }));
}

/** WhatsApp message with the teams; `title` is the game's name, e.g. "רביעי 29.10". */
export function shareText(teams: SavedTeam[], title: string): string {
  const lines = [`⚽ הכוחות – ${title}`];
  teams.forEach((team, i) => {
    lines.push("", `${teamStyle(i).emoji} *${team.name}* (${formatRating(team.total)})`);
    team.players.forEach((p) => {
      const main = p.positions[0];
      lines.push(`• ${p.name}${main ? ` ${POSITION_EMOJI[main]}` : ""}`);
    });
  });
  return lines.join("\n");
}

export function positionSummary(players: { positions: SavedTeam["players"][number]["positions"] }[]): string {
  return POSITIONS.map((pos) => {
    const count = players.filter((p) => p.positions[0] === pos).length;
    return count ? `${POSITION_EMOJI[pos]}${count}` : "";
  })
    .filter(Boolean)
    .join(" ");
}
