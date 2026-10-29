"use client";

import { useMemo, useState } from "react";
import { useApp } from "./AppProvider";
import { btn, input, PositionPicker, RatingBadge, RatingPicker, Sheet } from "./ui";
import { matchPlayer, normalizeName, parsePlayerList } from "@/lib/parseList";
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
  const { addPlayers, updatePlayer, deletePlayer, toast } = useApp();
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
            if (confirm(`למחוק את ${player.name}?`)) run(() => deletePlayer(player.id), "נמחק");
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
  const { players, addPlayers, toast } = useApp();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  // Rows the user unticked in the preview, keyed by rowKey.
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  const rows = useMemo(() => {
    const rows: { key: string; name: string; rating: number; existing?: Player }[] = [];
    for (const line of parsePlayerList(text)) {
      const existing = matchPlayer(line.name, players);
      const key = existing ? `p:${existing.id}` : `n:${normalizeName(line.name)}`;
      if (rows.some((r) => r.key === key)) continue;
      rows.push({ key, name: existing?.name ?? line.name, rating: existing?.rating ?? line.rating ?? DEFAULT_RATING, existing });
    }
    return rows;
  }, [text, players]);

  const chosen = rows.filter((r) => !excluded.has(r.key));
  const matched = chosen.flatMap((r) => (r.existing ? [r.existing] : []));
  const fresh = chosen.filter((r) => !r.existing).map(({ name, rating }) => ({ name, rating }));

  const toggle = (key: string) => {
    const next = new Set(excluded);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExcluded(next);
  };

  const close = () => {
    setText("");
    setExcluded(new Set());
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
              return (
                <li key={r.key}>
                  <label
                    className={`flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 text-sm ${
                      on ? (r.existing ? "bg-emerald-50" : "bg-amber-50") : "bg-zinc-100 text-zinc-400 line-through"
                    }`}
                  >
                    <input type="checkbox" className="h-4 w-4 shrink-0 accent-emerald-700" checked={on} onChange={() => toggle(r.key)} />
                    <span className="min-w-0 flex-1 truncate font-semibold">{r.name}</span>
                    {r.existing ? (
                      <RatingBadge rating={r.rating} />
                    ) : (
                      <span className="shrink-0 rounded-md bg-amber-200 px-1.5 text-[11px] font-bold text-amber-900">חדש</span>
                    )}
                  </label>
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
        disabled={busy || chosen.length === 0}
        onClick={() => {
          setBusy(true);
          (fresh.length ? addPlayers(fresh.map((p) => ({ ...p, positions: [] }))) : Promise.resolve([]))
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
        {chosen.length > 0 && ` (${chosen.length})`}
      </button>
    </Sheet>
  );
}
