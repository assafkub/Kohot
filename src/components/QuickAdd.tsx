"use client";

import { useState } from "react";
import { useApp } from "./AppProvider";
import { btn, input } from "./ui";
import { findSimilarPlayers, matchPlayer, parsePlayerList } from "@/lib/parseList";
import { DEFAULT_RATING, type Player } from "@/lib/types";

/** One-line add: type a name (optionally "name 5.5") and press Enter. */
export function QuickAdd({ onAdded }: { onAdded?(player: Player): void }) {
  const { players, addPlayers, toast } = useApp();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const [parsed] = parsePlayerList(value);
        if (!parsed) return;
        // Avoid duplicates: reuse an existing player with this name, or one the user confirms is the same.
        const existing =
          matchPlayer(parsed.name, players) ??
          findSimilarPlayers(parsed.name, players).find((p) => confirm(`האם התכוונת ל${p.name}?\nאישור = כן, ביטול = שחקן חדש`));
        if (existing) {
          setValue("");
          toast(`${existing.name} כבר ברשימה`);
          onAdded?.(existing);
          return;
        }
        setBusy(true);
        addPlayers([{ name: parsed.name, rating: parsed.rating ?? DEFAULT_RATING, positions: [] }])
          .then(([player]) => {
            setValue("");
            toast(`${player.name} נוסף ✓`);
            onAdded?.(player);
          })
          .catch((err: Error) => toast(err.message))
          .finally(() => setBusy(false));
      }}
    >
      <input
        className={input}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="הוספה מהירה: שם (ורמה)"
        enterKeyHint="done"
      />
      <button className={`${btn.primary} shrink-0 px-4`} disabled={busy || !value.trim()} aria-label="הוספה">
        +
      </button>
    </form>
  );
}
