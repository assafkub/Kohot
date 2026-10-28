"use client";

import { useState } from "react";
import { useApp } from "./AppProvider";
import { btn, input } from "./ui";
import { parsePlayerList } from "@/lib/parseList";
import { DEFAULT_RATING, type Player } from "@/lib/types";

/** One-line add: type a name (optionally "name 5.5") and press Enter. */
export function QuickAdd({ onAdded }: { onAdded?(player: Player): void }) {
  const { addPlayers, toast } = useApp();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const [parsed] = parsePlayerList(value);
        if (!parsed) return;
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
