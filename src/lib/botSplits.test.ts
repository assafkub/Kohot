import { describe, expect, it } from "vitest";
import { splitsForRoster } from "./botSplits";
import type { Player } from "./types";

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const names = ["אבי כהן", "בני לוי", "גיל מור", "דור א", "דור ב", "הדר", "ויקטור", "זיו", "חן", "טל", "יוני", "כפיר", "ליאור", "מתן", "נועם", "סהר", "עידו", "פז", "צחי", "רון"];
const players: Player[] = names.map((name, i) => ({
  id: `p${i}`,
  group_id: "g",
  name,
  rating: 1 + (i % 7),
  positions: ["MID"],
  active: true,
  created_at: "",
}));

describe("splitsForRoster", () => {
  it("returns three different splits of the pasted players, names only", () => {
    const roster = [
      "*כדורגל יום רביעי*:",
      ...names.map((n, i) => `${i + 1}. ${n} *שולם*`),
      "21. אורח חדפ",
      "לתשלום: https://payboxapp.page.link/abc",
    ].join("\n");
    const res = splitsForRoster(roster, players, 3, seeded(3));
    expect(res.playerCount).toBe(21);
    expect(res.unknown).toEqual(["אורח חדפ"]);
    expect(res.splits).toHaveLength(3);
    expect(new Set(res.splits).size).toBe(3);
    for (const split of res.splits) {
      const lines = split.split("\n");
      expect(lines[0]).toMatch(/^שחור\s+כחול\s+לבן$/);
      expect(lines).toHaveLength(8);
      expect(split).not.toMatch(/\d/);
    }
  });

  it("finds nothing in chatter", () => {
    expect(splitsForRoster("", players).splits).toEqual([]);
  });
});
