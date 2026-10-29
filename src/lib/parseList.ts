import { clampRating } from "./types";

export interface ParsedLine {
  name: string;
  rating?: number;
}

/** Normalized form used to match pasted names to existing players. */
export function normalizeName(name: string): string {
  return name
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// Numbering ("1." / "2)") or a bullet. "-" and "*" count only before a space, since "*bold*" titles start with "*".
const LIST_MARKER = /^\s*(\d{1,2}\s*[.)\-:]|[•·▪◦‣]|[-*](?=\s))\s*/u;
// "*כדורגל יום רביעי*:" and other lines ending with a colon are titles.
const TITLE = /:\s*$/u;
// A line with a link (payment link, group invite) is never a player.
const LINK = /(https?:\/\/|www\.)|\b[\w-]+\.(com|co\.il|app|me|ly|io|link)\b/iu;
const PAYMENT = /פייבוקס|פיי בוקס|לתשלום|תשלום|paybox|\bbit\b|ביט/iu;
const EMOJI = /[\p{Extended_Pictographic}\p{Regional_Indicator}‍️⃣]/gu;
// Notes people add next to names in the group's list, such as payment status.
const NOISE_WORDS = new Set(["שולם", "שילם", "לא", "מאושר", "בהמתנה", "ממתין"]);
// Marks a one-time player (not one of the regulars); kept as a suffix of the name.
const GUEST_WORDS = new Set(["חדפ", "חד״פ", "חד\"פ", "חד-פעמי"]);
export const GUEST_SUFFIX = "חדפ";
// Words that only appear in titles of shared lists, never in player names.
const TEAM_WORDS = new Set(["לבנים", "שחורים", "כחולים", "אדומים", "צהובים", "ירוקים", "כוחות", "הכוחות", "קבוצה", "קבוצות", "להיום"]);
const MAX_NAME_WORDS = 2;

function cleanLine(raw: string): ParsedLine | null {
  if (LINK.test(raw) || PAYMENT.test(raw) || TITLE.test(raw)) return null;
  let line = raw
    .replace(EMOJI, " ")
    .replace(LIST_MARKER, "")
    // *bold* WhatsApp notes such as *שולם*
    .replace(/\*[^*]*\*/g, " ")
    // (who invited him) and [notes]
    .replace(/\([^)]*\)?|\[[^\]]*\]?/g, " ")
    .trim();

  let rating: number | undefined;
  const ratingMatch = line.match(/(?:^|[\s\-:])([1-7](?:\.5|\.0)?)\s*$/);
  if (ratingMatch) {
    rating = clampRating(parseFloat(ratingMatch[1]));
    line = line.slice(0, ratingMatch.index).trim();
  }

  const words = line
    .replace(/[^\p{L}\p{N}\s'״׳".\-]/gu, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^[\-.'"]+|[\-.'"]+$/g, ""))
    .filter((w) => w && !NOISE_WORDS.has(w) && !/^\d+$/.test(w));
  if (words.some((w) => TEAM_WORDS.has(w))) return null;
  const guest = words.some((w) => GUEST_WORDS.has(w));
  const nameWords = words.filter((w) => !GUEST_WORDS.has(w));
  if (nameWords.length === 0) return null;
  // "תומר בכפוף למבחן כשירות" → "תומר": long lines are a name plus a comment.
  const base = nameWords.length > MAX_NAME_WORDS ? nameWords.slice(0, 1) : nameWords;
  const name = [...base, ...(guest ? [GUEST_SUFFIX] : [])].join(" ");
  return rating === undefined ? { name } : { name, rating };
}

/**
 * Parses a pasted list (e.g. a WhatsApp attendance message or a previous teams message), one player per line.
 * Handles numbering, bullets, emojis, links, *notes*, (parentheses), titles and an optional trailing rating.
 */
export function parsePlayerList(text: string): ParsedLine[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  // In a list with bullets or numbers, lines without them are titles or chatter.
  const marked = lines.filter((l) => LIST_MARKER.test(l));
  const candidates = marked.length >= 2 ? marked : lines.flatMap((l) => l.split(","));
  const seen = new Set<string>();
  const result: ParsedLine[] = [];
  for (const raw of candidates) {
    const parsed = cleanLine(raw);
    if (!parsed) continue;
    const key = normalizeName(parsed.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(parsed);
  }
  return result;
}

const FINAL_LETTERS: Record<string, string> = { ך: "כ", ם: "מ", ן: "נ", ף: "פ", ץ: "צ" };

/** normalizeName plus Hebrew final letters folded to their regular form ("אורין" = "אורינ"). */
export function foldName(name: string): string {
  return normalizeName(name).replace(/[ךםןףץ]/g, (c) => FINAL_LETTERS[c]);
}

/** Without the letters people add or drop when spelling the same name (י, ו, א, ה). */
function skeleton(folded: string): string {
  return folded.replace(/[יואה]/g, "");
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length];
}

/** The existing player with exactly this name (ignoring punctuation, case and final letters). */
export function matchPlayer<P extends { name: string }>(name: string, players: P[]): P | undefined {
  const key = foldName(name);
  return players.find((p) => foldName(p.name) === key);
}

/**
 * Existing players whose name looks like the same person, to ask about rather than merge silently:
 * a completed surname ("אורי ש" / "אורי שפירא"), spelling with or without י/ו ("אורי" / "אוריי"),
 * or a one-letter typo. Different surname initials ("דור א" / "דור ב") are different people.
 */
export function findSimilarPlayers<P extends { name: string }>(name: string, players: P[]): P[] {
  const a = foldName(name);
  const aw = a.split(" ");
  const scored: { player: P; score: number }[] = [];
  for (const player of players) {
    const b = foldName(player.name);
    if (b === a) continue;
    const bw = b.split(" ");
    const aLast = aw.length > 1 ? aw[aw.length - 1] : "";
    const bLast = bw.length > 1 ? bw[bw.length - 1] : "";
    // Two different surname initials, or two different full surnames, are two people.
    if (aw.length === bw.length && aLast && bLast && !aLast.startsWith(bLast) && !bLast.startsWith(aLast)) {
      if (aLast.length === 1 || bLast.length === 1 || editDistance(aLast, bLast) > 1) continue;
    }
    let score = 0;
    if (aw[0] === bw[0] && (a.startsWith(b) || b.startsWith(a))) score = 3;
    else if (skeleton(a) === skeleton(b)) score = 2;
    else if (Math.min(a.length, b.length) >= 3 && editDistance(a, b) <= 1) score = 1;
    if (score) scored.push({ player, score });
  }
  return scored.sort((x, y) => y.score - x.score).slice(0, 3).map((s) => s.player);
}

/**
 * When a pasted name completes an existing one ("אורי שפירא" for "אורי ש"), the fuller name to keep.
 * Only the surname is completed; extra words such as the חדפ marker never rename a player.
 */
export function fullerName(existing: string, pasted: string): string | null {
  const ew = foldName(existing).split(" ");
  const pw = foldName(pasted).split(" ");
  if (ew.length < 2 || ew.length !== pw.length || ew.slice(0, -1).join(" ") !== pw.slice(0, -1).join(" ")) return null;
  const eLast = ew[ew.length - 1];
  const pLast = pw[pw.length - 1];
  return pLast.length > eLast.length && pLast.startsWith(eLast) ? pasted.trim() : null;
}
