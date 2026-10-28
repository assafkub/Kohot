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

/**
 * Parses a pasted list (e.g. a WhatsApp attendance message), one player per line.
 * Accepts numbering ("1. ", "2) "), bullets, emojis and an optional trailing rating ("דני 5.5").
 */
export function parsePlayerList(text: string): ParsedLine[] {
  const seen = new Set<string>();
  const result: ParsedLine[] = [];
  for (const raw of text.split(/\r?\n|,/)) {
    let line = raw
      .replace(/[\p{Extended_Pictographic}‍️]/gu, " ")
      .replace(/^\s*(\d{1,2}\s*[.)\-:]|[-*•·])\s*/u, "")
      .trim();
    let rating: number | undefined;
    const ratingMatch = line.match(/[\s\-:(]+([1-7](?:\.5|\.0)?)\s*\)?\s*$/);
    if (ratingMatch) {
      rating = clampRating(parseFloat(ratingMatch[1]));
      line = line.slice(0, ratingMatch.index).trim();
    }
    line = line.replace(/[\s\-:]+$/, "").trim();
    const key = normalizeName(line);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(rating === undefined ? { name: line } : { name: line, rating });
  }
  return result;
}
