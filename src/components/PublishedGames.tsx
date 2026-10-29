"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "./AppProvider";
import { Spinner } from "./ui";
import { gameTitle } from "@/lib/draft";
import { TEAM_STYLES, teamStyle } from "@/lib/teams";
import type { PublishedGame } from "@/lib/types";

function styleOf(color: string, index: number) {
  return TEAM_STYLES.find((s) => s.emoji === color) ?? teamStyle(index);
}

/** The players' screen: teams the managers published, names and colors only. */
export function PublishedGames() {
  const { group, repo, toast } = useApp();
  const [games, setGames] = useState<PublishedGame[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!group) return;
    repo
      .listPublishedGames(group.id)
      .then((list) => {
        setGames(list);
        setOpenId((id) => id ?? list[0]?.id ?? null);
      })
      .catch((e: Error) => {
        toast(e.message);
        setGames([]);
      });
  }, [group, repo, toast]);

  useEffect(load, [load]);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-black">הכוחות</h1>
        <button className="rounded-xl px-3 py-1.5 text-sm font-semibold text-emerald-800 active:bg-emerald-50" onClick={load}>
          ↻ רענון
        </button>
      </header>
      {games === null ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : games.length === 0 ? (
        <div className="rounded-3xl bg-white p-8 text-center text-zinc-500">
          <div className="text-4xl">⚽</div>
          <p className="mt-2">עוד לא פורסמו כוחות. כשהמנהל יפרסם, הם יופיעו כאן.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {games.map((g) => {
            const open = openId === g.id;
            return (
              <li key={g.id} className="overflow-hidden rounded-3xl bg-white shadow-sm">
                <button className="flex w-full items-center justify-between px-4 py-3 text-start" onClick={() => setOpenId(open ? null : g.id)}>
                  <span className="font-bold">⚽ {gameTitle(g)}</span>
                  <span className="text-zinc-400">{open ? "▲" : "▼"}</span>
                </button>
                {open && (
                  <div className="grid gap-2 border-t border-zinc-100 p-3" style={{ gridTemplateColumns: `repeat(${g.teams.length}, minmax(0, 1fr))` }}>
                    {g.teams.map((t, i) => {
                      const style = styleOf(t.color, i);
                      return (
                        <div key={i} className="overflow-hidden rounded-2xl ring-1 ring-zinc-200">
                          <h3 className={`px-2 py-1.5 text-center text-sm font-bold ${style.header}`}>{t.name || style.name}</h3>
                          <ul className="divide-y divide-zinc-100">
                            {t.players.map((p, j) => (
                              <li key={j} className="truncate px-2 py-1.5 text-center text-sm">
                                {p.name}
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
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
