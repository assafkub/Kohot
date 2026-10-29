"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useApp } from "./AppProvider";
import { btn, input, Spinner } from "./ui";

const NAV = [
  { href: "/", label: "היום", icon: "⚽" },
  { href: "/players", label: "שחקנים", icon: "👥" },
  { href: "/history", label: "היסטוריה", icon: "📋" },
  { href: "/settings", label: "הגדרות", icon: "⚙️" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const { status } = useApp();
  if (status === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (status === "signed-out") return <LoginScreen />;
  if (status === "no-group") return <GroupSetup />;
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <TopBar />
      <main className="flex-1 px-4 pt-3 pb-28">{children}</main>
      <BottomNav />
    </div>
  );
}

function TopBar() {
  const { user, group, mode, signOut } = useApp();
  const [open, setOpen] = useState(false);
  const meta = user?.user_metadata ?? {};
  const name: string = meta.full_name ?? meta.name ?? user?.email ?? "מצב הדגמה";
  const avatar: string | undefined = meta.avatar_url ?? meta.picture;
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-zinc-200 bg-white/95 px-4 py-2 backdrop-blur">
      <Link href="/" className="flex min-w-0 items-center gap-2 font-black text-emerald-800">
        <span className="text-xl">⚽</span>
        <span className="truncate">{group?.name ?? "כוחות"}</span>
      </Link>
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-emerald-700 font-bold text-white ring-2 ring-emerald-100"
          aria-label="תפריט משתמש"
          aria-expanded={open}
        >
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            name.trim().charAt(0).toUpperCase()
          )}
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute end-0 top-11 z-50 w-60 overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-zinc-200">
              <div className="border-b border-zinc-100 px-4 py-3">
                <div className="truncate font-bold">{name}</div>
                {user?.email && (
                  <div className="truncate text-xs text-zinc-500" dir="ltr">
                    {user.email}
                  </div>
                )}
              </div>
              <Link href="/settings" onClick={() => setOpen(false)} className="block px-4 py-3 text-sm active:bg-zinc-50">
                ⚙️ הגדרות וחבורה
              </Link>
              {mode === "supabase" && (
                <button
                  onClick={() => {
                    setOpen(false);
                    signOut();
                  }}
                  className="block w-full px-4 py-3 text-start text-sm font-semibold text-red-700 active:bg-red-50"
                >
                  ↩ התנתקות
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </header>
  );
}

function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 backdrop-blur">
      <div className="mx-auto grid max-w-lg grid-cols-4">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 py-2 text-xs font-semibold ${active ? "text-emerald-700" : "text-zinc-500"}`}
            >
              <span className={`text-xl ${active ? "" : "opacity-60 grayscale"}`}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function LoginScreen() {
  const { signIn } = useApp();
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-gradient-to-b from-emerald-700 to-emerald-900 px-6 text-center text-white">
      <div>
        <div className="text-7xl">⚽</div>
        <h1 className="mt-4 text-4xl font-black">כוחות</h1>
        <p className="mt-2 text-emerald-100">חלוקה מאוזנת לקבוצות, בלחיצה אחת</p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          signIn().finally(() => setBusy(false));
        }}
        className="flex w-full max-w-xs items-center justify-center gap-3 rounded-2xl bg-white px-5 py-4 font-bold text-zinc-800 shadow-lg active:scale-[0.98] disabled:opacity-60"
      >
        <GoogleIcon />
        התחברות עם Google
      </button>
    </div>
  );
}

function GroupSetup() {
  const { createGroup, joinGroup, mode, toast } = useApp();
  const [name, setName] = useState("הכדורגל של השכונה");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const run = (fn: () => Promise<void>) => {
    setBusy(true);
    fn()
      .catch((e: Error) => toast(e.message))
      .finally(() => setBusy(false));
  };
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 px-5 py-10">
      <div className="text-center">
        <div className="text-5xl">⚽</div>
        <h1 className="mt-3 text-2xl font-black">ברוכים הבאים!</h1>
        <p className="mt-1 text-zinc-600">צרו חבורה חדשה, או הצטרפו לחבורה של חבר עם קוד.</p>
      </div>
      <form
        className="space-y-3 rounded-3xl bg-white p-5 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) run(() => createGroup(name));
        }}
      >
        <label className="block text-sm font-semibold">שם החבורה</label>
        <input className={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        <button className={`${btn.primary} w-full`} disabled={busy || !name.trim()}>
          יצירת חבורה
        </button>
      </form>
      {mode === "supabase" && (
        <form
          className="space-y-3 rounded-3xl bg-white p-5 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) run(() => joinGroup(code));
          }}
        >
          <label className="block text-sm font-semibold">יש לך קוד הצטרפות?</label>
          <input
            className={`${input} text-center font-mono tracking-widest uppercase`}
            dir="ltr"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="A1B2C3D4"
            maxLength={8}
          />
          <button className={`${btn.secondary} w-full`} disabled={busy || !code.trim()}>
            הצטרפות
          </button>
        </form>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
