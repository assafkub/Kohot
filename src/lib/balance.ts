import { POSITIONS, type Position } from "./types";

export interface BalancePlayer {
  id: string;
  name: string;
  rating: number;
  positions: Position[];
}

export interface BalancedTeam<P extends BalancePlayer = BalancePlayer> {
  players: P[];
  total: number;
  average: number;
}

export interface BalanceResult<P extends BalancePlayer = BalancePlayer> {
  teams: BalancedTeam<P>[];
  /** Order-independent signature of the split, used to avoid repeating it on reshuffle. */
  key: string;
}

export interface BalanceOptions {
  rng?: () => number;
  restarts?: number;
  /** Key of the previous result; a different split is preferred when one is about as good. */
  avoidKey?: string;
}

// Cost weights. Rating balance dominates, then goalkeepers, then the rest of the lineup.
const RATING_WEIGHT = 2;
const SPREAD_WEIGHT = 1;
const POSITION_WEIGHT: Record<Position, number> = { GK: 6, CB: 2, FB: 1.5, MID: 1, FWD: 1.5 };
const SECONDARY_POSITION_VALUE = 0.4;
const MISSING_GK_PENALTY = 25;

export function teamSizes(playerCount: number, teamCount: number): number[] {
  const base = Math.floor(playerCount / teamCount);
  const extra = playerCount % teamCount;
  return Array.from({ length: teamCount }, (_, i) => base + (i < extra ? 1 : 0));
}

/** 7 a side by default: 14 → 2 teams, 21 → 3, 28 → 4. */
export function suggestTeamCount(playerCount: number): number {
  return Math.max(2, Math.round(playerCount / 7));
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface Context {
  n: number;
  k: number;
  sizes: number[];
  ratings: number[];
  /** posValue[i][p]: how much player i counts toward position p (1 main, 0.4 secondary). */
  posValue: number[][];
  canGk: boolean[];
  posIdeal: number[][];
  ratingTarget: number[];
  overallStd: number;
  gkPlayers: number;
}

function buildContext(players: BalancePlayer[], k: number): Context {
  const n = players.length;
  const sizes = teamSizes(n, k);
  const ratings = players.map((p) => p.rating);
  const avg = ratings.reduce((s, r) => s + r, 0) / n;
  const overallStd = Math.sqrt(ratings.reduce((s, r) => s + (r - avg) ** 2, 0) / n);
  const posValue = players.map((p) =>
    POSITIONS.map((pos) => {
      const idx = p.positions.indexOf(pos);
      return idx === -1 ? 0 : idx === 0 ? 1 : SECONDARY_POSITION_VALUE;
    }),
  );
  const supply = POSITIONS.map((_, pi) => posValue.reduce((s, v) => s + v[pi], 0));
  const canGk = players.map((p) => p.positions.includes("GK"));
  return {
    n,
    k,
    sizes,
    ratings,
    posValue,
    canGk,
    posIdeal: sizes.map((size) => supply.map((s) => (s * size) / n)),
    ratingTarget: sizes.map((size) => size * avg),
    overallStd,
    gkPlayers: canGk.filter(Boolean).length,
  };
}

function cost(assign: number[], ctx: Context): number {
  const { k, n } = ctx;
  const sums = new Array(k).fill(0);
  const squares = new Array(k).fill(0);
  const gks = new Array(k).fill(0);
  const pos = Array.from({ length: k }, () => new Array(POSITIONS.length).fill(0));
  for (let i = 0; i < n; i++) {
    const t = assign[i];
    const r = ctx.ratings[i];
    sums[t] += r;
    squares[t] += r * r;
    if (ctx.canGk[i]) gks[t]++;
    const pv = ctx.posValue[i];
    for (let p = 0; p < pv.length; p++) pos[t][p] += pv[p];
  }
  let c = 0;
  for (let t = 0; t < k; t++) {
    const size = ctx.sizes[t];
    c += RATING_WEIGHT * (sums[t] - ctx.ratingTarget[t]) ** 2;
    const mean = sums[t] / size;
    const std = Math.sqrt(Math.max(0, squares[t] / size - mean * mean));
    c += SPREAD_WEIGHT * (std - ctx.overallStd) ** 2;
    for (let p = 0; p < POSITIONS.length; p++) {
      c += POSITION_WEIGHT[POSITIONS[p]] * (pos[t][p] - ctx.posIdeal[t][p]) ** 2;
    }
    if (gks[t] === 0 && ctx.gkPlayers >= k) c += MISSING_GK_PENALTY;
  }
  return c;
}

function randomAssignment(ctx: Context, rng: () => number): number[] {
  const slots: number[] = [];
  ctx.sizes.forEach((size, t) => {
    for (let i = 0; i < size; i++) slots.push(t);
  });
  return shuffle(slots, rng);
}

/** Swap-based hill climbing; swaps keep team sizes fixed. */
function improve(assign: number[], ctx: Context, rng: () => number): number {
  let current = cost(assign, ctx);
  const pairs: [number, number][] = [];
  for (let i = 0; i < ctx.n; i++) for (let j = i + 1; j < ctx.n; j++) pairs.push([i, j]);
  for (let pass = 0; pass < 60; pass++) {
    let improved = false;
    for (const [i, j] of shuffle(pairs, rng)) {
      if (assign[i] === assign[j]) continue;
      [assign[i], assign[j]] = [assign[j], assign[i]];
      const next = cost(assign, ctx);
      if (next < current - 1e-9) {
        current = next;
        improved = true;
      } else {
        [assign[i], assign[j]] = [assign[j], assign[i]];
      }
    }
    if (!improved) break;
  }
  return current;
}

function splitKey(assign: number[], players: BalancePlayer[], k: number): string {
  const teams = Array.from({ length: k }, () => [] as string[]);
  assign.forEach((t, i) => teams[t].push(players[i].id));
  return teams
    .map((ids) => ids.sort().join(","))
    .sort()
    .join("|");
}

export function balanceTeams<P extends BalancePlayer>(
  players: P[],
  teamCount: number,
  options: BalanceOptions = {},
): BalanceResult<P> {
  const rng = options.rng ?? Math.random;
  const k = Math.max(1, Math.min(teamCount, players.length));
  if (players.length === 0) return { teams: [], key: "" };

  const ctx = buildContext(players, k);
  const restarts = options.restarts ?? (players.length > 30 ? 20 : 36);
  const found = new Map<string, { assign: number[]; cost: number }>();
  for (let r = 0; r < restarts; r++) {
    const assign = randomAssignment(ctx, rng);
    const c = improve(assign, ctx, rng);
    const key = splitKey(assign, players, k);
    if (!found.has(key)) found.set(key, { assign, cost: c });
  }

  const all = [...found.entries()];
  const best = Math.min(...all.map(([, v]) => v.cost));
  // Anything close to the best split is fair game, so reshuffles give different but balanced teams.
  const tolerance = Math.max(1, best * 0.25);
  let candidates = all.filter(([, v]) => v.cost <= best + tolerance);
  if (options.avoidKey && candidates.length > 1) {
    candidates = candidates.filter(([key]) => key !== options.avoidKey);
  }
  const [key, chosen] = candidates[Math.floor(rng() * candidates.length)];

  const teams: BalancedTeam<P>[] = Array.from({ length: k }, () => ({ players: [], total: 0, average: 0 }));
  chosen.assign.forEach((t, i) => teams[t].players.push(players[i]));
  for (const team of teams) {
    team.players.sort(comparePlayersForLineup);
    team.total = team.players.reduce((s, p) => s + p.rating, 0);
    team.average = team.players.length ? team.total / team.players.length : 0;
  }
  return { teams: shuffle(teams, rng), key };
}

function positionOrder(p: BalancePlayer): number {
  const main = p.positions[0];
  return main ? POSITIONS.indexOf(main) : POSITIONS.length;
}

export function comparePlayersForLineup(a: BalancePlayer, b: BalancePlayer): number {
  return positionOrder(a) - positionOrder(b) || b.rating - a.rating || a.name.localeCompare(b.name, "he");
}

export function summarizeTeam(players: BalancePlayer[]) {
  const total = players.reduce((s, p) => s + p.rating, 0);
  const counts = Object.fromEntries(POSITIONS.map((pos) => [pos, 0])) as Record<Position, number>;
  for (const p of players) if (p.positions[0]) counts[p.positions[0]]++;
  return { total, average: players.length ? total / players.length : 0, counts };
}
