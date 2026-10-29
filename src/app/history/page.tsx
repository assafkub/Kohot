"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { btn, RatingBadge, Spinner } from "@/components/ui";
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
  const router = useRouter();

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
        {games && games.length > 0 && (
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
        )}
      </header>
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
                  const open = openId === g.id;
                  return (
                    <li key={g.id} className="overflow-hidden rounded-3xl bg-white shadow-sm">
                      <button className="flex w-full items-center justify-between px-4 py-3 text-start" onClick={() => setOpenId(open ? null : g.id)}>
                        <span>
                          <span className="block font-bold">
                            ⚽ {gameTitle(g)}
                            {versions.length > 1 && <span className="font-normal text-zinc-500"> · גרסה {index + 1}</span>}
                            {g.published_at && <span className="ms-2 rounded-md bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-800">פורסם</span>}
                          </span>
                          <span className="text-sm text-zinc-500">
                            {g.teams.map((t, i) => `${teamEmoji(t, i)} ${formatRating(t.total)}`).join("  ")}
                          </span>
                        </span>
                        <span className="text-zinc-400">{open ? "▲" : "▼"}</span>
                      </button>
                      {open && (
                        <div className="space-y-3 border-t border-zinc-100 px-4 py-3">
                          {g.teams.map((t, i) => (
                            <div key={i}>
                              <h3 className="mb-1 font-bold">
                                {teamEmoji(t, i)} {t.name} ({formatRating(t.total)})
                              </h3>
                              <ul className="flex flex-wrap gap-1.5">
                                {t.players.map((p) => (
                                  <li key={p.id} className="flex items-center gap-1 rounded-lg bg-zinc-50 py-0.5 ps-2 pe-0.5 text-sm">
                                    {p.name} <RatingBadge rating={p.rating} />
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
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
