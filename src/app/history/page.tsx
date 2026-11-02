"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { btn, Spinner } from "@/components/ui";
import { SavedTeamColumns } from "@/components/TeamBoard";
import { useRouter } from "next/navigation";
import { forgetSavedGame, gameTitle, openGameAsDraft, shortDate } from "@/lib/draft";
import { shareText, teamStyle } from "@/lib/teams";
import { formatRating, type Game, type SavedTeam } from "@/lib/types";

/** Saved games keep their own team emoji, so older games show their original colors. */
function teamEmoji(team: SavedTeam, index: number): string {
  return team.color && team.color.length <= 2 ? team.color : teamStyle(index).emoji;
}

/** Versions of the same day together, newest day first; versions in the order they were made. */
function gamesByDay(games: Game[]): { date: string; versions: Game[] }[] {
  const days = new Map<string, Game[]>();
  for (const g of games) days.set(g.played_on, [...(days.get(g.played_on) ?? []), g]);
  return [...days].map(([date, versions]) => ({
    date,
    versions: versions.sort((a, b) => a.created_at.localeCompare(b.created_at)),
  }));
}

export default function HistoryPage() {
  const { group, repo, toast, ask } = useApp();
  const [games, setGames] = useState<Game[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  /** Multi-select mode: null when off, otherwise the ids picked for deletion. */
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const router = useRouter();

  const toggleSelected = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const deleteSelected = () => {
    if (!group || !selected || selected.size === 0) return;
    const ids = [...selected];
    ask({
      title: ids.length === 1 ? "למחוק את המשחק שנבחר?" : `למחוק ${ids.length} משחקים?`,
      message: "המשחקים שסימנתם יימחקו לצמיתות. השחקנים נשארים.",
      confirmLabel: "מחיקה",
      danger: true,
    }).then((ok) => {
      if (!ok) return;
      repo
        .deleteGames(ids)
        .then(() => {
          ids.forEach((id) => forgetSavedGame(group.id, id));
          setSelected(null);
          toast(ids.length === 1 ? "המשחק נמחק" : `${ids.length} משחקים נמחקו`);
          load();
        })
        .catch((e: Error) => toast(e.message));
    });
  };

  const load = useCallback(() => {
    if (!group) return;
    repo
      .listGames(group.id)
      .then(setGames)
      .catch((e: Error) => {
        toast(e.message);
        setGames([]);
      });
  }, [group, repo, toast]);

  useEffect(load, [load]);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-black">היסטוריית משחקים</h1>
        {games && games.length > 0 && !selected && (
          <div className="flex items-center gap-1">
          <button
            className="rounded-xl px-3 py-1.5 text-sm font-semibold text-emerald-800 active:bg-emerald-50"
            onClick={() => {
              setOpenId(null);
              setSelected(new Set());
            }}
          >
            ☑ בחירה
          </button>
          <button
            className="rounded-xl px-3 py-1.5 text-sm font-semibold text-red-600 active:bg-red-50"
            onClick={() => {
              if (!group) return;
              ask({
                title: "למחוק את כל ההיסטוריה?",
                message: `כל ${games.length} המשחקים יימחקו לצמיתות. השחקנים נשארים.`,
                confirmLabel: "מחיקת הכל",
                danger: true,
              }).then((ok) => {
                if (!ok) return;
                repo
                  .deleteAllGames(group.id)
                  .then(() => {
                    forgetSavedGame(group.id);
                    toast("ההיסטוריה נמחקה");
                    load();
                  })
                  .catch((e: Error) => toast(e.message));
              });
            }}
          >
            🗑 מחיקת הכל
          </button>
          </div>
        )}
      </header>
      {games && selected && (
        <div className="sticky top-[53px] z-20 flex items-center gap-2 rounded-2xl bg-white px-3 py-2 shadow-md ring-1 ring-zinc-200">
          <span className="flex-1 text-sm font-semibold">
            {selected.size === 0 ? "סמנו משחקים למחיקה" : `${selected.size} נבחרו`}
          </span>
          <button
            className="rounded-xl px-2 py-1.5 text-sm font-semibold text-emerald-800 active:bg-emerald-50"
            onClick={() => setSelected(selected.size === games.length ? new Set() : new Set(games.map((g) => g.id)))}
          >
            {selected.size === games.length ? "ניקוי" : "בחירת הכל"}
          </button>
          <button
            className="rounded-xl bg-red-600 px-3 py-1.5 text-sm font-bold text-white active:bg-red-700 disabled:opacity-40"
            disabled={selected.size === 0}
            onClick={deleteSelected}
          >
            🗑 מחיקה
          </button>
          <button className="rounded-xl px-2 py-1.5 text-sm font-semibold text-zinc-600 active:bg-zinc-100" onClick={() => setSelected(null)}>
            ביטול
          </button>
        </div>
      )}
      {games === null ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : games.length === 0 ? (
        <div className="rounded-3xl bg-white p-8 text-center text-zinc-500">
          <div className="text-4xl">📋</div>
          <p className="mt-2">כוחות שהוספתם להיסטוריה יופיעו כאן לפי תאריך המשחק.</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {gamesByDay(games).map(({ date, versions }) => (
            <li key={date} className="space-y-2">
              {versions.length > 1 && (
                <h2 className="px-1 text-sm font-bold text-zinc-500">
                  📅 {shortDate(date)} · {versions.length} גרסאות, רק המפורסמת מוצגת לשחקנים
                </h2>
              )}
              <ul className="space-y-2">
                {versions.map((g, index) => {
                  const open = !selected && openId === g.id;
                  const checked = selected?.has(g.id) ?? false;
                  return (
                    <li
                      key={g.id}
                      className={`overflow-hidden rounded-3xl bg-white shadow-sm ${checked ? "ring-2 ring-red-500" : ""}`}
                    >
                      <button
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start"
                        aria-pressed={selected ? checked : undefined}
                        onClick={() => (selected ? toggleSelected(g.id) : setOpenId(open ? null : g.id))}
                      >
                        {selected && (
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 text-sm font-bold ${
                              checked ? "border-red-600 bg-red-600 text-white" : "border-zinc-300 bg-white"
                            }`}
                          >
                            {checked && "✓"}
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block font-bold">
                            ⚽ {gameTitle(g)}
                            {versions.length > 1 && <span className="font-normal text-zinc-500"> · גרסה {index + 1}</span>}
                            {g.published_at && <span className="ms-2 rounded-md bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-800">פורסם</span>}
                          </span>
                          {g.created_by_name && <span className="block text-xs text-zinc-500">👤 {g.created_by_name}</span>}
                          <span className="text-sm text-zinc-500">
                            {g.teams.map((t, i) => `${teamEmoji(t, i)} ${formatRating(t.total)}`).join("  ")}
                          </span>
                        </span>
                        {!selected && <span className="text-zinc-400">{open ? "▲" : "▼"}</span>}
                      </button>
                      {open && (
                        <div className="space-y-3 border-t border-zinc-100 bg-zinc-50 px-2 py-3">
                          <SavedTeamColumns teams={g.teams} />
                          <button
                            className={`${g.published_at ? btn.secondary : btn.primary} w-full`}
                            onClick={() =>
                              repo
                                .setGamePublished(g.id, !g.published_at)
                                .then((updated) => {
                                  // Publishing unpublishes the other versions of the day, so reload them all.
                                  load();
                                  toast(updated.published_at ? "פורסם לשחקנים ✓" : "הפרסום בוטל");
                                })
                                .catch((e: Error) => toast(e.message))
                            }
                          >
                            {g.published_at ? "🙈 ביטול פרסום" : "📢 פרסום לשחקנים"}
                          </button>
                          <div className="flex flex-wrap gap-2">
                            <button
                              className={btn.secondary}
                              onClick={() => {
                                if (!group) return;
                                openGameAsDraft(group.id, g);
                                router.push("/");
                              }}
                            >
                              ✎ פתיחה ועריכה
                            </button>
                            <button
                              className={btn.secondary}
                              onClick={() => navigator.clipboard?.writeText(shareText(g.teams)).then(() => toast("הועתק ✓"))}
                            >
                              📄 העתקה
                            </button>
                            <button
                              className={btn.danger}
                              onClick={() => {
                                ask({ title: "למחוק את המשחק מההיסטוריה?", confirmLabel: "מחיקה", danger: true }).then((ok) => {
                                  if (!ok || !group) return;
                                  repo
                                    .deleteGame(g.id)
                                    .then(() => {
                                      forgetSavedGame(group.id, g.id);
                                      load();
                                    })
                                    .catch((e: Error) => toast(e.message));
                                });
                              }}
                            >
                              מחיקה
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
