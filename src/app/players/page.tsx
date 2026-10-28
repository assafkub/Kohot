"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { PasteListSheet, PlayerFormSheet } from "@/components/PlayerSheets";
import { QuickAdd } from "@/components/QuickAdd";
import { btn, input, PositionTags, RatingBadge, Spinner } from "@/components/ui";
import { normalizeName } from "@/lib/parseList";
import type { Player } from "@/lib/types";

export default function PlayersPage() {
  const { players, playersLoading } = useApp();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Player | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = normalizeName(query);
    const list = q ? players.filter((p) => normalizeName(p.name).includes(q)) : players;
    return [...list.filter((p) => p.active), ...list.filter((p) => !p.active)];
  }, [players, query]);

  const open = (p: Player | null) => {
    setEditing(p);
    setFormOpen(true);
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-black">
          שחקנים <span className="text-base font-semibold text-zinc-400">({players.length})</span>
        </h1>
        <div className="flex gap-1">
          <button className={btn.ghost} onClick={() => setPasteOpen(true)}>
            📋 הדבקה
          </button>
          <button className={btn.ghost} onClick={() => open(null)}>
            + מלא
          </button>
        </div>
      </header>

      <QuickAdd />

      {players.length > 8 && (
        <input className={input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="🔍 חיפוש" type="search" />
      )}

      {playersLoading && players.length === 0 ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : players.length === 0 ? (
        <div className="rounded-3xl bg-white p-8 text-center text-zinc-500">
          <div className="text-4xl">👥</div>
          <p className="mt-2">עוד אין שחקנים. הוסיפו בשורה למעלה, או הדביקו רשימה מהוואטסאפ.</p>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-100 overflow-hidden rounded-3xl bg-white shadow-sm">
          {filtered.map((p) => (
            <li key={p.id}>
              <button
                className={`flex w-full items-center gap-3 px-4 py-3 text-start active:bg-zinc-50 ${p.active ? "" : "opacity-45"}`}
                onClick={() => open(p)}
              >
                <RatingBadge rating={p.rating} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{p.name}</span>
                  <PositionTags positions={p.positions} />
                </span>
                <span className="text-zinc-300">‹</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <PlayerFormSheet open={formOpen} player={editing} onClose={() => setFormOpen(false)} />
      <PasteListSheet open={pasteOpen} onClose={() => setPasteOpen(false)} confirmLabel="הוספת השחקנים" />
    </div>
  );
}
