import { describe, expect, it } from "vitest";
import { balanceTeams, suggestTeamCount, teamSizes, type BalancePlayer } from "./balance";
import { parsePlayerList } from "./parseList";
import type { Position } from "./types";

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function makePlayers(count: number, seed = 1): BalancePlayer[] {
  const rng = seeded(seed);
  const roles: Position[] = ["GK", "CB", "FB", "FB", "MID", "MID", "FWD"];
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i}`,
    name: `שחקן ${i}`,
    rating: 1 + Math.round(rng() * 12) / 2,
    positions: [roles[i % roles.length]],
  }));
}

describe("teamSizes / suggestTeamCount", () => {
  it("splits evenly with remainder spread", () => {
    expect(teamSizes(14, 2)).toEqual([7, 7]);
    expect(teamSizes(22, 3)).toEqual([8, 7, 7]);
  });
  it("suggests 7-a-side", () => {
    expect(suggestTeamCount(14)).toBe(2);
    expect(suggestTeamCount(21)).toBe(3);
    expect(suggestTeamCount(9)).toBe(2);
  });
});

describe("balanceTeams", () => {
  it("keeps every player exactly once and balances totals", () => {
    for (const [n, k] of [
      [14, 2],
      [21, 3],
      [28, 4],
      [17, 2],
    ]) {
      const players = makePlayers(n, n);
      const { teams } = balanceTeams(players, k, { rng: seeded(42) });
      expect(teams).toHaveLength(k);
      const ids = teams.flatMap((t) => t.players.map((p) => p.id)).sort();
      expect(ids).toEqual(players.map((p) => p.id).sort());
      const avgs = teams.map((t) => t.average);
      expect(Math.max(...avgs) - Math.min(...avgs)).toBeLessThan(0.35);
    }
  });

  it("gives each team a goalkeeper when there are enough", () => {
    const players = makePlayers(21, 7);
    const { teams } = balanceTeams(players, 3, { rng: seeded(3) });
    for (const t of teams) expect(t.players.some((p) => p.positions.includes("GK"))).toBe(true);
  });

  it("produces different splits on reshuffle", () => {
    const players = makePlayers(14, 5);
    const rng = seeded(9);
    const keys = new Set<string>();
    let prev: string | undefined;
    for (let i = 0; i < 6; i++) {
      const res = balanceTeams(players, 2, { rng, avoidKey: prev });
      keys.add(res.key);
      prev = res.key;
    }
    expect(keys.size).toBeGreaterThan(2);
  });
});

describe("parsePlayerList", () => {
  it("parses a WhatsApp style list", () => {
    const parsed = parsePlayerList("1. אסף ✅\n2) דני 5.5\n- יוסי - 3\n\nאסף\nמשה כהן");
    expect(parsed).toEqual([
      { name: "אסף" },
      { name: "דני", rating: 5.5 },
      { name: "יוסי", rating: 3 },
      { name: "משה כהן" },
    ]);
  });
});
