"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { btn, RatingBadge, Spinner } from "@/components/ui";
import { useRouter } from "next/navigation";
import { gameTitle, openGameAsDraft } from "@/lib/draft";
import { shareText, teamStyle } from "@/lib/teams";
import { formatRating, type Game, type SavedTeam } from "@/lib/types";

/** Saved games keep their own team emoji, so older games show their original colors. */
function teamEmoji(team: SavedTeam, index: number): string {
  return team.color && team.color.length <= 2 ? team.color : teamStyle(index).emoji;
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
      <h1 className="text-2xl font-black">היסטוריית משחקים</h1>
      {games === null ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : games.length === 0 ? (
        <div className="rounded-3xl bg-white p-8 text-center text-zinc-500">
          <div className="text-4xl">📋</div>
          <p className="mt-2">כל חלוקה לכוחות נשמרת כאן אוטומטית, לפי תאריך המשחק.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {games.map((g) => {
            const open = openId === g.id;
            return (
              <li key={g.id} className="overflow-hidden rounded-3xl bg-white shadow-sm">
                <button className="flex w-full items-center justify-between px-4 py-3 text-start" onClick={() => setOpenId(open ? null : g.id)}>
                  <span>
                    <span className="block font-bold">⚽ {gameTitle(g)}</span>
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
                    <div className="flex gap-2">
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
                        onClick={() => navigator.clipboard?.writeText(shareText(g.teams, gameTitle(g))).then(() => toast("הועתק ✓"))}
                      >
                        📄 העתקה
                      </button>
                      <button
                        className={btn.danger}
                        onClick={() => {
                          ask({ title: "למחוק את המשחק מההיסטוריה?", confirmLabel: "מחיקה", danger: true }).then((ok) => {
                            if (ok) repo.deleteGame(g.id).then(load).catch((e: Error) => toast(e.message));
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
      )}
    </div>
  );
}
