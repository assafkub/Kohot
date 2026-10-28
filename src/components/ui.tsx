"use client";

import { useEffect } from "react";
import {
  MAX_RATING,
  MIN_RATING,
  POSITION_EMOJI,
  POSITION_LABEL,
  POSITIONS,
  clampRating,
  formatRating,
  type Position,
} from "@/lib/types";

export const btn = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3.5 text-base font-bold text-white shadow-sm active:scale-[0.98] disabled:opacity-40",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-zinc-800 ring-1 ring-zinc-200 active:bg-zinc-50 disabled:opacity-40",
  ghost: "inline-flex items-center justify-center gap-1 rounded-xl px-3 py-2 text-sm font-medium text-emerald-800 active:bg-emerald-50",
  danger: "inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold text-red-700 active:bg-red-50",
};

export const input =
  "w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-3 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose(): void; title: string; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="pb-safe max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-zinc-500 active:bg-zinc-100" aria-label="סגירה">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ratingColor(rating: number): string {
  if (rating >= 6) return "bg-emerald-600 text-white";
  if (rating >= 4.5) return "bg-emerald-100 text-emerald-900";
  if (rating >= 3) return "bg-amber-100 text-amber-900";
  return "bg-zinc-200 text-zinc-700";
}

export function RatingBadge({ rating }: { rating: number }) {
  return (
    <span className={`inline-flex h-8 min-w-10 items-center justify-center rounded-lg px-1.5 text-sm font-bold tabular-nums ${ratingColor(rating)}`}>
      {formatRating(rating)}
    </span>
  );
}

export function RatingPicker({ value, onChange }: { value: number; onChange(v: number): void }) {
  const set = (v: number) => onChange(clampRating(v));
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <button type="button" className={`${btn.secondary} h-12 w-12 text-xl`} onClick={() => set(value - 0.5)} aria-label="הורד חצי">
          −
        </button>
        <div className="text-center">
          <div className="text-4xl font-black tabular-nums text-emerald-800">{formatRating(value)}</div>
          <div className="text-xs text-zinc-500">מתוך 7</div>
        </div>
        <button type="button" className={`${btn.secondary} h-12 w-12 text-xl`} onClick={() => set(value + 0.5)} aria-label="הוסף חצי">
          +
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: MAX_RATING - MIN_RATING + 1 }, (_, i) => i + MIN_RATING).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => set(n)}
            className={`rounded-lg py-2 text-sm font-bold ${Math.floor(value) === n ? "bg-emerald-700 text-white" : "bg-zinc-100 text-zinc-700"}`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Toggle positions; the first one picked is the main position (marked with ★). */
export function PositionPicker({ value, onChange }: { value: Position[]; onChange(v: Position[]): void }) {
  const toggle = (pos: Position) => onChange(value.includes(pos) ? value.filter((p) => p !== pos) : [...value, pos]);
  return (
    <div>
      <div className="grid grid-cols-5 gap-1.5">
        {POSITIONS.map((pos) => {
          const idx = value.indexOf(pos);
          return (
            <button
              key={pos}
              type="button"
              onClick={() => toggle(pos)}
              className={`relative flex flex-col items-center rounded-xl py-2 text-xs font-semibold ${
                idx === -1 ? "bg-zinc-100 text-zinc-600" : idx === 0 ? "bg-emerald-700 text-white" : "bg-emerald-100 text-emerald-900"
              }`}
            >
              <span className="text-lg leading-6">{POSITION_EMOJI[pos]}</span>
              {POSITION_LABEL[pos]}
              {idx === 0 && <span className="absolute top-0.5 left-1 text-[10px]">★</span>}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-xs text-zinc-500">התפקיד הראשון שנבחר הוא העיקרי (★). אפשר לבחור כמה.</p>
    </div>
  );
}

export function PositionTags({ positions }: { positions: Position[] }) {
  if (!positions.length) return <span className="text-xs text-zinc-400">ללא תפקיד</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {positions.map((pos, i) => (
        <span
          key={pos}
          className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${i === 0 ? "bg-zinc-800 text-white" : "bg-zinc-100 text-zinc-600"}`}
        >
          {POSITION_LABEL[pos]}
        </span>
      ))}
    </span>
  );
}

export function Spinner() {
  return <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-700" />;
}
