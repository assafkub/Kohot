import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Referenced literally so Next.js inlines them into the client bundle.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Without Supabase env vars the app runs in local demo mode (data stays in this browser). */
export const isSupabaseConfigured = Boolean(url && key);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured");
  client ??= createClient(url!, key!, {
    auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}
