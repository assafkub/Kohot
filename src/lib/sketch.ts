/**
 * Turns a lineup someone else wrote (usually copied from WhatsApp) into team columns, for the "sketch to picture" page.
 * Nothing here touches the roster: names stay plain text.
 *
 * Two shapes are understood:
 *  - side by side: a header row such as "*שחור*   *לבן*   *כחול*", then one row per place, the columns separated
 *    by runs of spaces, dots, commas, tabs or "|";
 *  - one under the other: "*שחור*" on its own line, its players below it, then the next team.
 * The guess can be wrong, so the page lets the user fix every column before making the picture.
 */

export interface SketchTeam {
  name: string;
  /** A team emoji from SKETCH_COLORS, or "" when the header is not a color. */
  color: string;
  players: string[];
}

export const SKETCH_COLORS = [
  { emoji: "⚫", word: "שחור", bg: "#18181b", fg: "#ffffff" },
  { emoji: "⚪", word: "לבן", bg: "#ffffff", fg: "#18181b", border: "#d4d4d8" },
  { emoji: "🔵", word: "כחול", bg: "#2563eb", fg: "#ffffff" },
  { emoji: "🔴", word: "אדום", bg: "#dc2626", fg: "#ffffff" },
  { emoji: "🟢", word: "ירוק", bg: "#16a34a", fg: "#ffffff" },
  { emoji: "🟡", word: "צהוב", bg: "#facc15", fg: "#18181b" },
  { emoji: "🟠", word: "כתום", bg: "#ea580c", fg: "#ffffff" },
  { emoji: "🟣", word: "סגול", bg: "#7c3aed", fg: "#ffffff" },
] as const;

export type SketchColor = (typeof SKETCH_COLORS)[number];

/** A neutral header for teams without a color. */
export const NO_COLOR = { emoji: "", word: "", bg: "#e4e4e7", fg: "#18181b" };

export function sketchColor(emoji: string): SketchColor | typeof NO_COLOR {
  return SKETCH_COLORS.find((c) => c.emoji === emoji) ?? NO_COLOR;
}

// Every way a color shows up in a header: the word in its forms, and color emojis.
const COLOR_FORMS: [RegExp, string][] = [
  [/^(שחור|שחורה|שחורים|שחורות|black)$/i, "⚫"],
  [/^(לבן|לבנה|לבנים|לבנות|white)$/i, "⚪"],
  [/^(כחול|כחולה|כחולים|כחולות|blue)$/i, "🔵"],
  [/^(אדום|אדומה|אדומים|אדומות|red)$/i, "🔴"],
  [/^(ירוק|ירוקה|ירוקים|ירוקות|green)$/i, "🟢"],
  [/^(צהוב|צהובה|צהובים|צהובות|yellow)$/i, "🟡"],
  [/^(כתום|כתומה|כתומים|כתומות|orange)$/i, "🟠"],
  [/^(סגול|סגולה|סגולים|סגולות|purple)$/i, "🟣"],
];
const EMOJI_COLOR: Record<string, string> = {
  "⚫": "⚫", "⬛": "⚫", "🖤": "⚫",
  "⚪": "⚪", "⬜": "⚪", "🤍": "⚪", "🏳": "⚪",
  "🔵": "🔵", "🟦": "🔵", "💙": "🔵",
  "🔴": "🔴", "🟥": "🔴", "❤": "🔴",
  "🟢": "🟢", "🟩": "🟢", "💚": "🟢",
  "🟡": "🟡", "🟨": "🟡", "💛": "🟡",
  "🟠": "🟠", "🟧": "🟠", "🧡": "🟠",
  "🟣": "🟣", "🟪": "🟣", "💜": "🟣",
};
const EMOJI = /[\p{Extended_Pictographic}\p{Regional_Indicator}‍️⃣]/gu;
// Direction marks that WhatsApp and phones slip into copied text.
const BIDI = /[‎‏‪-‮⁦-⁩]/g;
// Between columns: two or more spaces, a tab, or a dot / comma / bar with the spaces around it.
const CELL_SEP = /\s*[.,|\t•·]+\s*|\s{2,}/g;
const LINK = /https?:\/\/|www\./i;

/** The team emoji a header names, or "". */
export function colorOf(text: string): string {
  for (const ch of text.match(EMOJI) ?? []) if (EMOJI_COLOR[ch]) return EMOJI_COLOR[ch];
  const words = text.replace(EMOJI, " ").replace(/[^\p{L}\s]/gu, " ").split(/\s+/).filter(Boolean);
  for (const w of words) for (const [re, emoji] of COLOR_FORMS) if (re.test(w)) return emoji;
  return "";
}

function cleanName(text: string): string {
  return text
    .replace(/\*/g, " ")
    .replace(/^\s*\d{1,2}\s*[.)\-:]\s*/, "")
    .replace(/^[\s.,|\-–:]+|[\s.,|\-–:]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function teamFromHeader(raw: string): SketchTeam {
  const color = colorOf(raw);
  const name = cleanName(raw.replace(EMOJI, " "));
  return { name: name || sketchColor(color).word, color, players: [] };
}

interface Cell {
  text: string;
  /** Where the cell starts in the line, used to line cells up under the headers. */
  at: number;
}

function splitCells(line: string): Cell[] {
  const cells: Cell[] = [];
  let last = 0;
  const push = (end: number) => {
    const piece = line.slice(last, end);
    const text = cleanName(piece);
    // A lone number is row numbering, not a player.
    if (text && !/^\d+$/.test(text)) cells.push({ text, at: last + (piece.length - piece.trimStart().length) });
  };
  for (const m of line.matchAll(CELL_SEP)) {
    push(m.index!);
    last = m.index! + m[0].length;
  }
  push(line.length);
  return cells;
}

/** "*שחור*   *לבן*" gives its starred parts; a row made only of colors ("שחור לבן כחול") gives them too. */
function headerCells(line: string): Cell[] | null {
  const starred = [...line.matchAll(/\*([^*\n]+)\*/g)];
  if (starred.length) {
    const rest = line.replace(/\*[^*\n]+\*/g, "").replace(EMOJI, "").replace(/[\s.,|:\-–]/g, "");
    if (rest) return null;
    return starred.map((m) => ({ text: m[1], at: m.index! }));
  }
  const words = [...line.matchAll(/\S+/g)];
  if (words.length && words.every((w) => colorOf(w[0]))) return words.map((w) => ({ text: w[0], at: w.index! }));
  return null;
}

/** Puts the row's cells into `count` columns, by where they start compared with the headers. */
function placeCells(cells: Cell[], count: number, anchors: number[] | null): string[] {
  const out: string[] = Array(count).fill("");
  if (!cells.length) return out;
  // A lone letter after a name is its initial ("דור  א"), not another column.
  const merged: Cell[] = [];
  for (const c of cells) {
    const prev = merged[merged.length - 1];
    if (prev && cells.length > count && /^\p{L}['"׳״]?$/u.test(c.text)) prev.text += ` ${c.text}`;
    else merged.push({ ...c });
  }
  if (merged.length === count || !anchors) {
    merged.forEach((c, i) => {
      const col = Math.min(i, count - 1);
      out[col] = out[col] ? `${out[col]} ${c.text}` : c.text;
    });
    return out;
  }
  // Fewer (or more) cells than teams: each goes under the nearest header, never left of the previous cell.
  let min = 0;
  for (const c of merged) {
    let best = min;
    for (let k = min; k < count; k++) if (Math.abs(anchors[k] - c.at) < Math.abs(anchors[best] - c.at)) best = k;
    out[best] = out[best] ? `${out[best]} ${c.text}` : c.text;
    min = best;
  }
  return out;
}

function mostCommon(values: number[]): number {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = 0;
  let bestCount = 0;
  for (const [v, c] of counts) if (c > bestCount || (c === bestCount && v > best)) [best, bestCount] = [v, c];
  return best;
}

/** Default headers when the text has none: the app's usual colors, then plain numbers. */
function defaultTeams(count: number): SketchTeam[] {
  const order = ["⚫", "🔵", "⚪"];
  return Array.from({ length: count }, (_, i) =>
    order[i] ? { name: sketchColor(order[i]).word, color: order[i], players: [] } : { name: `קבוצה ${i + 1}`, color: "", players: [] },
  );
}

export function parseSketch(text: string): SketchTeam[] {
  const lines = text
    .replace(BIDI, "")
    .replace(/ /g, " ")
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l) => l.trim() && !LINK.test(l));
  if (!lines.length) return [];

  const headers = lines.map(headerCells);
  const firstHeader = headers.findIndex(Boolean);

  // One team per header line, players under it.
  const singleHeaders = headers.filter((h) => h?.length === 1).length;
  if (firstHeader >= 0 && singleHeaders >= 2 && headers.every((h) => !h || h.length === 1)) {
    const teams: SketchTeam[] = [];
    lines.forEach((line, i) => {
      const h = headers[i];
      if (h) teams.push(teamFromHeader(h[0].text));
      else if (teams.length) {
        const name = cleanName(line.replace(EMOJI, " "));
        if (name && !/^\d+$/.test(name)) teams[teams.length - 1].players.push(name);
      }
    });
    return teams;
  }

  // Side by side.
  let teams: SketchTeam[];
  let anchors: number[] | null = null;
  let rows: string[];
  if (firstHeader >= 0) {
    const h = headers[firstHeader]!;
    teams = h.map((c) => teamFromHeader(c.text));
    anchors = h.map((c) => c.at);
    rows = lines.slice(firstHeader + 1).filter((_, i) => !headers[firstHeader + 1 + i]);
  } else {
    rows = lines;
    const count = Math.max(1, mostCommon(rows.map((r) => splitCells(r).length)));
    teams = defaultTeams(count);
  }

  for (const row of rows) {
    let cells = splitCells(row);
    // "אסי טל רון" with single spaces: one word per team, when the count matches exactly.
    if (cells.length === 1 && teams.length > 1) {
      const words = [...row.matchAll(/\S+/g)].map((m) => ({ text: cleanName(m[0]), at: m.index! })).filter((c) => c.text);
      if (words.length === teams.length) cells = words;
    }
    placeCells(cells, teams.length, anchors).forEach((name, i) => {
      if (name) teams[i].players.push(name);
    });
  }
  return teams;
}
