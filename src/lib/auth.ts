import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRow } from "@/lib/database.types";

// Current auth user + their profile (role/scope). Returns null if signed out.
export async function getProfile(): Promise<ProfileRow | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  return data ?? null;
}

// Use in protected layouts/pages — redirects to /login if not authenticated.
export async function requireProfile(): Promise<ProfileRow> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return profile;
}
