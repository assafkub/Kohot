"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { PasteListSheet, PlayerFormSheet } from "@/components/PlayerSheets";
import { QuickAdd } from "@/components/QuickAdd";
import { btn, input, PositionTags, RatingBadge, Spinner } from "@/components/ui";
import { balanceTeams, suggestTeamCount, summarizeTeam, teamSizes } from "@/lib/balance";
import { normalizeName } from "@/lib/parseList";
import { readStored, writeStored } from "@/lib/storage";
import { positionSummary, shareText, teamStyle } from "@/lib/teams";
import { formatRating, type Player, type SavedTeam } from "@/lib/types";

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
  const [teamCountChoice, setTeamCountChoice] = useState<number | null>(null);

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
  const teamCount = teamCountChoice ?? suggestTeamCount(comingPlayers.length);

  const generate = (avoidKey?: string) => {
    const res = balanceTeams(comingPlayers, teamCount, { avoidKey });
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
      teamCount={teamCount}
      setTeamCount={setTeamCountChoice}
      onGenerate={() => generate(result?.key)}
      hasResult={Boolean(result)}
      onShowResult={() => setView("teams")}
    />
  );
}

function PickView({
  selected,
  setSelected,
  teamCount,
  setTeamCount,
  onGenerate,
  hasResult,
  onShowResult,
}: {
  selected: Set<string>;
  setSelected(next: Set<string>): void;
  teamCount: number;
  setTeamCount(n: number): void;
  onGenerate(): void;
  hasResult: boolean;
  onShowResult(): void;
}) {
  const { players } = useApp();
  const [query, setQuery] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [editing, setEditing] = useState<Player | null>(null);

  const active = players.filter((p) => p.active || selected.has(p.id));
  const count = players.filter((p) => selected.has(p.id)).length;
  const q = normalizeName(query);
  const visible = q ? active.filter((p) => normalizeName(p.name).includes(q)) : active;
  const sizes = count >= teamCount ? teamSizes(count, teamCount) : [];
  const sizeLabel = sizes.length ? [...new Set(sizes)].join("/") : "";
  const canGenerate = count >= teamCount * 2;

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">מי מגיע היום?</h1>
          <p className="text-sm text-zinc-500">
            נבחרו <b className="text-emerald-700">{count}</b> מתוך {active.length}
          </p>
        </div>
        <div className="flex gap-1">
          <button className={btn.ghost} onClick={() => setPasteOpen(true)}>
            📋 הדבקה
          </button>
          {count > 0 && (
            <button className={btn.ghost} onClick={() => setSelected(new Set())}>
              ניקוי
            </button>
          )}
        </div>
      </header>

      {hasResult && (
        <button className={`${btn.secondary} w-full`} onClick={onShowResult}>
          👀 לקבוצות האחרונות
        </button>
      )}

      <QuickAdd onAdded={(p) => setSelected(new Set(selected).add(p.id))} />

      {active.length > 10 && (
        <input className={input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="🔍 חיפוש" type="search" />
      )}

      {active.length === 0 ? (
        <div className="rounded-3xl bg-white p-8 text-center text-zinc-500">
          <div className="text-4xl">⚽</div>
          <p className="mt-2">הוסיפו שחקנים בשורה למעלה, או הדביקו את רשימת המגיעים מהוואטסאפ.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-2">
          {visible.map((p) => {
            const on = selected.has(p.id);
            return (
              <li key={p.id} className="flex items-stretch">
                <button
                  onClick={() => toggle(p.id)}
                  aria-pressed={on}
                  className={`flex flex-1 items-center gap-3 rounded-s-2xl px-3 py-2.5 text-start transition ${
                    on ? "bg-emerald-700 text-white" : "bg-white"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-sm ${
                      on ? "border-white bg-white text-emerald-700" : "border-zinc-300"
                    }`}
                  >
                    {on ? "✓" : ""}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{p.name}</span>
                    {!on && <PositionTags positions={p.positions} />}
                  </span>
                  <RatingBadge rating={p.rating} />
                </button>
                <button
                  onClick={() => setEditing(p)}
                  className={`rounded-e-2xl border-s px-3 text-zinc-400 ${on ? "border-emerald-600 bg-emerald-700 text-emerald-100" : "border-zinc-100 bg-white"}`}
                  aria-label={`עריכת ${p.name}`}
                >
                  ✎
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="pb-safe fixed inset-x-0 bottom-16 z-20 border-t border-zinc-200 bg-white/95 px-4 pt-3 backdrop-blur">
        <div className="mx-auto max-w-lg space-y-2">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="font-semibold text-zinc-600">מספר קבוצות</span>
            <div className="flex gap-1.5">
              {[2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setTeamCount(n)}
                  className={`h-9 w-9 rounded-xl font-bold ${n === teamCount ? "bg-emerald-700 text-white" : "bg-zinc-100 text-zinc-700"}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <button className={`${btn.primary} w-full text-lg`} disabled={!canGenerate} onClick={onGenerate}>
            {canGenerate ? `⚽ חלק ל-${teamCount} קבוצות (${sizeLabel})` : `בחרו לפחות ${teamCount * 2} שחקנים`}
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
    </div>
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
        {picked ? "עכשיו לחצו על שחקן בקבוצה אחרת כדי להחליף ביניהם" : "רוצים להחליף שחקנים? לחצו על שחקן ואז על שחקן מקבוצה אחרת."}
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {teams.map((players, i) => {
          const style = teamStyle(i);
          const s = summaries[i];
          return (
            <section key={i} className="overflow-hidden rounded-3xl bg-white shadow-sm">
              <div className={`flex items-center justify-between px-4 py-3 ${style.header}`}>
                <h2 className="flex items-center gap-2 text-lg font-black">
                  <span className={`h-4 w-4 rounded-full ${style.swatch}`} />
                  {style.name}
                </h2>
                <div className="text-end text-sm leading-tight">
                  <div className="font-bold">סה״כ {formatRating(s.total)}</div>
                  <div className="opacity-75">ממוצע {s.average.toFixed(2)}</div>
                </div>
              </div>
              <div className="border-b border-zinc-100 px-4 py-1.5 text-xs text-zinc-500">
                {players.length} שחקנים · {positionSummary(players) || "ללא תפקידים"}
              </div>
              <ul>
                {players.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => tapPlayer(p.id)}
                      className={`flex w-full items-center gap-3 px-4 py-2 text-start ${
                        picked === p.id ? "bg-amber-100" : picked ? "active:bg-emerald-50" : "active:bg-zinc-50"
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{p.name}</span>
                      </span>
                      {p.positions.length > 0 && <PositionTags positions={p.positions.slice(0, 1)} />}
                      <RatingBadge rating={p.rating} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

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
