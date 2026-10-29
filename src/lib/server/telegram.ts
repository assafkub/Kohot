import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server only: these must never get a NEXT_PUBLIC_ prefix.
export const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
export const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

export const missingBotEnv = [
  ...(botToken ? [] : ["TELEGRAM_BOT_TOKEN"]),
  ...(webhookSecret ? [] : ["TELEGRAM_WEBHOOK_SECRET"]),
  ...(serviceKey ? [] : ["SUPABASE_SERVICE_ROLE_KEY"]),
  ...(url ? [] : ["NEXT_PUBLIC_SUPABASE_URL"]),
];

let admin: SupabaseClient | null = null;

/** Bypasses RLS, so every query here checks the group and role itself. */
export function adminSupabase(): SupabaseClient {
  admin ??= createClient(url!, serviceKey!, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}

export async function telegram(method: string, body: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as { ok: boolean; result?: unknown; description?: string };
}

export function sendMessage(chatId: number, text: string) {
  return telegram("sendMessage", { chat_id: chatId, text });
}
