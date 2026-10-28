import { formatRating, POSITION_EMOJI, POSITIONS, type SavedTeam } from "./types";

export const TEAM_STYLES = [
  { name: "לבנים", emoji: "⚪", swatch: "bg-white ring-1 ring-zinc-300", header: "bg-zinc-50" },
  { name: "שחורים", emoji: "⚫", swatch: "bg-zinc-900", header: "bg-zinc-800 text-white" },
  { name: "אדומים", emoji: "🔴", swatch: "bg-red-600", header: "bg-red-600 text-white" },
  { name: "כחולים", emoji: "🔵", swatch: "bg-blue-600", header: "bg-blue-600 text-white" },
  { name: "צהובים", emoji: "🟡", swatch: "bg-yellow-400", header: "bg-yellow-300" },
  { name: "ירוקים", emoji: "🟢", swatch: "bg-emerald-600", header: "bg-emerald-600 text-white" },
];

export function teamStyle(index: number) {
  return TEAM_STYLES[index % TEAM_STYLES.length];
}

export function shareText(teams: SavedTeam[], date = new Date()): string {
  const lines = [`⚽ הכוחות להיום – ${date.getDate()}.${date.getMonth() + 1}`];
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
