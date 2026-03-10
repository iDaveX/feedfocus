import { createClient } from "@supabase/supabase-js";
import { getEnv } from "@/src/server/env";
import dns from "node:dns";

type SupabaseAdminClient = ReturnType<typeof createClient<any>>;

let cached: SupabaseAdminClient | null = null;

export function getSupabaseAdmin(): SupabaseAdminClient {
  if (!cached) {
    try {
      dns.setDefaultResultOrder("ipv4first");
    } catch {
      // ignore
    }
    const env = getEnv();
    cached = createClient<any>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }
  return cached;
}
