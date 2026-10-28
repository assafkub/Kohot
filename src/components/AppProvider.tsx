"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { localRepo, supabaseRepo, type PlayerPatch, type Repo } from "@/lib/repo";
import type { Group, Player, PlayerInput } from "@/lib/types";
import { readStored, writeStored } from "@/lib/storage";

type Status = "loading" | "signed-out" | "no-group" | "ready";

interface AppState {
  status: Status;
  mode: "local" | "supabase";
  user: User | null;
  repo: Repo;
  groups: Group[];
  group: Group | null;
  players: Player[];
  playersLoading: boolean;
  selectGroup(id: string): void;
  createGroup(name: string): Promise<void>;
  joinGroup(code: string): Promise<void>;
  renameGroup(name: string): Promise<void>;
  addPlayers(inputs: PlayerInput[]): Promise<Player[]>;
  updatePlayer(id: string, patch: PlayerPatch): Promise<void>;
  deletePlayer(id: string): Promise<void>;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  toast(message: string): void;
}

const AppContext = createContext<AppState | null>(null);

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

const GROUP_KEY = "kohot:current-group";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const mode = isSupabaseConfigured ? "supabase" : "local";
  const repo = mode === "supabase" ? supabaseRepo : localRepo;
  const [authReady, setAuthReady] = useState(mode === "local");
  const [user, setUser] = useState<User | null>(null);
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loadedGroupId, setLoadedGroupId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const toast = useCallback((message: string) => {
    setToastMessage(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMessage(null), 2600);
  }, []);

  // Auth (Supabase mode only).
  useEffect(() => {
    if (mode !== "supabase") return;
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setAuthReady(true);
      if (data.session && new URLSearchParams(window.location.search).has("code")) {
        window.history.replaceState(null, "", window.location.pathname);
      }
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, [mode]);

  const signedIn = mode === "local" || Boolean(user);

  const loadGroups = useCallback(async () => {
    const list = await repo.listGroups();
    const stored = readStored<string | null>(GROUP_KEY, null);
    setGroups(list);
    setGroupId(list.find((g) => g.id === stored)?.id ?? list[0]?.id ?? null);
  }, [repo]);

  useEffect(() => {
    if (!authReady || !signedIn) return;
    let cancelled = false;
    repo
      .listGroups()
      .then((list) => {
        if (cancelled) return;
        const stored = readStored<string | null>(GROUP_KEY, null);
        setGroups(list);
        setGroupId(list.find((g) => g.id === stored)?.id ?? list[0]?.id ?? null);
      })
      .catch((e: Error) => {
        toast(e.message);
        setGroups([]);
      });
    return () => {
      cancelled = true;
    };
  }, [authReady, signedIn, repo, toast]);

  // Players of the current group; "loading" until the list for this group has arrived.
  useEffect(() => {
    if (!groupId) return;
    let cancelled = false;
    repo
      .listPlayers(groupId)
      .then((list) => {
        if (cancelled) return;
        setPlayers(list);
        setLoadedGroupId(groupId);
      })
      .catch((e: Error) => toast(e.message));
    return () => {
      cancelled = true;
    };
  }, [groupId, repo, toast]);

  const playersLoading = Boolean(groupId) && loadedGroupId !== groupId;

  const group = groups?.find((g) => g.id === groupId) ?? null;

  const status: Status = !authReady
    ? "loading"
    : !signedIn
      ? "signed-out"
      : groups === null
        ? "loading"
        : group
          ? "ready"
          : "no-group";

  const value = useMemo<AppState>(() => {
    const requireGroup = () => {
      if (!groupId) throw new Error("לא נבחרה חבורה");
      return groupId;
    };
    const sortByName = (list: Player[]) => list.sort((a, b) => a.name.localeCompare(b.name, "he"));
    return {
      status,
      mode,
      user,
      repo,
      groups: groups ?? [],
      group,
      players,
      playersLoading,
      toast,
      selectGroup(id) {
        writeStored(GROUP_KEY, id);
        setGroupId(id);
      },
      async createGroup(name) {
        const g = await repo.createGroup(name);
        writeStored(GROUP_KEY, g.id);
        await loadGroups();
      },
      async joinGroup(code) {
        const g = await repo.joinGroup(code);
        writeStored(GROUP_KEY, g.id);
        await loadGroups();
      },
      async renameGroup(name) {
        await repo.renameGroup(requireGroup(), name);
        setGroups((list) => list?.map((g) => (g.id === groupId ? { ...g, name } : g)) ?? list);
      },
      async addPlayers(inputs) {
        const created = await repo.addPlayers(requireGroup(), inputs);
        setPlayers((list) => sortByName([...list, ...created]));
        return created;
      },
      async updatePlayer(id, patch) {
        const updated = await repo.updatePlayer(id, patch);
        setPlayers((list) => sortByName(list.map((p) => (p.id === id ? updated : p))));
      },
      async deletePlayer(id) {
        await repo.deletePlayer(id);
        setPlayers((list) => list.filter((p) => p.id !== id));
      },
      async signIn() {
        const { error } = await getSupabase().auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: window.location.origin },
        });
        if (error) toast(error.message);
      },
      async signOut() {
        if (mode === "supabase") await getSupabase().auth.signOut();
        setGroups(null);
        setGroupId(null);
        setPlayers([]);
      },
    };
  }, [status, mode, user, repo, groups, group, groupId, players, playersLoading, toast, loadGroups]);

  return (
    <AppContext.Provider value={value}>
      {children}
      {toastMessage && (
        <div className="fixed inset-x-4 top-4 z-50 mx-auto max-w-sm rounded-xl bg-zinc-900 px-4 py-3 text-center text-sm text-white shadow-lg">
          {toastMessage}
        </div>
      )}
    </AppContext.Provider>
  );
}
