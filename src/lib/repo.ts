import { getSupabase } from "./supabase";
import { normalizeName } from "./parseList";
import type { Game, Group, Member, Player, PlayerInput, PublishedGame, SavedTeam } from "./types";

export interface GameInput {
  id: string | null;
  played_on: string;
  title: string | null;
  teams: SavedTeam[];
}

export type PlayerPatch = Partial<Pick<Player, "name" | "rating" | "positions" | "active">>;

export interface Repo {
  /** Only the super admin creates groups. */
  isSuperAdmin(): Promise<boolean>;
  listGroups(): Promise<Group[]>;
  createGroup(name: string): Promise<Group>;
  joinGroup(code: string): Promise<Group>;
  renameGroup(id: string, name: string): Promise<void>;
  listPlayers(groupId: string): Promise<Player[]>;
  addPlayers(groupId: string, inputs: PlayerInput[]): Promise<Player[]>;
  updatePlayer(id: string, patch: PlayerPatch): Promise<Player>;
  deletePlayers(ids: string[]): Promise<void>;
  /** Creates the game, or updates it when `id` is given and still exists. */
  saveGame(groupId: string, game: GameInput): Promise<Game>;
  listGames(groupId: string): Promise<Game[]>;
  deleteGame(id: string): Promise<void>;
  deleteAllGames(groupId: string): Promise<void>;
  /** Publishing a version unpublishes the other versions of the same day. */
  setGamePublished(id: string, published: boolean): Promise<Game>;
  /** What players see: published games, names and colors only. */
  listPublishedGames(groupId: string): Promise<PublishedGame[]>;
  listMembers(groupId: string): Promise<Member[]>;
  setMemberRole(groupId: string, userId: string, role: Member["role"]): Promise<void>;
  removeMember(groupId: string, userId: string): Promise<void>;
  rotateInviteCode(groupId: string): Promise<string>;
}

function toPlayer(row: Record<string, unknown>): Player {
  return { ...(row as unknown as Player), rating: Number(row.rating) };
}

function friendlyError(error: { message: string; code?: string }): Error {
  if (error.code === "23505") return new Error("כבר יש שחקן בשם הזה");
  if (error.message.includes("invalid invite code")) return new Error("קוד הצטרפות לא נמצא");
  if (error.message.includes("only super admin")) return new Error("רק מנהל המערכת יכול ליצור קבוצה");
  if (error.message.includes("not allowed")) return new Error("אין לך הרשאה לפעולה הזו");
  return new Error(error.message);
}

async function saveGameRow(groupId: string, { id, played_on, title, teams }: GameInput, withTitle = true): Promise<Game> {
  const games = getSupabase().from("games");
  const fields = withTitle ? { played_on, title, teams } : { played_on, teams };
  if (id) {
    const { data, error } = await games.update(fields).eq("id", id).select("*");
    if (error) throw friendlyError(error);
    if (data.length) return data[0] as Game;
  }
  const { data, error } = await games.insert({ ...fields, group_id: groupId }).select("*").single();
  if (error) throw friendlyError(error);
  return data as Game;
}

/** Postgres "function does not exist": the roles migration was not run yet. */
const isMissingFunction = (error: { code?: string }) => error.code === "PGRST202" || error.code === "42883";

export const supabaseRepo: Repo = {
  async isSuperAdmin() {
    const { data, error } = await getSupabase().rpc("whoami");
    if (error) return false;
    return Boolean((data as { super_admin?: boolean } | null)?.super_admin);
  },
  async listGroups() {
    const { data, error } = await getSupabase().rpc("my_groups");
    if (!error) return data as Group[];
    if (!isMissingFunction(error)) throw friendlyError(error);
    // Before the roles migration every member manages the group.
    const old = await getSupabase().from("groups").select("id, name, invite_code").order("created_at");
    if (old.error) throw friendlyError(old.error);
    return old.data.map((g) => ({ ...g, role: "manager" as const }));
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
  async saveGame(groupId, input) {
    try {
      return await saveGameRow(groupId, input);
    } catch (e) {
      // Databases without the title migration yet: save the game without its custom name.
      if (!(e instanceof Error) || !e.message.includes("title")) throw e;
      return saveGameRow(groupId, input, false);
    }
  },
  async listGames(groupId) {
    const { data, error } = await getSupabase()
      .from("games")
      .select("*")
      .eq("group_id", groupId)
      .order("played_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw friendlyError(error);
    return data as Game[];
  },
  async deleteGame(id) {
    const { error } = await getSupabase().from("games").delete().eq("id", id);
    if (error) throw friendlyError(error);
  },
  async deleteAllGames(groupId) {
    const { error } = await getSupabase().from("games").delete().eq("group_id", groupId);
    if (error) throw friendlyError(error);
  },
  async setGamePublished(id, published) {
    const rpc = await getSupabase().rpc("publish_game", { p_game: id, p_publish: published });
    if (!rpc.error) return rpc.data as Game;
    if (!isMissingFunction(rpc.error)) throw friendlyError(rpc.error);
    // Before the versions migration: publish just this game.
    const { data, error } = await getSupabase()
      .from("games")
      .update({ published_at: published ? new Date().toISOString() : null })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw friendlyError(error);
    return data as Game;
  },
  async listPublishedGames(groupId) {
    const { data, error } = await getSupabase().rpc("published_games", { p_group: groupId });
    if (error) throw friendlyError(error);
    return data as PublishedGame[];
  },
  async listMembers(groupId) {
    const { data, error } = await getSupabase()
      .from("group_members")
      .select("user_id, role, display_name, email")
      .eq("group_id", groupId)
      .order("joined_at");
    if (error) throw friendlyError(error);
    return data as Member[];
  },
  async setMemberRole(groupId, userId, role) {
    const { error } = await getSupabase().rpc("set_member_role", { p_group: groupId, p_user: userId, p_role: role });
    if (error) throw friendlyError(error);
  },
  async removeMember(groupId, userId) {
    const { data, error } = await getSupabase()
      .from("group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .select("user_id");
    if (error) throw friendlyError(error);
    if (!data.length) throw new Error("אין לך הרשאה להוציא את החבר הזה");
  },
  async rotateInviteCode(groupId) {
    const { data, error } = await getSupabase().rpc("rotate_invite_code", { p_group: groupId });
    if (error) throw friendlyError(error);
    return data as string;
  },
};


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

// In demo mode you are the super admin of everything.
export const localRepo: Repo = {
  async isSuperAdmin() {
    return true;
  },
  async listGroups() {
    return loadDb().groups.map((g) => ({ ...g, role: "admin" as const }));
  },
  async createGroup(name) {
    return mutate((db) => {
      const g: Group = { id: uid(), name: name.trim(), invite_code: "LOCAL", role: "admin" };
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
  async saveGame(groupId, { id, played_on, title, teams }) {
    return mutate((db) => {
      const existing = id ? db.games.find((g) => g.id === id) : undefined;
      if (existing) {
        Object.assign(existing, { played_on, title, teams });
        return { ...existing };
      }
      const game = { id: uid(), group_id: groupId, teams, played_on, title, created_at: new Date().toISOString() };
      db.games.unshift(game);
      return game;
    });
  },
  async listGames(groupId) {
    return loadDb()
      .games.filter((g) => g.group_id === groupId)
      .sort((a, b) => b.played_on.localeCompare(a.played_on) || b.created_at.localeCompare(a.created_at));
  },
  async deleteGame(id) {
    mutate((db) => {
      db.games = db.games.filter((g) => g.id !== id);
    });
  },
  async deleteAllGames(groupId) {
    mutate((db) => {
      db.games = db.games.filter((g) => g.group_id !== groupId);
    });
  },
  async setGamePublished(id, published) {
    return mutate((db) => {
      const g = db.games.find((x) => x.id === id);
      if (!g) throw new Error("המשחק לא נמצא");
      if (published) {
        for (const other of db.games) {
          if (other.group_id === g.group_id && other.played_on === g.played_on) other.published_at = null;
        }
      }
      g.published_at = published ? new Date().toISOString() : null;
      return { ...g };
    });
  },
  async listPublishedGames(groupId) {
    return (await localRepo.listGames(groupId))
      .filter((g) => g.published_at)
      .map((g) => ({
        id: g.id,
        played_on: g.played_on,
        title: g.title,
        published_at: g.published_at!,
        teams: g.teams.map((t) => ({ name: t.name, color: t.color, players: t.players.map((p) => ({ name: p.name })) })),
      }));
  },
  async listMembers() {
    return [];
  },
  async setMemberRole() {
    throw new Error("ניהול חברים זמין רק אחרי חיבור ל-Supabase");
  },
  async removeMember() {
    throw new Error("ניהול חברים זמין רק אחרי חיבור ל-Supabase");
  },
  async rotateInviteCode() {
    return "LOCAL";
  },
};
