"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { PasteListSheet, PlayerFormSheet } from "@/components/PlayerSheets";
import { QuickAdd } from "@/components/QuickAdd";
import { TeamBoard } from "@/components/TeamBoard";
import { btn, input, PositionTags, RatingBadge, Sheet, Spinner } from "@/components/ui";
import { balanceTeams, summarizeTeam, teamSizes } from "@/lib/balance";
import { normalizeName } from "@/lib/parseList";
import { readStored, writeStored } from "@/lib/storage";
import { shareText, teamStyle } from "@/lib/teams";
import type { Player, SavedTeam } from "@/lib/types";

// Always three teams of 7; with fewer players some teams get 6.
const TEAM_COUNT = 3;
const FULL_TEAM = 7;

interface StoredResult {
  key: string;
  teams: string[][];
}

export default function TodayPage() {
  const { group } = useApp();
  // Remount per group so attendance and results are read from that group's storage.
  return group ? <Today key={group.id} groupId={group.id} /> : null;
}

function Today({ groupId }: { groupId: string }) {
  const { players, playersLoading } = useApp();
  const attendanceKey = `kohot:attendance:${groupId}`;
  const resultKey = `kohot:result:${groupId}`;

  const [selected, setSelectedState] = useState<Set<string>>(() => new Set(readStored<string[]>(attendanceKey, [])));
  const [result, setResultState] = useState<StoredResult | null>(() => readStored<StoredResult | null>(resultKey, null));
  const [view, setView] = useState<"pick" | "teams">(() => (result ? "teams" : "pick"));

  const setSelected = (next: Set<string>) => {
    setSelectedState(next);
    writeStored(attendanceKey, [...next]);
  };
  const setResult = (next: StoredResult | null) => {
    setResultState(next);
    writeStored(resultKey, next);
  };

  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const comingPlayers = useMemo(() => players.filter((p) => selected.has(p.id)), [players, selected]);

  const generate = (avoidKey?: string) => {
    const res = balanceTeams(comingPlayers, TEAM_COUNT, { avoidKey });
    setResult({ key: res.key, teams: res.teams.map((t) => t.players.map((p) => p.id)) });
    setView("teams");
    window.scrollTo({ top: 0 });
  };

  if (playersLoading && players.length === 0) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (view === "teams" && result) {
    const teams = result.teams.map((ids) => ids.map((id) => byId.get(id)).filter((p): p is Player => Boolean(p)));
    return (
      <TeamsView
        teams={teams}
        onReshuffle={() => generate(result.key)}
        onBack={() => setView("pick")}
        onChange={(next) => setResult({ key: "", teams: next.map((t) => t.map((p) => p.id)) })}
        canReshuffle={comingPlayers.length >= 2}
      />
    );
  }

  return (
    <PickView
      selected={selected}
      setSelected={setSelected}
      onGenerate={() => generate(result?.key)}
      hasResult={Boolean(result)}
      onShowResult={() => setView("teams")}
    />
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
  const { players } = useApp();
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
              if (confirm("לנקות את רשימת היום? השחקנים יישארו שמורים במאגר.")) setSelected(new Set());
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
  const available = players.filter((p) => p.active && !exclude.has(p.id));
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
  onChange,
  canReshuffle,
}: {
  teams: Player[][];
  onReshuffle(): void;
  onBack(): void;
  onChange(teams: Player[][]): void;
  canReshuffle: boolean;
}) {
  const { group, repo, toast } = useApp();
  const [picked, setPicked] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const summaries = teams.map(summarizeTeam);
  const averages = summaries.map((s) => s.average);
  const avgGap = averages.length ? Math.max(...averages) - Math.min(...averages) : 0;

  const saved = (): SavedTeam[] =>
    teams.map((players, i) => ({
      name: teamStyle(i).name,
      color: teamStyle(i).emoji,
      total: summaries[i].total,
      players: players.map(({ id, name, rating, positions }) => ({ id, name, rating, positions })),
    }));

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
    onChange(next);
    setPicked(null);
  };

  const share = async () => {
    const text = shareText(saved());
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        // cancelled or unsupported; fall back to WhatsApp link
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
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
          : "החלפת שחקנים: לחיצה ארוכה על שחקן וגרירה על שחקן מקבוצה אחרת, או לחיצה על שניהם."}
      </p>

      <TeamBoard teams={teams} picked={picked} onTap={tapPlayer} onChange={onChange} />

      <div className="pb-safe fixed inset-x-0 bottom-16 z-20 border-t border-zinc-200 bg-white/95 px-4 pt-3 backdrop-blur">
        <div className="mx-auto grid max-w-lg grid-cols-3 gap-2">
          <button className={`${btn.primary} col-span-3`} onClick={onReshuffle} disabled={!canReshuffle}>
            🎲 ערבוב מחדש
          </button>
          <button className={btn.secondary} onClick={share}>
            📤 שיתוף
          </button>
          <button
            className={btn.secondary}
            onClick={() => navigator.clipboard?.writeText(shareText(saved())).then(() => toast("הועתק ✓"))}
          >
            📄 העתקה
          </button>
          <button
            className={btn.secondary}
            disabled={saving}
            onClick={() => {
              if (!group) return;
              setSaving(true);
              repo
                .saveGame(group.id, saved())
                .then(() => toast("המשחק נשמר בהיסטוריה ✓"))
                .catch((e: Error) => toast(e.message))
                .finally(() => setSaving(false));
            }}
          >
            💾 שמירה
          </button>
        </div>
      </div>
      <div className="h-36" />
    </div>
  );
}
