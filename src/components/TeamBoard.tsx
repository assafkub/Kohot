"use client";

import { useState } from "react";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { summarizeTeam } from "@/lib/balance";
import { positionSummary, teamStyle } from "@/lib/teams";
import { formatRating, POSITION_EMOJI, type Player } from "@/lib/types";
import { ratingColor } from "./ui";

const containerId = (i: number) => `team-${i}`;

/**
 * The three teams side by side as columns, so the whole split fits a portrait phone screen.
 * Long-press (touch) or drag (mouse) a player to reorder it or move it to another team;
 * a short tap still selects it for a quick swap (handled by the parent through onTap).
 */
export function TeamBoard({
  teams,
  picked,
  onTap,
  onChange,
}: {
  teams: Player[][];
  picked: string | null;
  onTap(id: string): void;
  onChange(teams: Player[][]): void;
}) {
  const byId = new Map(teams.flat().map((p) => [p.id, p]));
  // While dragging we work on a local copy of the ids, committed on drop.
  const [dragIds, setDragIds] = useState<string[][] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const ids = dragIds ?? teams.map((t) => t.map((p) => p.id));

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    // Long press on touch, so a normal swipe still scrolls the page.
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findTeam = (id: string, list = ids) =>
    id.startsWith("team-") ? Number(id.slice(5)) : list.findIndex((t) => t.includes(id));

  const onDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id));
    setDragIds(ids.map((t) => t.slice()));
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over || !dragIds) return;
    const from = findTeam(String(active.id), dragIds);
    const to = findTeam(String(over.id), dragIds);
    if (from < 0 || to < 0 || from === to) return;
    const next = dragIds.map((t) => t.slice());
    next[from] = next[from].filter((id) => id !== active.id);
    const overIndex = next[to].indexOf(String(over.id));
    next[to].splice(overIndex < 0 ? next[to].length : overIndex, 0, String(active.id));
    setDragIds(next);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    let next = dragIds ?? ids;
    if (over) {
      const team = findTeam(String(active.id), next);
      const oldIndex = next[team].indexOf(String(active.id));
      const newIndex = next[team].indexOf(String(over.id));
      if (newIndex >= 0 && newIndex !== oldIndex) {
        next = next.map((t, i) => (i === team ? arrayMove(t, oldIndex, newIndex) : t));
      }
      onChange(next.map((t) => t.map((id) => byId.get(id)!)));
    }
    setDragIds(null);
    setActiveId(null);
  };

  const active = activeId ? byId.get(activeId) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setDragIds(null);
        setActiveId(null);
      }}
    >
      <div className="grid grid-cols-3 items-start gap-1.5">
        {ids.map((teamIds, i) => (
          <TeamCard
            key={i}
            index={i}
            players={teamIds.map((id) => byId.get(id)!)}
            picked={picked}
            activeId={activeId}
            onTap={onTap}
          />
        ))}
      </div>
      <DragOverlay>{active ? <PlayerRow player={active} overlay /> : null}</DragOverlay>
    </DndContext>
  );
}

function TeamCard({
  index,
  players,
  picked,
  activeId,
  onTap,
}: {
  index: number;
  players: Player[];
  picked: string | null;
  activeId: string | null;
  onTap(id: string): void;
}) {
  const style = teamStyle(index);
  const s = summarizeTeam(players);
  const { setNodeRef, isOver } = useDroppable({ id: containerId(index) });
  return (
    <section className={`min-w-0 overflow-hidden rounded-2xl bg-white shadow-sm ${isOver ? "ring-2 ring-emerald-500" : ""}`}>
      <div className={`px-2 py-2 text-center ${style.header}`}>
        <h2 className="flex items-center justify-center gap-1.5 text-base font-black">
          <span className={`h-3 w-3 shrink-0 rounded-full ${style.swatch}`} />
          {style.name}
        </h2>
        <div className="text-xs leading-tight">
          <b>{formatRating(s.total)}</b> · <span className="opacity-75">{s.average.toFixed(2)}</span>
        </div>
      </div>
      <div className="border-b border-zinc-100 px-1 py-1 text-center text-[11px] leading-tight text-zinc-500">
        {positionSummary(players) ? `${players.length} · ${positionSummary(players)}` : `${players.length} שחקנים`}
      </div>
      <SortableContext id={containerId(index)} items={players.map((p) => p.id)} strategy={verticalListSortingStrategy}>
        <ul ref={setNodeRef} className="min-h-16 divide-y divide-zinc-50">
          {players.map((p) => (
            <SortablePlayer key={p.id} player={p} picked={picked} dragging={activeId === p.id} onTap={onTap} />
          ))}
        </ul>
      </SortableContext>
    </section>
  );
}

function SortablePlayer({
  player,
  picked,
  dragging,
  onTap,
}: {
  player: Player;
  picked: string | null;
  dragging: boolean;
  onTap(id: string): void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: player.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition, WebkitTouchCallout: "none" }}
      {...attributes}
      {...listeners}
      onClick={() => onTap(player.id)}
      aria-label={player.name}
      className={`cursor-grab select-none ${dragging ? "opacity-30" : ""} ${picked === player.id ? "bg-amber-100" : "active:bg-zinc-50"}`}
    >
      <PlayerRow player={player} />
    </li>
  );
}

function PlayerRow({ player, overlay }: { player: Player; overlay?: boolean }) {
  const main = player.positions[0];
  return (
    <div
      dir="rtl"
      className={`flex items-center gap-1 px-1.5 py-1.5 ${overlay ? "rounded-lg bg-white shadow-xl ring-2 ring-emerald-500" : ""}`}
    >
      <span className="line-clamp-2 min-w-0 flex-1 text-[13px] leading-4 font-semibold break-words">
        {main && <span className="me-0.5 text-[11px]">{POSITION_EMOJI[main]}</span>}
        {player.name}
      </span>
      <span className={`shrink-0 rounded-md px-1 text-xs leading-5 font-bold tabular-nums ${ratingColor(player.rating)}`}>
        {formatRating(player.rating)}
      </span>
    </div>
  );
}
