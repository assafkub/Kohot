"use client";

import { useMemo, useState } from "react";
import { useApp } from "./AppProvider";
import { btn, input, PositionPicker, RatingBadge, RatingPicker, Sheet } from "./ui";
import { findSimilarPlayers, foldName, fullerName, matchPlayer, parsePlayerList } from "@/lib/parseList";
import { DEFAULT_RATING, type Player, type Position } from "@/lib/types";

export function PlayerFormSheet({ open, player, onClose }: { open: boolean; player: Player | null; onClose(): void }) {
  // Remount the form each time it opens so it starts from the player's current values.
  return (
    <Sheet open={open} onClose={onClose} title={player ? "עריכת שחקן" : "שחקן חדש"}>
      {open && <PlayerForm key={player?.id ?? "new"} player={player} onDone={onClose} />}
    </Sheet>
  );
}

function PlayerForm({ player, onDone }: { player: Player | null; onDone(): void }) {
  const { addPlayers, updatePlayer, deletePlayer, toast, ask } = useApp();
  const [name, setName] = useState(player?.name ?? "");
  const [rating, setRating] = useState(player?.rating ?? DEFAULT_RATING);
  const [positions, setPositions] = useState<Position[]>(player?.positions ?? []);
  const [active, setActive] = useState(player?.active ?? true);
  const [busy, setBusy] = useState(false);

  const run = (fn: () => Promise<unknown>, message: string) => {
    setBusy(true);
    fn()
      .then(() => {
        toast(message);
        onDone();
      })
      .catch((e: Error) => toast(e.message))
      .finally(() => setBusy(false));
  };

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) return;
        if (player) run(() => updatePlayer(player.id, { name: trimmed, rating, positions, active }), "נשמר ✓");
        else run(() => addPlayers([{ name: trimmed, rating, positions }]), `${trimmed} נוסף ✓`);
      }}
    >
      <div>
        <label className="mb-1.5 block text-sm font-semibold">שם</label>
        <input className={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus={!player} />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-semibold">רמה</label>
        <RatingPicker value={rating} onChange={setRating} />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-semibold">תפקידים</label>
        <PositionPicker value={positions} onChange={setPositions} />
      </div>
      {player && (
        <label className="flex items-center justify-between rounded-xl bg-zinc-50 px-3.5 py-3 text-sm">
          <span>
            <span className="font-semibold">שחקן פעיל</span>
            <span className="block text-xs text-zinc-500">שחקן לא פעיל לא מופיע ברשימת &quot;מי מגיע&quot;</span>
          </span>
          <input type="checkbox" className="h-5 w-5 accent-emerald-700" checked={active} onChange={(e) => setActive(e.target.checked)} />
        </label>
      )}
      <button className={`${btn.primary} w-full`} disabled={busy || !name.trim()}>
        {player ? "שמירה" : "הוספה"}
      </button>
      {player && (
        <button
          type="button"
          className={`${btn.danger} w-full`}
          disabled={busy}
          onClick={() => {
            ask({ title: `למחוק את ${player.name}?`, message: "השחקן יימחק מהמאגר.", confirmLabel: "מחיקה", danger: true }).then(
              (ok) => {
                if (ok) run(() => deletePlayer(player.id), "נמחק");
              },
            );
          }}
        >
          מחיקת שחקן
        </button>
      )}
    </form>
  );
}

/** Paste a list of names (e.g. from WhatsApp); existing players are matched, new ones are created. */
export function PasteListSheet({
  open,
  onClose,
  onDone,
  confirmLabel,
}: {
  open: boolean;
  onClose(): void;
  onDone?(playerIds: string[]): void;
  confirmLabel: string;
}) {
  const { players, addPlayers, updatePlayer, toast } = useApp();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  // Rows the user unticked in the preview, keyed by row key.
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  // Answers to "is this X?": a player id, or "new". Unanswered rows use their first suggestion.
  const [answers, setAnswers] = useState<Map<string, string>>(new Map());

  const rows = useMemo(() => {
    const rows: { key: string; name: string; rating: number; existing?: Player; similar: Player[] }[] = [];
    for (const line of parsePlayerList(text)) {
      const existing = matchPlayer(line.name, players);
      const key = existing ? `p:${existing.id}` : `n:${foldName(line.name)}`;
      if (rows.some((r) => r.key === key)) continue;
      rows.push({
        key,
        name: existing?.name ?? line.name,
        rating: existing?.rating ?? line.rating ?? DEFAULT_RATING,
        existing,
        similar: existing ? [] : findSimilarPlayers(line.name, players),
      });
    }
    return rows;
  }, [text, players]);

  // Resolve each row to an existing player (exact match or a confirmed suggestion) or a new one.
  const resolved = rows
    .filter((r) => !excluded.has(r.key))
    .map((r) => {
      if (r.existing || r.similar.length === 0) return { ...r, target: r.existing };
      const answer = answers.get(r.key) ?? r.similar[0].id;
      return { ...r, target: r.similar.find((p) => p.id === answer) };
    });
  const matched = [...new Set(resolved.flatMap((r) => (r.target ? [r.target] : [])))];
  const fresh = resolved.filter((r) => !r.target).map(({ name, rating }) => ({ name, rating }));
  const renames = resolved.flatMap((r) => {
    const name = r.target && !r.existing ? fullerName(r.target.name, r.name) : null;
    return name && r.target ? [{ id: r.target.id, name }] : [];
  });

  const answer = (key: string, value: string) => setAnswers(new Map(answers).set(key, value));

  const toggle = (key: string) => {
    const next = new Set(excluded);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExcluded(next);
  };

  const close = () => {
    setText("");
    setExcluded(new Set());
    setAnswers(new Map());
    onClose();
  };

  return (
    <Sheet open={open} onClose={close} title="הדבקת רשימה">
      <p className="mb-2 text-sm text-zinc-600">
        הדביקו את רשימת המגיעים מהוואטסאפ, שם בכל שורה. אפשר להוסיף רמה אחרי השם (למשל &quot;דני 5.5&quot;).
      </p>
      <textarea
        className={`${input} ${rows.length ? "h-24" : "h-40"} resize-none`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"1. אסף\n2. דני 5.5\n3. יוסי"}
        autoFocus
      />
      {rows.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-sm text-zinc-600">
            נמצאו <b>{rows.length}</b> שמות. הורידו את הווי ממה שלא שייך:
          </p>
          <ul className="grid grid-cols-2 gap-1.5">
            {rows.map((r) => {
              const on = !excluded.has(r.key);
              const asking = on && r.similar.length > 0;
              const current = answers.get(r.key) ?? r.similar[0]?.id;
              return (
                <li key={r.key} className={asking ? "col-span-2" : ""}>
                  <label
                    className={`flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 text-sm ${
                      !on ? "bg-zinc-100 text-zinc-400 line-through" : r.existing ? "bg-emerald-50" : "bg-amber-50"
                    } ${asking ? "rounded-b-none" : ""}`}
                  >
                    <input type="checkbox" className="h-4 w-4 shrink-0 accent-emerald-700" checked={on} onChange={() => toggle(r.key)} />
                    <span className="min-w-0 flex-1 truncate font-semibold">{r.name}</span>
                    {r.existing ? (
                      <RatingBadge rating={r.rating} />
                    ) : asking ? null : (
                      <span className="shrink-0 rounded-md bg-amber-200 px-1.5 text-[11px] font-bold text-amber-900">חדש</span>
                    )}
                  </label>
                  {asking && (
                    <div className="rounded-b-xl bg-amber-50 px-2 pb-2">
                      <p className="mb-1 text-xs font-semibold text-amber-900">זה אותו שחקן?</p>
                      <div className="flex flex-wrap gap-1.5">
                        {r.similar.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => answer(r.key, p.id)}
                            className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                              current === p.id ? "bg-emerald-700 text-white" : "bg-white text-zinc-700 ring-1 ring-zinc-200"
                            }`}
                          >
                            {current === p.id ? "✓ " : ""}כן, {p.name}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => answer(r.key, "new")}
                          className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                            current === "new" ? "bg-amber-600 text-white" : "bg-white text-zinc-700 ring-1 ring-zinc-200"
                          }`}
                        >
                          {current === "new" ? "✓ " : ""}לא, שחקן חדש
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {fresh.length > 0 && (
            <p className="mt-2 text-xs text-amber-800">שחקנים חדשים יתווספו עם רמה {DEFAULT_RATING}, ואפשר לערוך אחר כך.</p>
          )}
        </div>
      )}
      <button
        type="button"
        className={`${btn.primary} mt-4 w-full`}
        disabled={busy || resolved.length === 0}
        onClick={() => {
          setBusy(true);
          Promise.all(renames.map((r) => updatePlayer(r.id, { name: r.name })))
            .then(() => (fresh.length ? addPlayers(fresh.map((p) => ({ ...p, positions: [] }))) : []))
            .then((created) => {
              onDone?.([...matched.map((p) => p.id), ...created.map((p) => p.id)]);
              if (created.length) toast(`נוספו ${created.length} שחקנים חדשים`);
              close();
            })
            .catch((e: Error) => toast(e.message))
            .finally(() => setBusy(false));
        }}
      >
        {confirmLabel}
        {resolved.length > 0 && ` (${resolved.length})`}
      </button>
    </Sheet>
  );
}
