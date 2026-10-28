"use client";

import { useState } from "react";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
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
import { formatRating, type Player } from "@/lib/types";
import { PositionTags, RatingBadge } from "./ui";

const containerId = (i: number) => `team-${i}`;

/**
 * Team cards with drag & drop: drag a player by its handle to reorder within a team or move it to another team.
 * Tapping a player still selects it for a quick swap (handled by the parent through onTap).
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
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
    <section className={`overflow-hidden rounded-3xl bg-white shadow-sm ${isOver ? "ring-2 ring-emerald-500" : ""}`}>
      <div className={`flex items-center justify-between px-4 py-3 ${style.header}`}>
        <h2 className="flex items-center gap-2 text-lg font-black">
          <span className={`h-4 w-4 rounded-full ${style.swatch}`} />
          {style.name}
        </h2>
        <div className="text-end text-sm leading-tight">
          <div className="font-bold">סה״כ {formatRating(s.total)}</div>
          <div className="opacity-75">ממוצע {s.average.toFixed(2)}</div>
        </div>
      </div>
      <div className="border-b border-zinc-100 px-4 py-1.5 text-xs text-zinc-500">
        {players.length} שחקנים · {positionSummary(players) || "ללא תפקידים"}
      </div>
      <SortableContext id={containerId(index)} items={players.map((p) => p.id)} strategy={verticalListSortingStrategy}>
        <ul ref={setNodeRef} className="min-h-12">
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
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition } = useSortable({ id: player.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`flex items-center ${dragging ? "opacity-30" : ""} ${picked === player.id ? "bg-amber-100" : ""}`}
    >
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none self-stretch ps-3 pe-1 text-lg text-zinc-300 active:text-emerald-700"
        aria-label={`גרירת ${player.name}`}
      >
        ⠿
      </button>
      <button onClick={() => onTap(player.id)} className="flex min-w-0 flex-1 items-center gap-3 py-2 ps-1 pe-4 text-start active:bg-zinc-50">
        <PlayerRowContent player={player} />
      </button>
    </li>
  );
}

function PlayerRow({ player, overlay }: { player: Player; overlay?: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl bg-white px-4 py-2 ${overlay ? "shadow-xl ring-2 ring-emerald-500" : ""}`} dir="rtl">
      <span className="text-lg text-emerald-700">⠿</span>
      <PlayerRowContent player={player} />
    </div>
  );
}

function PlayerRowContent({ player }: { player: Player }) {
  return (
    <>
      <span className="min-w-0 flex-1 truncate font-semibold">{player.name}</span>
      {player.positions.length > 0 && <PositionTags positions={player.positions.slice(0, 1)} />}
      <RatingBadge rating={player.rating} />
    </>
  );
}
