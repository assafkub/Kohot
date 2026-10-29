"use client";

import { useState } from "react";
import { useApp } from "./AppProvider";
import { btn, input } from "./ui";
import { findSimilarPlayers, fullerName, matchPlayer, parsePlayerList } from "@/lib/parseList";
import { DEFAULT_RATING, type Player } from "@/lib/types";

/** One-line add: type a name (optionally "name 5.5") and press Enter. */
export function QuickAdd({ onAdded }: { onAdded?(player: Player): void }) {
  const { players, addPlayers, updatePlayer, toast, ask } = useApp();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const [parsed] = parsePlayerList(value);
        if (!parsed) return;
        // Avoid duplicates: reuse an existing player with this name, or one the user confirms is the same.
        let existing = matchPlayer(parsed.name, players);
        for (const p of existing ? [] : findSimilarPlayers(parsed.name, players)) {
          const same = await ask({
            title: `האם התכוונת ל${p.name}?`,
            message: `כבר יש במאגר שחקן בשם "${p.name}".`,
            confirmLabel: `כן, ${p.name}`,
            cancelLabel: "לא, שחקן חדש",
          });
          if (same) {
            existing = p;
            break;
          }
        }
        if (existing) {
          setValue("");
          const fuller = fullerName(existing.name, parsed.name);
          if (fuller) await updatePlayer(existing.id, { name: fuller }).catch((err: Error) => toast(err.message));
          toast(onAdded ? `${fuller ?? existing.name} נוסף מהמאגר ✓` : `${fuller ?? existing.name} כבר במאגר`);
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
