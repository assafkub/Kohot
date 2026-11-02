"use client";

import { useState } from "react";
import { useApp } from "@/components/AppProvider";
import { btn, input } from "@/components/ui";
import { downloadBlob, shareOrDownload, teamsImage } from "@/lib/shareImage";
import { NO_COLOR, parseSketch, SKETCH_COLORS, sketchColor, type SketchTeam } from "@/lib/sketch";

const EXAMPLE = `*שחור*      *לבן*          *כחול*
אסי.          אוראל.         רועי
טל.            ירון.            אמיר`;

const label = (t: SketchTeam, i: number) => t.name.trim() || sketchColor(t.color).word || `קבוצה ${i + 1}`;

/**
 * Lineups that came from somewhere else (a WhatsApp message): paste the text, get neat team columns, fix what the guess
 * got wrong, and share them as a picture. Nothing is saved, and the names are not matched to the roster.
 */
export default function SketchPage() {
  const { toast } = useApp();
  const [text, setText] = useState("");
  const [teams, setTeams] = useState<SketchTeam[]>([]);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const read = (value: string) => {
    setText(value);
    setTeams(parseSketch(value));
  };

  const pasteFromClipboard = async () => {
    try {
      const value = await navigator.clipboard.readText();
      if (value.trim()) read(value);
      else toast("הלוח ריק");
    } catch {
      toast("אין גישה ללוח, הדביקו בתיבה עם לחיצה ארוכה");
    }
  };

  const update = (i: number, change: Partial<SketchTeam>) => setTeams((list) => list.map((t, k) => (k === i ? { ...t, ...change } : t)));
  // What the preview and picture show: names as typed in the editor, without empty lines or empty teams.
  const nonEmpty = teams
    .map((t) => ({ ...t, players: t.players.map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean) }))
    .filter((t) => t.players.length || t.name.trim());

  const image = () =>
    teamsImage(
      nonEmpty.map((t) => ({ ...t, players: t.players.map((name) => ({ name })) })),
      (_, i) => label(nonEmpty[i], i),
    );

  const share = async () => {
    setBusy(true);
    try {
      if ((await shareOrDownload(await image())) === "downloaded") toast("התמונה ירדה למכשיר");
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    setBusy(true);
    try {
      downloadBlob(await image(), "kohot.png");
      toast("התמונה ירדה למכשיר");
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-black">סקיצה לתמונה</h1>
        <p className="text-sm text-zinc-500">מדביקים כוחות שקיבלתם בוואטסאפ, ומקבלים טבלה מסודרת לשיתוף כתמונה. שום דבר לא נשמר.</p>
      </header>

      <div className="space-y-2">
        <textarea
          className={`${input} h-40 resize-y text-sm leading-6`}
          value={text}
          onChange={(e) => read(e.target.value)}
          placeholder={EXAMPLE}
          aria-label="טקסט הכוחות"
        />
        <div className="flex gap-2">
          <button className={`${btn.secondary} flex-1`} onClick={pasteFromClipboard}>
            📋 הדבקה מהלוח
          </button>
          {text && (
            <button className={btn.danger} onClick={() => read("")}>
              ניקוי
            </button>
          )}
        </div>
      </div>

      {teams.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="font-bold">
              {teams.length} קבוצות · {nonEmpty.reduce((s, t) => s + t.players.length, 0)} שחקנים
            </h2>
            <button className={btn.ghost} onClick={() => setEditing((v) => !v)}>
              {editing ? "✓ סיום תיקון" : "✎ תיקון"}
            </button>
          </div>

          {editing ? (
            <TeamEditor teams={teams} update={update} setTeams={setTeams} />
          ) : (
            <Preview teams={nonEmpty} />
          )}

          {!editing && <p className="text-xs text-zinc-500">משהו לא במקום? ✎ תיקון: שינוי שם או צבע, והזזת שמות בין הקבוצות (שורה לכל שחקן).</p>}

          <div className="pb-safe fixed inset-x-0 bottom-16 z-20 border-t border-zinc-200 bg-white/95 px-4 pt-3 backdrop-blur">
            <div className="mx-auto grid max-w-lg grid-cols-[2fr_1fr] gap-2">
              <button className={btn.primary} onClick={share} disabled={busy || !nonEmpty.length}>
                🖼️ שיתוף כתמונה
              </button>
              <button className={btn.secondary} onClick={download} disabled={busy || !nonEmpty.length}>
                ⬇️ הורדה
              </button>
            </div>
          </div>
          <div className="h-20" />
        </>
      )}

      {text.trim() && !teams.length && <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">לא מצאתי כאן שמות. נסו להדביק את הרשימה כמו שהיא.</p>}
    </div>
  );
}

/** The teams as they will look in the picture. */
function Preview({ teams }: { teams: SketchTeam[] }) {
  return (
    <div className="grid items-start gap-1.5" style={{ gridTemplateColumns: `repeat(${teams.length}, minmax(0, 1fr))` }}>
      {teams.map((t, i) => {
        const c: { bg: string; fg: string; border?: string } = sketchColor(t.color);
        return (
          <section key={i} className="min-w-0 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-zinc-100">
            <h3 title={label(t, i)}
              className="truncate px-2 py-2 text-center text-base font-black"
              style={{ background: c.bg, color: c.fg, boxShadow: c.border ? `inset 0 0 0 1px ${c.border}` : undefined }}
            >
              {label(t, i)}
            </h3>
            <ul className="divide-y divide-zinc-50">
              {t.players.map((p, j) => (
                <li key={j} className="truncate px-1.5 py-2 text-center text-sm font-semibold">
                  {p}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function TeamEditor({
  teams,
  update,
  setTeams,
}: {
  teams: SketchTeam[];
  update(i: number, change: Partial<SketchTeam>): void;
  setTeams(fn: (list: SketchTeam[]) => SketchTeam[]): void;
}) {
  return (
    <div className="space-y-3">
      {teams.map((t, i) => (
        <section key={i} className="space-y-2 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-zinc-100">
          <div className="flex items-center gap-2">
            <input className={`${input} py-2 font-bold`} value={t.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="שם הקבוצה" />
            <button
              className="shrink-0 rounded-xl px-2 py-2 text-sm text-red-700 active:bg-red-50"
              onClick={() => setTeams((list) => list.filter((_, k) => k !== i))}
              aria-label="מחיקת הקבוצה"
            >
              🗑️
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[...SKETCH_COLORS, NO_COLOR].map((c) => (
              <button
                key={c.emoji || "none"}
                onClick={() => update(i, { color: c.emoji, name: !t.name.trim() || isColorWord(t.name) ? c.word : t.name })}
                className={`h-8 w-8 rounded-full ring-2 ${t.color === c.emoji ? "ring-emerald-600 ring-offset-2" : "ring-zinc-200"}`}
                style={{ background: c.bg }}
                aria-label={c.word || "בלי צבע"}
                aria-pressed={t.color === c.emoji}
              />
            ))}
          </div>
          <textarea
            className={`${input} resize-y text-sm leading-6`}
            rows={Math.max(4, t.players.length + 1)}
            // Kept as typed (empty lines too, so Enter works anywhere); the preview and picture skip empty lines.
            value={t.players.join("\n")}
            onChange={(e) => update(i, { players: e.target.value.split("\n") })}
            aria-label={`שחקני ${t.name}`}
          />
        </section>
      ))}
      <button className={`${btn.secondary} w-full`} onClick={() => setTeams((list) => [...list, { name: "", color: "", players: [] }])}>
        ➕ קבוצה
      </button>
    </div>
  );
}

function isColorWord(name: string): boolean {
  return SKETCH_COLORS.some((c) => c.word === name.trim());
}
