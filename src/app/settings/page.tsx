"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { btn, input } from "@/components/ui";
import { missingSupabaseEnv } from "@/lib/supabase";
import type { GroupRole, Member } from "@/lib/types";

const ROLE_LABEL: Record<GroupRole, string> = { admin: "מנהל מערכת", manager: "מנהל", player: "שחקן" };

export default function SettingsPage() {
  const {
    group,
    groups,
    selectGroup,
    renameGroup,
    rotateInviteCode,
    leaveGroup,
    createGroup,
    joinGroup,
    signOut,
    user,
    mode,
    manager,
    superAdmin,
    toast,
    ask,
  } = useApp();
  const [name, setName] = useState(group?.name ?? "");
  const [code, setCode] = useState("");
  const [newGroup, setNewGroup] = useState("");

  const run = (fn: () => Promise<void>, message: string) =>
    fn()
      .then(() => toast(message))
      .catch((e: Error) => toast(e.message));

  const inviteText = group
    ? `הצטרפו לחבורה "${group.name}" כדי לראות את הכוחות! קוד הצטרפות: ${group.invite_code}\n${window.location.origin}`
    : "";

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black">הגדרות</h1>

      {mode === "local" && (
        <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
          <b>מצב הדגמה:</b> הנתונים נשמרים רק בדפדפן הזה. אחרי חיבור Supabase (ראו README) תהיה התחברות עם Google ושיתוף עם חברים.
          <div className="mt-2 text-xs" dir="ltr">
            Missing in this build: {missingSupabaseEnv.join(", ")}
          </div>
        </div>
      )}

      {group && !manager && (
        <section className="space-y-3 rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="font-bold">החבורה</h2>
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">{group.name}</span>
            <span className="rounded-lg bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">{ROLE_LABEL[group.role]}</span>
          </div>
          <button
            className={btn.danger}
            onClick={async () => {
              const ok = await ask({ title: `לצאת מהחבורה "${group.name}"?`, message: "אפשר לחזור עם קוד ההצטרפות.", confirmLabel: "יציאה", danger: true });
              if (ok) run(leaveGroup, "יצאת מהחבורה");
            }}
          >
            יציאה מהחבורה
          </button>
        </section>
      )}

      {group && manager && (
        <section className="space-y-3 rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="font-bold">החבורה</h2>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) run(() => renameGroup(name.trim()), "השם עודכן ✓");
            }}
          >
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
            <button className={btn.secondary} disabled={!name.trim() || name.trim() === group.name}>
              שמירה
            </button>
          </form>
          {mode === "supabase" && (
            <div className="rounded-2xl bg-emerald-50 p-4">
              <p className="text-sm text-emerald-900">מי שמצטרף עם הקוד נכנס כשחקן ורואה רק כוחות שפורסמו:</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="font-mono text-2xl font-black tracking-widest text-emerald-800" dir="ltr">
                  {group.invite_code}
                </span>
                <button
                  className={btn.secondary}
                  onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(inviteText)}`, "_blank")}
                >
                  📤 שליחה
                </button>
              </div>
              <button
                className="mt-2 text-xs font-semibold text-emerald-800 underline"
                onClick={async () => {
                  const ok = await ask({ title: "ליצור קוד חדש?", message: "הקוד הנוכחי יפסיק לעבוד. מי שכבר בחבורה נשאר.", confirmLabel: "קוד חדש" });
                  if (ok) run(rotateInviteCode, "נוצר קוד חדש ✓");
                }}
              >
                ↻ יצירת קוד חדש
              </button>
            </div>
          )}
        </section>
      )}

      {group && manager && mode === "supabase" && <MembersSection key={group.id} />}

      {groups.length > 1 && (
        <section className="space-y-2 rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="font-bold">החבורות שלי</h2>
          {groups.map((g) => (
            <button
              key={g.id}
              onClick={() => {
                selectGroup(g.id);
                setName(g.name);
              }}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 ${g.id === group?.id ? "bg-emerald-700 text-white" : "bg-zinc-50"}`}
            >
              {g.name}
              {g.id === group?.id && <span>✓</span>}
            </button>
          ))}
        </section>
      )}

      <section className="space-y-3 rounded-3xl bg-white p-5 shadow-sm">
        <h2 className="font-bold">חבורה נוספת</h2>
        {superAdmin && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (newGroup.trim())
                run(async () => {
                  await createGroup(newGroup.trim());
                  setNewGroup("");
                }, "החבורה נוצרה ✓");
            }}
          >
            <input className={input} value={newGroup} onChange={(e) => setNewGroup(e.target.value)} placeholder="שם חבורה חדשה" />
            <button className={btn.secondary} disabled={!newGroup.trim()}>
              יצירה
            </button>
          </form>
        )}
        {mode === "supabase" && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim())
                run(async () => {
                  await joinGroup(code.trim());
                  setCode("");
                }, "הצטרפת לחבורה ✓");
            }}
          >
            <input
              className={`${input} font-mono uppercase`}
              dir="ltr"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="קוד הצטרפות"
              maxLength={8}
            />
            <button className={btn.secondary} disabled={!code.trim()}>
              הצטרפות
            </button>
          </form>
        )}
      </section>

      {mode === "supabase" && (
        <section className="flex items-center justify-between rounded-3xl bg-white p-5 shadow-sm">
          <span className="min-w-0 truncate text-sm text-zinc-600" dir="ltr">
            {user?.email}
          </span>
          <button className={btn.danger} onClick={() => signOut()}>
            התנתקות
          </button>
        </section>
      )}
    </div>
  );
}

function MembersSection() {
  const { group, repo, user, superAdmin, toast, ask } = useApp();
  const [members, setMembers] = useState<Member[] | null>(null);

  const load = useCallback(() => {
    if (!group) return;
    repo
      .listMembers(group.id)
      .then(setMembers)
      .catch((e: Error) => toast(e.message));
  }, [group, repo, toast]);

  useEffect(load, [load]);

  if (!group || !members) return null;
  const managers = members.filter((m) => m.role === "manager").length;

  const act = (fn: () => Promise<void>, message: string) =>
    fn()
      .then(() => {
        toast(message);
        load();
      })
      .catch((e: Error) => toast(e.message));

  return (
    <section className="space-y-2 rounded-3xl bg-white p-5 shadow-sm">
      <h2 className="font-bold">
        חברים ({members.length}, {managers} מנהלים)
      </h2>
      {members.length === 0 && <p className="text-sm text-zinc-500">עוד אף אחד לא הצטרף עם הקוד.</p>}
      <ul className="divide-y divide-zinc-100">
        {members.map((m) => {
          const label = m.display_name || m.email || "ללא שם";
          const me = m.user_id === user?.id;
          // Managers remove players; only the super admin appoints, demotes or removes managers.
          const canRemove = !me && (superAdmin || m.role === "player");
          return (
            <li key={m.user_id} className="flex items-center gap-2 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">
                  {label}
                  {me && <span className="text-xs font-normal text-zinc-500"> (את/ה)</span>}
                </div>
                {m.email && m.display_name && (
                  <div className="truncate text-xs text-zinc-500" dir="ltr">
                    {m.email}
                  </div>
                )}
              </div>
              {superAdmin ? (
                <button
                  className={`rounded-lg px-2 py-1 text-xs font-semibold ${m.role === "manager" ? "bg-emerald-700 text-white" : "bg-zinc-100 text-zinc-700"}`}
                  onClick={() => {
                    const role = m.role === "manager" ? "player" : "manager";
                    act(() => repo.setMemberRole(group.id, m.user_id, role), role === "manager" ? `${label} מנהל עכשיו ✓` : `${label} שחקן עכשיו`);
                  }}
                >
                  {m.role === "manager" ? "מנהל ✓" : "הפוך למנהל"}
                </button>
              ) : (
                <span className="rounded-lg bg-zinc-100 px-2 py-1 text-xs text-zinc-600">{ROLE_LABEL[m.role]}</span>
              )}
              {canRemove && (
                <button
                  className="rounded-lg px-2 py-1 text-xs font-semibold text-red-700 active:bg-red-50"
                  aria-label={`הוצאת ${label}`}
                  onClick={async () => {
                    const ok = await ask({ title: `להוציא את ${label} מהחבורה?`, message: "אפשר לחזור עם קוד ההצטרפות.", confirmLabel: "הוצאה", danger: true });
                    if (ok) act(() => repo.removeMember(group.id, m.user_id), "הוצא מהחבורה");
                  }}
                >
                  ✕
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
