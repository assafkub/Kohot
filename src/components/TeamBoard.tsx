"use client";

import { useState } from "react";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDraggable,
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
import { comparePlayersForLineup, summarizeTeam } from "@/lib/balance";
import { positionSummary, TEAM_STYLES, teamStyle } from "@/lib/teams";
import { formatRating, POSITION_EMOJI, type Player, type SavedTeam, type SavedTeamPlayer } from "@/lib/types";
import { ratingColor } from "./ui";

const containerId = (i: number) => `team-${i}`;
const headerId = (i: number) => `head-${i}`;
const headerIndex = (id: string) => (id.startsWith("head-") ? Number(id.slice(5)) : -1);

/**
 * The three teams side by side as columns, so the whole split fits a portrait phone screen.
 * Long-press (touch) or drag (mouse) a player: within its team it reorders, onto a player of another team it swaps them;
 * a short tap still selects it for a quick swap (handled by the parent through onTap).
 * A team's color header can be dragged onto another team (or tapped, then the other header tapped) to swap only the colors;
 * the players stay where they are.
 */
export function TeamBoard({
  teams,
  colors,
  picked,
  onTap,
  onChange,
  onColors,
}: {
  teams: Player[][];
  colors: number[];
  picked: string | null;
  onTap(id: string): void;
  onChange(teams: Player[][]): void;
  onColors(colors: number[]): void;
}) {
  const byId = new Map(teams.flat().map((p) => [p.id, p]));
  const ids = teams.map((t) => t.map((p) => p.id));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [pickedHead, setPickedHead] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    // Long press on touch, so a normal swipe still scrolls the page.
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findTeam = (id: string) =>
    headerIndex(id) >= 0 ? headerIndex(id) : id.startsWith("team-") ? Number(id.slice(5)) : ids.findIndex((t) => t.includes(id));

  const swapColors = (a: number, b: number) => {
    const next = teams.map((_, i) => colors[i] ?? i);
    [next[a], next[b]] = [next[b], next[a]];
    onColors(next);
  };
  const tapHeader = (i: number) => {
    if (pickedHead === null) setPickedHead(i);
    else {
      if (pickedHead !== i) swapColors(pickedHead, i);
      setPickedHead(null);
    }
  };

  const draggingHead = activeId ? headerIndex(activeId) : -1;
  const headTarget = draggingHead >= 0 && overId && findTeam(overId) !== draggingHead ? findTeam(overId) : -1;
  // Dropping on a player of another team swaps the two, so team sizes never change.
  const swapTarget =
    activeId && draggingHead < 0 && overId && !overId.startsWith("head-") && findTeam(overId) >= 0 && findTeam(overId) !== findTeam(activeId) ? overId : null;

  const reset = () => {
    setActiveId(null);
    setOverId(null);
  };

  const onDragStart = ({ active }: DragStartEvent) => setActiveId(String(active.id));
  const onDragOver = ({ over }: DragOverEvent) => setOverId(over ? String(over.id) : null);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    reset();
    if (!over) return;
    const a = String(active.id);
    const o = String(over.id);
    const from = findTeam(a);
    const to = findTeam(o);
    if (from < 0 || to < 0 || a === o) return;
    if (headerIndex(a) >= 0) {
      if (from !== to) swapColors(from, to);
      return;
    }
    if (headerIndex(o) >= 0 || o.startsWith("team-")) return;
    const next = ids.map((t) => t.slice());
    if (from === to) {
      next[from] = arrayMove(next[from], next[from].indexOf(a), next[from].indexOf(o));
    } else {
      const ai = next[from].indexOf(a);
      const oi = next[to].indexOf(o);
      [next[from][ai], next[to][oi]] = [o, a];
    }
    const result = next.map((t) => t.map((id) => byId.get(id)!));
    // After a swap between teams both stay ordered by rating; a reorder inside a team is kept as dragged.
    if (from !== to) [from, to].forEach((t) => result[t].sort(comparePlayersForLineup));
    onChange(result);
  };

  const active = activeId ? byId.get(activeId) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={reset}
    >
      <div className="grid grid-cols-3 items-start gap-1.5">
        {ids.map((teamIds, i) => (
          <TeamCard
            key={i}
            index={i}
            color={colors[i] ?? i}
            players={teamIds.map((id) => byId.get(id)!)}
            picked={picked}
            activeId={activeId}
            swapTarget={swapTarget}
            onTap={onTap}
            headState={pickedHead === i ? "picked" : headTarget === i ? "target" : draggingHead === i ? "dragging" : null}
            onTapHeader={() => tapHeader(i)}
          />
        ))}
      </div>
      {pickedHead !== null && (
        <p className="mt-1.5 text-center text-xs text-zinc-500">בחרו קבוצה אחרת כדי להחליף איתה צבע</p>
      )}
      <DragOverlay>
        {active ? (
          <PlayerRow player={active} overlay />
        ) : draggingHead >= 0 ? (
          <div className={`rounded-xl px-3 py-2 text-center font-black opacity-90 shadow-xl ring-2 ring-emerald-500 ${teamStyle(colors[draggingHead] ?? draggingHead).header}`}>
            {teamStyle(colors[draggingHead] ?? draggingHead).name}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function TeamCard({
  index,
  color,
  players,
  picked,
  activeId,
  swapTarget,
  onTap,
  headState,
  onTapHeader,
}: {
  index: number;
  color: number;
  players: Player[];
  picked: string | null;
  activeId: string | null;
  swapTarget: string | null;
  onTap(id: string): void;
  headState: "picked" | "target" | "dragging" | null;
  onTapHeader(): void;
}) {
  const style = teamStyle(color);
  const s = summarizeTeam(players);
  const { setNodeRef } = useDroppable({ id: containerId(index) });
  const head = useDraggable({ id: headerId(index) });
  const headDrop = useDroppable({ id: headerId(index) });
  const ring =
    headState === "target"
      ? "ring-2 ring-emerald-500 ring-inset"
      : headState === "picked"
        ? "ring-2 ring-amber-400 ring-inset"
        : "";
  return (
    <section className={`min-w-0 overflow-hidden rounded-2xl bg-white shadow-sm ${headState === "target" ? "ring-2 ring-emerald-500" : ""}`}>
      <div
        ref={(node) => {
          head.setNodeRef(node);
          headDrop.setNodeRef(node);
        }}
        {...head.attributes}
        {...head.listeners}
        onClick={onTapHeader}
        aria-label={`צבע ${style.name}`}
        style={{ WebkitTouchCallout: "none" }}
        className={`cursor-grab px-2 py-2 text-center select-none ${style.header} ${ring} ${headState === "dragging" ? "opacity-40" : ""}`}
      >
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
            <SortablePlayer
              key={p.id}
              player={p}
              picked={picked}
              dragging={activeId === p.id}
              swapTarget={swapTarget === p.id}
              onTap={onTap}
            />
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
  swapTarget,
  onTap,
}: {
  player: Player;
  picked: string | null;
  dragging: boolean;
  swapTarget: boolean;
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
      className={`cursor-grab select-none ${dragging ? "opacity-30" : ""} ${swapTarget ? "bg-emerald-100 ring-2 ring-emerald-500 ring-inset" : picked === player.id ? "bg-amber-100" : "active:bg-zinc-50"}`}
    >
      <PlayerRow player={player} />
    </li>
  );
}

/** A saved split shown the same way as on the Today screen, read-only: three columns side by side. */
export function SavedTeamColumns({ teams }: { teams: SavedTeam[] }) {
  return (
    <div className="grid grid-cols-3 items-start gap-1.5">
      {teams.map((team, i) => {
        const style = TEAM_STYLES.find((s) => s.emoji === team.color) ?? teamStyle(i);
        const s = summarizeTeam(team.players);
        return (
          <section key={i} className="min-w-0 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-zinc-100">
            <div className={`px-2 py-2 text-center ${style.header}`}>
              <h3 className="text-base font-black">{style.name}</h3>
              <div className="text-xs leading-tight">
                <b>{formatRating(s.total)}</b> · <span className="opacity-75">{s.average.toFixed(2)}</span>
              </div>
            </div>
            <div className="border-b border-zinc-100 px-1 py-1 text-center text-[11px] leading-tight text-zinc-500">
              {positionSummary(team.players) ? `${team.players.length} · ${positionSummary(team.players)}` : `${team.players.length} שחקנים`}
            </div>
            <ul className="divide-y divide-zinc-50">
              {team.players.map((p) => (
                <li key={p.id}>
                  <PlayerRow player={p} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function PlayerRow({ player, overlay }: { player: SavedTeamPlayer; overlay?: boolean }) {
  const main = player.positions[0];
  return (
    <div
      dir="rtl"
      className={`flex items-center gap-1 px-1.5 py-1.5 ${overlay ? "rounded-lg bg-white/85 shadow-xl ring-2 ring-emerald-500" : ""}`}
    >
      <span className="line-clamp-2 min-w-0 flex-1 text-[13px] leading-4 font-semibold break-words">
        {main && <span className="me-0.5 text-[11px]">{POSITION_EMOJI[main]}</span>}
        {player.name}
      </span>
      <span className={`min-w-7 shrink-0 rounded-md px-1 text-center text-sm leading-6 font-bold tabular-nums ${ratingColor(player.rating)}`}>
        {formatRating(player.rating)}
      </span>
    </div>
  );
}
