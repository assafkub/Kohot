import { describe, expect, it } from "vitest";
import { parseSketch } from "./sketch";

const names = (text: string) => parseSketch(text).map((t) => [t.name, t.color, ...t.players]);

describe("parseSketch", () => {
  it("reads the WhatsApp lineup with dots and uneven spaces", () => {
    const text = `*שחור*      *לבן*          *כחול*
אסי.          אוראל.         רועי
טל.            ירון.            אמיר     
שחף.         רון.            דור א
יוסי.           מתן.          כלפון
אבי.           יוסף כ.      אביב
אבנר.         פז.             דור ב
אורי.         ערן             תומר`;
    expect(names(text)).toEqual([
      ["שחור", "⚫", "אסי", "טל", "שחף", "יוסי", "אבי", "אבנר", "אורי"],
      ["לבן", "⚪", "אוראל", "ירון", "רון", "מתן", "יוסף כ", "פז", "ערן"],
      ["כחול", "🔵", "רועי", "אמיר", "דור א", "כלפון", "אביב", "דור ב", "תומר"],
    ]);
  });

  it("puts a short row's names under the nearest header", () => {
    const text = `*שחור*      *לבן*          *כחול*
אסי.          אוראל.         רועי
                            אמיר`;
    expect(names(text)[2]).toEqual(["כחול", "🔵", "רועי", "אמיר"]);
    expect(names(text)[0]).toEqual(["שחור", "⚫", "אסי"]);
  });

  it("reads teams written one under the other", () => {
    const text = `⚫ *שחורים*
1. אסי
2. טל

*כחולים* 🔵
רועי
דור א`;
    expect(names(text)).toEqual([
      ["שחורים", "⚫", "אסי", "טל"],
      ["כחולים", "🔵", "רועי", "דור א"],
    ]);
  });

  it("guesses columns when there is no header", () => {
    const text = `אסי, אוראל, רועי
טל, ירון, אמיר`;
    expect(parseSketch(text).map((t) => t.players)).toEqual([
      ["אסי", "טל"],
      ["אוראל", "ירון"],
      ["רועי", "אמיר"],
    ]);
  });

  it("splits single-spaced rows when the word count matches the teams", () => {
    expect(names(`שחור לבן\nאסי טל`)).toEqual([
      ["שחור", "⚫", "אסי"],
      ["לבן", "⚪", "טל"],
    ]);
  });

  it("keeps a header that is not a color", () => {
    expect(names(`*אסי*   *טל*\nרון   דן`)).toEqual([
      ["אסי", "", "רון"],
      ["טל", "", "דן"],
    ]);
  });
});
