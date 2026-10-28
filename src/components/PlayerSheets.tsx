"use client";

import { useMemo, useState } from "react";
import { useApp } from "./AppProvider";
import { btn, input, PositionPicker, RatingBadge, RatingPicker, Sheet } from "./ui";
import { normalizeName, parsePlayerList } from "@/lib/parseList";
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

  const { matched, fresh } = useMemo(() => {
    const byName = new Map(players.map((p) => [normalizeName(p.name), p]));
    const matched: Player[] = [];
    const fresh: { name: string; rating: number }[] = [];
    for (const line of parsePlayerList(text)) {
      const existing = byName.get(normalizeName(line.name));
      if (existing) matched.push(existing);
      else fresh.push({ name: line.name, rating: line.rating ?? DEFAULT_RATING });
    }
    return { matched, fresh };
  }, [text, players]);

  const close = () => {
    setText("");
    onClose();
  };

  return (
    <Sheet open={open} onClose={close} title="הדבקת רשימה">
      <p className="mb-2 text-sm text-zinc-600">
        הדביקו את רשימת המגיעים מהוואטסאפ, שם בכל שורה. אפשר להוסיף רמה אחרי השם (למשל &quot;דני 5.5&quot;).
      </p>
      <textarea
        className={`${input} h-40 resize-none`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"1. אסף\n2. דני 5.5\n3. יוסי"}
        autoFocus
      />
      {(matched.length > 0 || fresh.length > 0) && (
        <div className="mt-3 space-y-2 text-sm">
          {matched.length > 0 && (
            <p>
              <span className="font-semibold text-emerald-800">✓ {matched.length} מוכרים:</span>{" "}
              <span className="text-zinc-600">{matched.map((p) => p.name).join(", ")}</span>
            </p>
          )}
          {fresh.length > 0 && (
            <div>
              <p className="font-semibold text-amber-800">+ {fresh.length} חדשים (אפשר לערוך רמה ותפקיד אחר כך):</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {fresh.map((p) => (
                  <span key={p.name} className="flex items-center gap-1 rounded-lg bg-amber-50 py-0.5 ps-2 pe-0.5">
                    {p.name} <RatingBadge rating={p.rating} />
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      <button
        type="button"
        className={`${btn.primary} mt-4 w-full`}
        disabled={busy || (matched.length === 0 && fresh.length === 0)}
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
      </button>
    </Sheet>
  );
}
