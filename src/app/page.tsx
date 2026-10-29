"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useApp } from "@/components/AppProvider";
import { PasteListSheet, PlayerFormSheet } from "@/components/PlayerSheets";
import { QuickAdd } from "@/components/QuickAdd";
import { TeamBoard } from "@/components/TeamBoard";
import { btn, input, PositionTags, RatingBadge, Sheet, Spinner } from "@/components/ui";
import { balanceTeams, comparePlayersForLineup, summarizeTeam, teamSizes } from "@/lib/balance";
import { normalizeName } from "@/lib/parseList";
import { readStored, writeStored } from "@/lib/storage";
import {
  defaultGameTitle,
  DEFAULT_COLORS,
  draftKeys,
  draftSignature,
  gameTitle,
  readDraftGame,
  shortDate,
  todayIso,
  type DraftGame,
  type StoredResult,
} from "@/lib/draft";
import { shareText, toSavedTeams } from "@/lib/teams";
import { teamsImage } from "@/lib/shareImage";
import type { Player } from "@/lib/types";

// Always three teams of 7; with fewer players some teams get 6.
const TEAM_COUNT = 3;

/** none: no teams yet; draft: never saved; changed: saved, then edited; saved: matches history. */
type SaveState = "none" | "draft" | "changed" | "saved";
const FULL_TEAM = 7;

const noSubscribe = () => () => {};

export default function TodayPage() {
  const { group } = useApp();
  // The router keeps this screen alive between visits, so a draft replaced elsewhere (a game opened from history)
  // bumps a revision; the key change remounts Today, which then reads the new draft from storage.
  const revision = useSyncExternalStore(
    noSubscribe,
    () => (group ? readStored<number>(draftKeys(group.id).revision, 0) : 0),
    () => 0,
  );
  // Remount per group so attendance and results are read from that group's storage.
  return group ? <Today key={`${group.id}:${revision}`} groupId={group.id} /> : null;
}

function Today({ groupId }: { groupId: string }) {
  const { players, playersLoading, repo, toast, ask } = useApp();
  const keys = draftKeys(groupId);

  const [selected, setSelectedState] = useState<Set<string>>(() => new Set(readStored<string[]>(keys.attendance, [])));
  const [result, setResultState] = useState<StoredResult | null>(() => readStored<StoredResult | null>(keys.result, null));
  const [game, setGameState] = useState<DraftGame>(() => readDraftGame(groupId));
  const [view, setView] = useState<"pick" | "teams">(() => (result ? "teams" : "pick"));
  const [saving, setSaving] = useState(false);

  const setSelected = (next: Set<string>) => {
    setSelectedState(next);
    writeStored(keys.attendance, [...next]);
  };
  const setResult = (next: StoredResult | null) => {
    setResultState(next);
    writeStored(keys.result, next);
  };
  const setGame = (next: DraftGame) => {
    setGameState(next);
    writeStored(keys.game, next);
  };

  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const comingPlayers = useMemo(() => players.filter((p) => selected.has(p.id)), [players, selected]);
  const teams = useMemo(
    () => result?.teams.map((ids) => ids.map((id) => byId.get(id)).filter((p): p is Player => Boolean(p))) ?? null,
    [result, byId],
  );

  // The split is a draft until it is added to history on purpose; later changes then update that same game.
  const colors = result?.colors ?? DEFAULT_COLORS;
  const signature = teams ? draftSignature(game.date, game.title, teams.map((t) => t.map((p) => p.id)), colors) : null;
  const saveState: SaveState = !teams ? "none" : game.gameId && game.savedSig === signature ? "saved" : game.gameId ? "changed" : "draft";

  /** `asNew` keeps the saved version as is and adds another version of the same day. */
  const saveToHistory = async (asNew = false) => {
    if (!teams || saving) return;
    setSaving(true);
    try {
      const saved = await repo.saveGame(groupId, {
        id: asNew ? null : game.gameId,
        played_on: game.date,
        title: game.title ?? null,
        teams: toSavedTeams(teams, colors),
      });
      setGame({ ...game, gameId: saved.id, savedSig: signature, published: Boolean(saved.published_at) });
      toast(asNew ? "נשמרה גרסה חדשה ✓" : game.gameId ? "עודכן בהיסטוריה ✓" : "נוסף להיסטוריה ✓");
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // Publishing saves to history first, so players always see what is on this screen.
  const publish = async () => {
    if (!teams || saving) return;
    setSaving(true);
    try {
      const saved =
        saveState === "saved" && game.gameId
          ? null
          : await repo.saveGame(groupId, { id: game.gameId, played_on: game.date, title: game.title ?? null, teams: toSavedTeams(teams, colors) });
      const id = saved?.id ?? game.gameId!;
      if (!saved?.published_at) await repo.setGamePublished(id, true);
      setGame({ ...game, gameId: id, savedSig: signature, published: true });
      toast("פורסם לשחקנים ✓");
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const generate = (avoidKey?: string) => {
    const res = balanceTeams(comingPlayers, TEAM_COUNT, { avoidKey });
    setResult({ key: res.key, teams: res.teams.map((t) => t.players.map((p) => p.id)), colors });
    setView("teams");
    window.scrollTo({ top: 0 });
  };

  const changeDate = (date: string) => {
    if (!date) return;
    setGame({ ...game, date });
  };
  const changeTitle = (title: string) => {
    // Back to the default name when cleared or set to the default itself.
    const custom = title.trim() && title.trim() !== defaultGameTitle(game.date) ? title.trim() : null;
    setGame({ ...game, title: custom });
  };

  const newGame = async () => {
    const ok = await ask({
      title: "להתחיל כדורגל חדש?",
      message:
        saveState === "draft" || saveState === "changed"
          ? "הכוחות הנוכחיים לא נשמרו בהיסטוריה ויימחקו."
          : "רשימת היום והכוחות הנוכחיים יתאפסו.",
      confirmLabel: "חדש",
      danger: saveState === "draft" || saveState === "changed",
    });
    if (!ok) return;
    setSelected(new Set());
    setResult(null);
    setGame({ date: todayIso(), gameId: null, title: null, savedSig: null });
    setView("pick");
  };

  if (playersLoading && players.length === 0) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  const header = (
    <GameHeader
      game={game}
      saveState={saveState}
      onDate={changeDate}
      onTitle={changeTitle}
      onNew={newGame}
    />
  );

  if (view === "teams" && result && teams) {
    return (
      <>
        {header}
        <TeamsView
          teams={teams}
          onReshuffle={() => generate(result.key)}
          onBack={() => setView("pick")}
          colors={colors}
          onChange={(next) => setResult({ key: "", teams: next.map((t) => t.map((p) => p.id)), colors })}
          onColors={(next) => setResult({ ...result, colors: next })}
          canReshuffle={comingPlayers.length >= 2}
          saveState={saveState}
          saving={saving}
          onSave={saveToHistory}
          published={Boolean(game.published)}
          onPublish={publish}
        />
      </>
    );
  }

  return (
    <>
      {header}
      <PickView
        selected={selected}
        setSelected={setSelected}
        onGenerate={() => generate(result?.key)}
        hasResult={Boolean(result)}
        onShowResult={() => setView("teams")}
      />
    </>
  );
}

/** The game being prepared: its name (editable), date, save status, and a way to start the next one. */
function GameHeader({
  game,
  saveState,
  onDate,
  onTitle,
  onNew,
}: {
  game: DraftGame;
  saveState: SaveState;
  onDate(date: string): void;
  onTitle(title: string): void;
  onNew(): void;
}) {
  const title = gameTitle({ title: game.title, played_on: game.date });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const save = () => {
    setEditing(false);
    if (draft.trim() !== title) onTitle(draft);
  };

  return (
    <div className="mb-4 rounded-2xl bg-emerald-800 px-4 py-3 text-white shadow-sm">
      <div className="flex items-center gap-2">
        {editing ? (
          <input
            autoFocus
            value={draft}
            maxLength={60}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setEditing(false);
            }}
            className="min-w-0 flex-1 rounded-lg bg-white/15 px-2 py-1 text-lg font-black text-white outline-none placeholder:text-emerald-200"
            placeholder={defaultGameTitle(game.date)}
            aria-label="שם המשחק"
          />
        ) : (
          <button
            onClick={() => {
              setDraft(title);
              setEditing(true);
            }}
            className="min-w-0 flex-1 truncate text-start text-lg leading-tight font-black"
            aria-label="שינוי השם"
          >
            {title} <span className="text-sm font-normal text-emerald-200">✎</span>
          </button>
        )}
        <button onClick={onNew} className="shrink-0 rounded-xl bg-white/15 px-3 py-1.5 text-sm font-bold active:bg-white/25">
          + חדש
        </button>
      </div>
      <div className="mt-1 flex items-center gap-3 text-xs text-emerald-200">
        <label className="relative cursor-pointer rounded-md bg-white/10 px-2 py-0.5">
          📅 {shortDate(game.date)} ▾
          <input
            type="date"
            value={game.date}
            onChange={(e) => onDate(e.target.value)}
            className="absolute inset-0 opacity-0"
            aria-label="תאריך"
          />
        </label>
        <span>
          {saveState === "saved"
            ? "✓ שמור בהיסטוריה"
            : saveState === "changed"
              ? "יש שינויים שלא נשמרו"
              : saveState === "draft"
                ? "טיוטה, עוד לא בהיסטוריה"
                : ""}
        </span>
      </div>
    </div>
  );
}

function PickView({
  selected,
  setSelected,
  onGenerate,
  hasResult,
  onShowResult,
}: {
  selected: Set<string>;
  setSelected(next: Set<string>): void;
  onGenerate(): void;
  hasResult: boolean;
  onShowResult(): void;
}) {
  const { players, ask } = useApp();
  const [pasteOpen, setPasteOpen] = useState(false);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [editing, setEditing] = useState<Player | null>(null);

  // The screen shows only today's list; the rest of the roster is one tap away in the roster sheet.
  const coming = players.filter((p) => selected.has(p.id));
  const count = coming.length;
  const canGenerate = count >= TEAM_COUNT * 2;
  const sizeLabel = canGenerate ? teamSizes(count, TEAM_COUNT).join("·") : "";
  const missing = TEAM_COUNT * FULL_TEAM - count;

  const remove = (id: string) => {
    const next = new Set(selected);
    next.delete(id);
    setSelected(next);
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">מי מגיע היום?</h1>
          <p className="text-sm text-zinc-500">
            <b className="text-emerald-700">{count}</b> ברשימה
          </p>
        </div>
        {count > 0 && (
          <button
            className={btn.ghost}
            onClick={() => {
              ask({ title: "לנקות את רשימת היום?", message: "השחקנים יישארו שמורים במאגר.", confirmLabel: "ניקוי" }).then(
                (ok) => {
                  if (ok) setSelected(new Set());
                },
              );
            }}
          >
            🧹 ניקוי
          </button>
        )}
      </header>

      <div className="grid grid-cols-2 gap-2">
        <button className={btn.secondary} onClick={() => setPasteOpen(true)}>
          📋 הדבקת רשימה
        </button>
        <button className={btn.secondary} onClick={() => setRosterOpen(true)}>
          👥 מהמאגר
        </button>
      </div>

      {hasResult && (
        <button className={`${btn.secondary} w-full`} onClick={onShowResult}>
          👀 לקבוצות האחרונות
        </button>
      )}

      <QuickAdd onAdded={(p) => setSelected(new Set(selected).add(p.id))} />

      {count === 0 ? (
        <div className="rounded-3xl bg-white p-8 text-center text-zinc-500">
          <div className="text-4xl">⚽</div>
          <p className="mt-2">הרשימה ריקה. הדביקו את רשימת המגיעים מהוואטסאפ, בחרו מהמאגר, או הוסיפו שם בשורה למעלה.</p>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-100 overflow-hidden rounded-3xl bg-white shadow-sm">
          {coming.map((p) => (
            <li key={p.id} className="flex items-center">
              <button onClick={() => setEditing(p)} className="flex min-w-0 flex-1 items-center gap-3 py-2.5 ps-4 pe-2 text-start active:bg-zinc-50">
                <RatingBadge rating={p.rating} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{p.name}</span>
                  <PositionTags positions={p.positions} />
                </span>
              </button>
              <button
                onClick={() => remove(p.id)}
                className="self-stretch px-4 text-lg text-zinc-400 active:bg-red-50 active:text-red-600"
                aria-label={`הסרת ${p.name} מהרשימה`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="pb-safe fixed inset-x-0 bottom-16 z-20 border-t border-zinc-200 bg-white/95 px-4 pt-3 backdrop-blur">
        <div className="mx-auto max-w-lg space-y-2">
          <p className="text-center text-sm text-zinc-600">
            {missing > 0 ? (
              <>
                <b>{count}</b> מתוך {TEAM_COUNT * FULL_TEAM} · חסרים {missing} ל-3 קבוצות מלאות
              </>
            ) : missing === 0 ? (
              <span className="font-semibold text-emerald-700">✓ 21 שחקנים, 3 קבוצות של 7</span>
            ) : (
              <span className="font-semibold text-amber-700">
                {count} שחקנים, {-missing} מעל 21 (יהיו קבוצות של 8)
              </span>
            )}
          </p>
          <button className={`${btn.primary} w-full text-lg`} disabled={!canGenerate} onClick={onGenerate}>
            {canGenerate ? `⚽ חלק ל-3 קבוצות (${sizeLabel})` : `בחרו לפחות ${TEAM_COUNT * 2} שחקנים`}
          </button>
        </div>
      </div>
      <div className="h-28" />

      <PasteListSheet
        open={pasteOpen}
        onClose={() => setPasteOpen(false)}
        confirmLabel="סימון כמגיעים"
        onDone={(ids) => setSelected(new Set([...selected, ...ids]))}
      />
      <PlayerFormSheet open={Boolean(editing)} player={editing} onClose={() => setEditing(null)} />
      <RosterSheet
        open={rosterOpen}
        onClose={() => setRosterOpen(false)}
        exclude={selected}
        onAdd={(ids) => setSelected(new Set([...selected, ...ids]))}
      />
    </div>
  );
}

/** Pick regulars from the saved roster to add to today's list. */
function RosterSheet({
  open,
  onClose,
  exclude,
  onAdd,
}: {
  open: boolean;
  onClose(): void;
  exclude: Set<string>;
  onAdd(ids: string[]): void;
}) {
  const { players } = useApp();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const q = normalizeName(query);
  const available = players.filter((p) => !exclude.has(p.id));
  const visible = q ? available.filter((p) => normalizeName(p.name).includes(q)) : available;

  const close = () => {
    setQuery("");
    setPicked(new Set());
    onClose();
  };
  const toggle = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };

  return (
    <Sheet open={open} onClose={close} title="הוספה מהמאגר">
      {available.length === 0 ? (
        <p className="py-6 text-center text-zinc-500">כל השחקנים במאגר כבר ברשימת היום.</p>
      ) : (
        <>
          {available.length > 10 && (
            <input className={`${input} mb-3`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="🔍 חיפוש" type="search" />
          )}
          <ul className="grid grid-cols-2 gap-1.5">
            {visible.map((p) => {
              const on = picked.has(p.id);
              return (
                <li key={p.id}>
                  <label
                    className={`flex cursor-pointer items-center gap-2 rounded-xl px-2 py-2 text-sm ${on ? "bg-emerald-700 text-white" : "bg-zinc-50"}`}
                  >
                    <input type="checkbox" className="h-4 w-4 shrink-0 accent-white" checked={on} onChange={() => toggle(p.id)} />
                    <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
                    <RatingBadge rating={p.rating} />
                  </label>
                </li>
              );
            })}
          </ul>
          <button
            className={`${btn.primary} mt-4 w-full`}
            disabled={picked.size === 0}
            onClick={() => {
              onAdd([...picked]);
              close();
            }}
          >
            הוספה לרשימת היום{picked.size ? ` (${picked.size})` : ""}
          </button>
        </>
      )}
    </Sheet>
  );
}

function TeamsView({
  teams,
  onReshuffle,
  onBack,
  colors,
  onChange,
  onColors,
  canReshuffle,
  saveState,
  saving,
  onSave,
  published,
  onPublish,
}: {
  teams: Player[][];
  onReshuffle(): void;
  onBack(): void;
  colors: number[];
  onChange(teams: Player[][]): void;
  onColors(colors: number[]): void;
  canReshuffle: boolean;
  saveState: SaveState;
  saving: boolean;
  onSave(asNew?: boolean): void;
  published: boolean;
  onPublish(): void;
}) {
  const { toast } = useApp();
  const [picked, setPicked] = useState<string | null>(null);

  const summaries = teams.map(summarizeTeam);
  const averages = summaries.map((s) => s.average);
  const avgGap = averages.length ? Math.max(...averages) - Math.min(...averages) : 0;

  const text = () => shareText(toSavedTeams(teams, colors));

  const tapPlayer = (id: string) => {
    if (!picked || picked === id) {
      setPicked(picked === id ? null : id);
      return;
    }
    const from = teams.findIndex((t) => t.some((p) => p.id === picked));
    const to = teams.findIndex((t) => t.some((p) => p.id === id));
    if (from === to) {
      setPicked(id);
      return;
    }
    const next = teams.map((t) => t.slice());
    const a = next[from].findIndex((p) => p.id === picked);
    const b = next[to].findIndex((p) => p.id === id);
    [next[from][a], next[to][b]] = [next[to][b], next[from][a]];
    // The two teams stay ordered by rating after a swap.
    next[from].sort(comparePlayersForLineup);
    next[to].sort(comparePlayersForLineup);
    onChange(next);
    setPicked(null);
  };

  const [shareOpen, setShareOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);

  const shareAsText = async () => {
    setShareOpen(false);
    if (navigator.share) {
      try {
        await navigator.share({ text: text() });
        return;
      } catch {
        // cancelled or unsupported; fall back to WhatsApp link
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text())}`, "_blank");
  };

  // A picture of the teams side by side; where pictures can't be shared, it is downloaded instead.
  const shareAsImage = async () => {
    setShareOpen(false);
    let file: File;
    try {
      file = new File([await teamsImage(toSavedTeams(teams, colors))], "kohot.png", { type: "image/png" });
    } catch (e) {
      toast((e as Error).message);
      return;
    }
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
      } catch {
        // cancelled
      }
      return;
    }
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = "kohot.png";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("התמונה ירדה למכשיר");
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">הכוחות</h1>
          <p className="text-sm text-zinc-500">
            הפרש ממוצעים: <b className={avgGap <= 0.25 ? "text-emerald-700" : "text-amber-700"}>{avgGap.toFixed(2)}</b>
          </p>
        </div>
        <button className={btn.ghost} onClick={onBack}>
          ✎ מי מגיע
        </button>
      </header>

      <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
        {picked
          ? "עכשיו לחצו על שחקן בקבוצה אחרת כדי להחליף ביניהם"
          : "החלפת שחקנים: לחיצה ארוכה על שחקן וגרירה על שחקן מקבוצה אחרת, או לחיצה על שניהם. החלפת צבע: אותו דבר עם כותרת הקבוצה."}
      </p>

      <TeamBoard teams={teams} colors={colors} picked={picked} onTap={tapPlayer} onChange={onChange} onColors={onColors} />

      <div className="pb-safe fixed inset-x-0 bottom-16 z-20 border-t border-zinc-200 bg-white/95 px-4 pt-3 backdrop-blur">
        <div className="mx-auto grid max-w-lg grid-cols-2 gap-2">
          <button className={btn.secondary} onClick={onReshuffle} disabled={!canReshuffle}>
            🎲 ערבוב מחדש
          </button>
          <button
            className={btn.primary}
            onClick={() => (saveState === "changed" ? setSaveOpen(true) : onSave())}
            disabled={saving || saveState === "saved"}
          >
            {saving ? "שומר…" : saveState === "saved" ? "✓ בהיסטוריה" : saveState === "changed" ? "💾 שמירה" : "💾 להיסטוריה"}
          </button>
          <button className={btn.secondary} onClick={() => setShareOpen(true)}>
            📤 שיתוף
          </button>
          <button className={btn.secondary} onClick={() => navigator.clipboard?.writeText(text()).then(() => toast("הועתק ✓"))}>
            📄 העתקה
          </button>
        </div>
      </div>
      <div className="h-36" />

      {/* Changed after saving: either a new version of this day, or replace the saved one. */}
      <Sheet open={saveOpen} onClose={() => setSaveOpen(false)} title="שמירה בהיסטוריה">
        <div className="grid gap-2">
          <button
            className={btn.primary}
            onClick={() => {
              setSaveOpen(false);
              onSave(true);
            }}
          >
            ➕ שמירה כגרסה חדשה
          </button>
          <button
            className={btn.secondary}
            onClick={() => {
              setSaveOpen(false);
              onSave(false);
            }}
          >
            ✎ עדכון הגרסה השמורה{published ? " (המפורסמת)" : ""}
          </button>
          <p className="text-xs text-zinc-500">כל הגרסאות של היום נשמרות בהיסטוריה, ורק אחת מהן מפורסמת לשחקנים.</p>
        </div>
      </Sheet>

      <Sheet open={shareOpen} onClose={() => setShareOpen(false)} title="שיתוף הכוחות">
        <div className="grid grid-cols-2 gap-2">
          <button className={btn.secondary} onClick={shareAsImage}>
            🖼️ כתמונה
          </button>
          <button className={btn.secondary} onClick={shareAsText}>
            📝 כטקסט
          </button>
          <button
            className={`${btn.primary} col-span-2`}
            disabled={saving || (published && saveState === "saved")}
            onClick={() => {
              setShareOpen(false);
              onPublish();
            }}
          >
            {published && saveState === "saved" ? "✓ פורסם לשחקנים באפליקציה" : published ? "📢 עדכון לשחקנים באפליקציה" : "📢 פרסום לשחקנים באפליקציה"}
          </button>
        </div>
      </Sheet>
    </div>
  );
}
