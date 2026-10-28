"use client";

import { useState } from "react";
import { useApp } from "@/components/AppProvider";
import { btn, input } from "@/components/ui";

export default function SettingsPage() {
  const { group, groups, selectGroup, renameGroup, createGroup, joinGroup, signOut, user, mode, toast } = useApp();
  const [name, setName] = useState(group?.name ?? "");
  const [code, setCode] = useState("");
  const [newGroup, setNewGroup] = useState("");

  const run = (fn: () => Promise<void>, message: string) =>
    fn()
      .then(() => toast(message))
      .catch((e: Error) => toast(e.message));

  const inviteText = group
    ? `בואו לחלק כוחות איתי באפליקציה! קוד הצטרפות לחבורה "${group.name}": ${group.invite_code}\n${window.location.origin}`
    : "";

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black">הגדרות</h1>

      {mode === "local" && (
        <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
          <b>מצב הדגמה:</b> הנתונים נשמרים רק בדפדפן הזה. אחרי חיבור Supabase (ראו README) תהיה התחברות עם Google ושיתוף עם חברים.
        </div>
      )}

      {group && (
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
              <p className="text-sm text-emerald-900">חברים שיצטרפו עם הקוד יוכלו לערוך שחקנים ולחלק קבוצות:</p>
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
            </div>
          )}
        </section>
      )}

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
