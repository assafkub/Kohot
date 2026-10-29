import { describe, expect, it } from "vitest";
import { balanceTeams, teamSizes, type BalancePlayer } from "./balance";
import { findSimilarPlayers, fullerName, matchPlayer, parsePlayerList } from "./parseList";
import { shareText } from "./teams";
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

describe("teamSizes", () => {
  it("splits evenly with remainder spread", () => {
    expect(teamSizes(14, 2)).toEqual([7, 7]);
    expect(teamSizes(21, 3)).toEqual([7, 7, 7]);
    expect(teamSizes(20, 3)).toEqual([7, 7, 6]);
    expect(teamSizes(19, 3)).toEqual([7, 6, 6]);
  });
});

describe("balanceTeams", () => {
  it("gives every team a balanced total, a center-back, fullbacks and midfielders, sorted by rating", () => {
    // A typical week: 21 players, 2 goalkeepers (fewer than teams), mixed ratings.
    const roles: Position[][] = [
      ["GK"], ["GK", "CB"], ["CB"], ["CB", "FB"], ["CB"], ["FB"], ["FB", "MID"], ["FB"], ["FB"], ["FB", "CB"],
      ["MID"], ["MID"], ["MID", "FWD"], ["MID"], ["MID", "FB"], ["MID"], ["FWD"], ["FWD", "MID"], ["FWD"], ["FWD"], ["MID"],
    ];
    for (let seed = 1; seed <= 15; seed++) {
      const rng = seeded(seed * 7);
      const players = roles.map((positions, i) => ({
        id: `p${i}`, name: `שחקן ${i}`, rating: 1 + Math.round(rng() * 12) / 2, positions,
      }));
      const { teams } = balanceTeams(players, 3, { rng: seeded(seed) });
      const totals = teams.map((t) => t.total);
      expect(Math.max(...totals) - Math.min(...totals)).toBeLessThanOrEqual(1);
      for (const t of teams) {
        const can = (pos: Position) => t.players.filter((p) => p.positions.includes(pos)).length;
        expect(can("CB")).toBeGreaterThanOrEqual(1);
        expect(can("FB")).toBeGreaterThanOrEqual(2);
        expect(can("MID")).toBeGreaterThanOrEqual(2);
        expect(can("GK")).toBeLessThanOrEqual(1);
        const ratings = t.players.map((p) => p.rating);
        expect(ratings).toEqual([...ratings].sort((a, b) => a - b));
      }
    }
  });

  it("keeps every player exactly once and balances totals", () => {
    for (const [n, k] of [
      [21, 3],
      [20, 3],
      [19, 3],
      [14, 2],
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
    const parsed = parsePlayerList("1. אסף ✅\n2) דני 5.5\n- יוסי - 3\n4. אסף\n5. משה כהן");
    expect(parsed).toEqual([
      { name: "אסף" },
      { name: "דני", rating: 5.5 },
      { name: "יוסי", rating: 3 },
      { name: "משה כהן" },
    ]);
  });

  it("cleans a shared teams message with notes, guests and titles", () => {
    const text = `⚽ הכוחות להיום – 28.10

⚪ *לבנים* (28)
• אסי *שולם*
• יוסף כ *שולם*
• כלפון חדפ (אלמוג ) *שולם*
• ערן חדפ (מתן)
• תומר בכפוף למבחן כשירות *שולם*

⚫ *שחורים* (28)
• דור און  *שולם*
• אביב דהן חדפ *שולם*
• דור ב *שולם*
• שחף *שולם* 
• לתשלום בפייבוקס: https://links.payboxapp.com/AbC123
• payboxapp.com/xyz
https://chat.whatsapp.com/abc`;
    expect(parsePlayerList(text).map((p) => p.name)).toEqual([
      "אסי",
      "יוסף כ",
      "כלפון חדפ",
      "ערן חדפ",
      "תומר",
      "דור און",
      "אביב דהן חדפ",
      "דור ב",
      "שחף",
    ]);
  });

  it("parses a PayBox group message", () => {
    const text = `השימוש ב-PayBox חינם!
מחכים לך בקבוצת "כדורגל יום רביעי 28.10",
לחיצה להצטרפות לקבוצה: 
https://links.payboxapp.com/epFS12LTx7b

*כדורגל יום רביעי*:
1.אבנר *שולם*
2.אורי *שולם*
5.תומר בכפוף למבחן כשירות *שולם*
9.דור ב *שולם* 
15.אבי חדפ (פוצי) *שולם*
16.כלפון חדפ (אלמוג ) *שולם* 
17. ערן חדפ (מתן)
21. אביב דהן חדפ *שולם*`;
    expect(parsePlayerList(text).map((p) => p.name)).toEqual([
      "אבנר",
      "אורי",
      "תומר",
      "דור ב",
      "אבי חדפ",
      "כלפון חדפ",
      "ערן חדפ",
      "אביב דהן חדפ",
    ]);
  });

  it("parses a plain list without bullets", () => {
    expect(parsePlayerList("אסף\nדני 5.5\nhttps://x.com/y").map((p) => p.name)).toEqual(["אסף", "דני"]);
  });
});

describe("matchPlayer / findSimilarPlayers", () => {
  const players = [
    { name: "אביב דהן" },
    { name: "דור א" },
    { name: "דור ב" },
    { name: "אורי שפירא" },
    { name: "אורין" },
    { name: "אוריי" },
    { name: "יוסף כ" },
  ];
  const similar = (name: string) => findSimilarPlayers(name, players).map((p) => p.name);

  it("matches exactly, folding final letters", () => {
    expect(matchPlayer("דור ב", players)?.name).toBe("דור ב");
    expect(matchPlayer("אורינ", players)?.name).toBe("אורין");
    expect(matchPlayer("אביב", players)).toBeUndefined();
  });

  it("suggests likely duplicates", () => {
    expect(similar("אורי ש")[0]).toBe("אורי שפירא");
    expect(similar("אביב")).toEqual(["אביב דהן"]);
    expect(similar("אורי")).toContain("אוריי");
    expect(similar("יוסף כהן")).toEqual(["יוסף כ"]);
    expect(similar("אביב דהו")).toEqual(["אביב דהן"]);
  });

  it("keeps different surnames apart", () => {
    expect(similar("דור ג")).toEqual([]);
    expect(similar("אורי כהן")).not.toContain("אורי שפירא");
  });

  it("completes a surname only", () => {
    expect(fullerName("אורי ש", "אורי שפירא")).toBe("אורי שפירא");
    expect(fullerName("אבי", "אבי חדפ")).toBeNull();
    expect(fullerName("דור ב", "דור א")).toBeNull();
  });
});

describe("shareText", () => {
  it("lays the teams side by side with color names and no ratings", () => {
    const team = (color: string, names: string[]) => ({
      name: "",
      color,
      total: 0,
      players: names.map((name) => ({ id: name, name, rating: 4, positions: [] })),
    });
    const text = shareText([team("⚫", ["אסי", "טל"]), team("⚪", ["אוראל", "ירון"]), team("🔵", ["רועי"])]);
    expect(text).toBe("שחור\tלבן\tכחול\nאסי\tאוראל\tרועי\nטל\tירון");
  });
});
