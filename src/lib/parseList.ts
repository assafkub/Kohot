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

const LIST_MARKER = /^\s*(\d{1,2}\s*[.)\-:]|[-*•·▪◦‣])\s*/u;
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
  if (LINK.test(raw) || PAYMENT.test(raw)) return null;
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

/**
 * Finds the existing player a pasted name refers to: exact match first, then a unique match on
 * the first word(s), so "דור ב" finds "דור ב" and "אביב" finds "אביב דהן" when there is only one אביב.
 */
export function matchPlayer<P extends { name: string }>(name: string, players: P[]): P | undefined {
  const key = normalizeName(name);
  const exact = players.find((p) => normalizeName(p.name) === key);
  if (exact) return exact;
  const first = key.split(" ")[0];
  const sameFirst = players.filter((p) => normalizeName(p.name).split(" ")[0] === first);
  if (sameFirst.length !== 1) return undefined;
  const candidate = normalizeName(sameFirst[0].name);
  // Only when one name is a prefix of the other ("אביב" ↔ "אביב דהן"), not "דור ב" vs "דור א".
  return candidate.startsWith(key) || key.startsWith(candidate) ? sameFirst[0] : undefined;
}
