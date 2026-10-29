import { balanceTeams, type BalancePlayer } from "./balance";
import { matchPlayer, parsePlayerList } from "./parseList";
import { shareText, toSavedTeams } from "./teams";
import { DEFAULT_RATING, type Player } from "./types";

// Same as the Today screen: always three teams.
const TEAM_COUNT = 3;
const MAX_TRIES = 12;

export interface BotSplits {
  /** Each split in the spaced-column text the group shares, names only. */
  splits: string[];
  playerCount: number;
  /** Pasted names with no player of that name in the group; they count with the default rating. */
  unknown: string[];
}

/** Parses a pasted list of who is coming and returns a few different balanced splits, for the Telegram bot. */
export function splitsForRoster(text: string, players: Player[], count = 3, rng: () => number = Math.random): BotSplits {
  const unknown: string[] = [];
  const coming: BalancePlayer[] = parsePlayerList(text).map((line, i) => {
    const existing = matchPlayer(line.name, players);
    if (existing) return { id: existing.id, name: existing.name, rating: existing.rating, positions: existing.positions };
    unknown.push(line.name);
    return { id: `new-${i}`, name: line.name, rating: line.rating ?? DEFAULT_RATING, positions: [] };
  });
  // A player listed twice under the same saved name counts once.
  const unique = [...new Map(coming.map((p) => [p.id, p])).values()];

  const seen = new Set<string>();
  const splits: string[] = [];
  for (let i = 0; i < MAX_TRIES && splits.length < count && unique.length > 0; i++) {
    const res = balanceTeams(unique, TEAM_COUNT, { rng, avoidKey: [...seen].pop() });
    if (seen.has(res.key)) continue;
    seen.add(res.key);
    splits.push(shareText(toSavedTeams(res.teams.map((t) => t.players))));
  }
  return { splits, playerCount: unique.length, unknown };
}
