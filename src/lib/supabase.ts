import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Referenced literally so Next.js inlines them into the client bundle.
// The key goes by several names depending on which Supabase screen it was copied from.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = (
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
)?.trim();

/** Without Supabase env vars the app runs in local demo mode (data stays in this browser). */
export const isSupabaseConfigured = Boolean(url && key);

/** Names of the missing env vars, shown in demo mode to help with setup. */
export const missingSupabaseEnv = [
  ...(url ? [] : ["NEXT_PUBLIC_SUPABASE_URL"]),
  ...(key ? [] : ["NEXT_PUBLIC_SUPABASE_ANON_KEY"]),
];

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured");
  client ??= createClient(url!, key!, {
    auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}
