"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { PasteListSheet, PlayerFormSheet } from "@/components/PlayerSheets";
import { QuickAdd } from "@/components/QuickAdd";
import { btn, input, PositionTags, RatingBadge, Spinner } from "@/components/ui";
import { normalizeName } from "@/lib/parseList";
import type { Player } from "@/lib/types";

export default function PlayersPage() {
  const { players, playersLoading, deletePlayers, toast, ask } = useApp();
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Player | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = normalizeName(query);
    const list = q ? players.filter((p) => normalizeName(p.name).includes(q)) : players;
    return [...list.filter((p) => p.active), ...list.filter((p) => !p.active)];
  }, [players, query]);

  // Only players still in the list (and visible under the search) count as checked.
  const checkedVisible = filtered.filter((p) => checked.has(p.id));
  const allChecked = filtered.length > 0 && checkedVisible.length === filtered.length;

  const toggle = (id: string) => {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChecked(next);
  };

  const removeChecked = async () => {
    const ids = checkedVisible.map((p) => p.id);
    const ok = await ask({
      title: `למחוק ${ids.length} שחקנים?`,
      message: "הם יימחקו מהמאגר, ואי אפשר לבטל.",
      confirmLabel: "מחיקה",
      danger: true,
    });
    if (!ok) return;
    setDeleting(true);
    deletePlayers(ids)
      .then(() => {
        setChecked(new Set());
        toast(`נמחקו ${ids.length} שחקנים`);
      })
      .catch((e: Error) => toast(e.message))
      .finally(() => setDeleting(false));
  };

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
        <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-4 py-2">
            <label className="flex items-center gap-3 text-sm font-semibold text-zinc-600">
              <input
                type="checkbox"
                className="h-5 w-5 accent-emerald-700"
                checked={allChecked}
                onChange={() => setChecked(allChecked ? new Set() : new Set(filtered.map((p) => p.id)))}
              />
              {checkedVisible.length ? `נבחרו ${checkedVisible.length}` : "בחירת הכל"}
            </label>
            {checkedVisible.length > 0 && (
              <button className={`${btn.danger} py-1.5`} disabled={deleting} onClick={removeChecked}>
                🗑 מחיקה ({checkedVisible.length})
              </button>
            )}
          </div>
          <ul className="divide-y divide-zinc-100">
            {filtered.map((p) => (
              <li key={p.id} className={`flex items-center ${checked.has(p.id) ? "bg-red-50" : ""}`}>
                <label className="flex self-stretch items-center ps-4 pe-1">
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-emerald-700"
                    checked={checked.has(p.id)}
                    onChange={() => toggle(p.id)}
                    aria-label={`בחירת ${p.name}`}
                  />
                </label>
                <button
                  className={`flex min-w-0 flex-1 items-center gap-3 py-3 ps-2 pe-4 text-start active:bg-zinc-50 ${p.active ? "" : "opacity-45"}`}
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
        </div>
      )}

      <PlayerFormSheet open={formOpen} player={editing} onClose={() => setFormOpen(false)} />
      <PasteListSheet open={pasteOpen} onClose={() => setPasteOpen(false)} confirmLabel="הוספת השחקנים" />
    </div>
  );
}
