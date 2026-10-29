import { getSupabase } from "./supabase";
import { normalizeName } from "./parseList";
import type { Game, Group, Player, PlayerInput, SavedTeam } from "./types";

export type PlayerPatch = Partial<Pick<Player, "name" | "rating" | "positions" | "active">>;

export interface Repo {
  listGroups(): Promise<Group[]>;
  createGroup(name: string): Promise<Group>;
  joinGroup(code: string): Promise<Group>;
  renameGroup(id: string, name: string): Promise<void>;
  listPlayers(groupId: string): Promise<Player[]>;
  addPlayers(groupId: string, inputs: PlayerInput[]): Promise<Player[]>;
  updatePlayer(id: string, patch: PlayerPatch): Promise<Player>;
  deletePlayers(ids: string[]): Promise<void>;
  saveGame(groupId: string, teams: SavedTeam[]): Promise<void>;
  listGames(groupId: string): Promise<Game[]>;
  deleteGame(id: string): Promise<void>;
}

function toPlayer(row: Record<string, unknown>): Player {
  return { ...(row as unknown as Player), rating: Number(row.rating) };
}

function friendlyError(error: { message: string; code?: string }): Error {
  if (error.code === "23505") return new Error("כבר יש שחקן בשם הזה");
  if (error.message.includes("invalid invite code")) return new Error("קוד הצטרפות לא נמצא");
  return new Error(error.message);
}

export const supabaseRepo: Repo = {
  async listGroups() {
    const { data, error } = await getSupabase().from("groups").select("id, name, invite_code").order("created_at");
    if (error) throw friendlyError(error);
    return data;
  },
  async createGroup(name) {
    const { data, error } = await getSupabase().rpc("create_group", { p_name: name });
    if (error) throw friendlyError(error);
    return data as Group;
  },
  async joinGroup(code) {
    const { data, error } = await getSupabase().rpc("join_group", { p_code: code });
    if (error) throw friendlyError(error);
    return data as Group;
  },
  async renameGroup(id, name) {
    const { error } = await getSupabase().from("groups").update({ name }).eq("id", id);
    if (error) throw friendlyError(error);
  },
  async listPlayers(groupId) {
    const { data, error } = await getSupabase().from("players").select("*").eq("group_id", groupId).order("name");
    if (error) throw friendlyError(error);
    return data.map(toPlayer);
  },
  async addPlayers(groupId, inputs) {
    const rows = inputs.map((p) => ({ ...p, group_id: groupId }));
    const { data, error } = await getSupabase().from("players").insert(rows).select("*");
    if (error) throw friendlyError(error);
    return data.map(toPlayer);
  },
  async updatePlayer(id, patch) {
    const { data, error } = await getSupabase().from("players").update(patch).eq("id", id).select("*").single();
    if (error) throw friendlyError(error);
    return toPlayer(data);
  },
  async deletePlayers(ids) {
    const { error } = await getSupabase().from("players").delete().in("id", ids);
    if (error) throw friendlyError(error);
  },
  async saveGame(groupId, teams) {
    const { error } = await getSupabase().from("games").insert({ group_id: groupId, teams, played_on: today() });
    if (error) throw friendlyError(error);
  },
  async listGames(groupId) {
    const { data, error } = await getSupabase()
      .from("games")
      .select("*")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw friendlyError(error);
    return data as Game[];
  },
  async deleteGame(id) {
    const { error } = await getSupabase().from("games").delete().eq("id", id);
    if (error) throw friendlyError(error);
  },
};

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ---- Local demo mode: everything lives in localStorage of this browser. ----

interface LocalDb {
  groups: Group[];
  players: Player[];
  games: Game[];
}

const LOCAL_KEY = "kohot:local-db:v1";

function loadDb(): LocalDb {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) return JSON.parse(raw) as LocalDb;
  } catch {
    // fall through to an empty db
  }
  return { groups: [], players: [], games: [] };
}

function saveDb(db: LocalDb) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(db));
}

function mutate<T>(fn: (db: LocalDb) => T): T {
  const db = loadDb();
  const result = fn(db);
  saveDb(db);
  return result;
}

const uid = () => crypto.randomUUID();

export const localRepo: Repo = {
  async listGroups() {
    return loadDb().groups;
  },
  async createGroup(name) {
    return mutate((db) => {
      const g = { id: uid(), name: name.trim(), invite_code: "LOCAL" };
      db.groups.push(g);
      return g;
    });
  },
  async joinGroup() {
    throw new Error("הצטרפות עם קוד זמינה רק אחרי חיבור ל-Supabase");
  },
  async renameGroup(id, name) {
    mutate((db) => {
      const g = db.groups.find((x) => x.id === id);
      if (g) g.name = name.trim();
    });
  },
  async listPlayers(groupId) {
    return loadDb()
      .players.filter((p) => p.group_id === groupId)
      .sort((a, b) => a.name.localeCompare(b.name, "he"));
  },
  async addPlayers(groupId, inputs) {
    return mutate((db) => {
      const existing = new Set(db.players.filter((p) => p.group_id === groupId).map((p) => normalizeName(p.name)));
      const created: Player[] = [];
      for (const input of inputs) {
        const key = normalizeName(input.name);
        if (existing.has(key)) throw new Error("כבר יש שחקן בשם הזה");
        existing.add(key);
        created.push({
          ...input,
          name: input.name.trim(),
          id: uid(),
          group_id: groupId,
          active: true,
          created_at: new Date().toISOString(),
        });
      }
      db.players.push(...created);
      return created;
    });
  },
  async updatePlayer(id, patch) {
    return mutate((db) => {
      const p = db.players.find((x) => x.id === id);
      if (!p) throw new Error("השחקן לא נמצא");
      if (patch.name !== undefined) {
        const key = normalizeName(patch.name);
        if (db.players.some((x) => x.id !== id && x.group_id === p.group_id && normalizeName(x.name) === key)) {
          throw new Error("כבר יש שחקן בשם הזה");
        }
      }
      Object.assign(p, patch);
      return { ...p };
    });
  },
  async deletePlayers(ids) {
    mutate((db) => {
      db.players = db.players.filter((p) => !ids.includes(p.id));
    });
  },
  async saveGame(groupId, teams) {
    mutate((db) => {
      db.games.unshift({ id: uid(), group_id: groupId, teams, played_on: today(), created_at: new Date().toISOString() });
    });
  },
  async listGames(groupId) {
    return loadDb().games.filter((g) => g.group_id === groupId);
  },
  async deleteGame(id) {
    mutate((db) => {
      db.games = db.games.filter((g) => g.id !== id);
    });
  },
};
