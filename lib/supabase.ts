import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function getSupabaseConfig() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables.");
  }
  return { url: supabaseUrl, anonKey: supabaseAnonKey };
}

export function createServerSupabase(accessToken?: string) {
  const config = getSupabaseConfig();
  return createClient(config.url, config.anonKey, {
    global: accessToken
      ? {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      : undefined,
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function createBrowserSupabase() {
  const config = getSupabaseConfig();
  return createClient(config.url, config.anonKey);
}
