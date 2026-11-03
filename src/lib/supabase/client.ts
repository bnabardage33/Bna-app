import { createBrowserClient } from "@supabase/ssr";
import { Database } from "@/types/database.types";

function sanitize(val?: string): string {
  if (!val) return "";
  return val.trim().replace(/^["']|["']$/g, "").replace(/\/+$/, "");
}

export function createClient() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const rawKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const supabaseUrl = sanitize(rawUrl) || "https://placeholder.supabase.co";
  const supabaseKey = sanitize(rawKey) || "sb_publishable_placeholder";

  return createBrowserClient<Database>(supabaseUrl, supabaseKey);
}
