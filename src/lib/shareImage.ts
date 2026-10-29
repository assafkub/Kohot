import { shareColorWord } from "./teams";
import type { SavedTeam } from "./types";

// Colors of each team header in the shared picture, by the team's emoji.
const HEADER: Record<string, { bg: string; fg: string; border?: string }> = {
  "⚫": { bg: "#18181b", fg: "#ffffff" },
  "🔵": { bg: "#2563eb", fg: "#ffffff" },
  "⚪": { bg: "#ffffff", fg: "#18181b", border: "#d4d4d8" },
};

const COL = 340;
const GAP = 16;
const PAD = 32;
const HEAD_H = 72;
const ROW_H = 58;

function fit(ctx: CanvasRenderingContext2D, text: string, width: number): string {
  if (ctx.measureText(text).width <= width) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > width) t = t.slice(0, -1);
  return `${t}…`;
}

/**
 * The teams as a picture: one column per team, side by side, first team on the right as on the screen,
 * the color on top and the players' names below. Nothing else: no ratings, icons, numbers or title.
 */
export async function teamsImage(teams: SavedTeam[]): Promise<Blob> {
  await document.fonts?.ready;
  const font = getComputedStyle(document.body).fontFamily || "sans-serif";
  const rows = Math.max(0, ...teams.map((t) => t.players.length));
  const width = PAD * 2 + teams.length * COL + (teams.length - 1) * GAP;
  const height = PAD + HEAD_H + rows * ROW_H + PAD;
  const scale = 2;

  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.direction = "rtl";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";

  ctx.fillStyle = "#f4f4f5";
  ctx.fillRect(0, 0, width, height);

  teams.forEach((team, i) => {
    const x = width - PAD - (i + 1) * COL - i * GAP;
    const top = PAD;
    const style = HEADER[team.color] ?? HEADER["⚪"];

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(x, top, COL, HEAD_H + rows * ROW_H, 20);
    ctx.fill();

    ctx.beginPath();
    ctx.roundRect(x, top, COL, HEAD_H, [20, 20, 0, 0]);
    ctx.fillStyle = style.bg;
    ctx.fill();
    if (style.border) {
      ctx.strokeStyle = style.border;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.fillStyle = style.fg;
    ctx.font = `900 32px ${font}`;
    ctx.fillText(shareColorWord(team, i), x + COL / 2, top + HEAD_H / 2);

    ctx.font = `600 27px ${font}`;
    team.players.forEach((p, r) => {
      const y = top + HEAD_H + r * ROW_H;
      if (r > 0) {
        ctx.fillStyle = "#f4f4f5";
        ctx.fillRect(x + 16, y, COL - 32, 2);
      }
      ctx.fillStyle = "#18181b";
      ctx.fillText(fit(ctx, p.name, COL - 32), x + COL / 2, y + ROW_H / 2);
    });
  });

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("לא הצלחתי ליצור תמונה"))), "image/png"),
  );
}
