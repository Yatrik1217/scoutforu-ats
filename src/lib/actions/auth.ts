"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signInAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) return { error: "Invalid email or password." };

  // Block deactivated accounts.
  const { data: profile } = await supabase
    .from("profiles")
    .select("active")
    .eq("id", data.user.id)
    .single();
  if (profile && profile.active === false) {
    await supabase.auth.signOut();
    return { error: "Your account has been deactivated. Contact your admin." };
  }

  redirect("/pipeline");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// Set a new password for the signed-in user. Used for the forced first-login
// change and for voluntary changes from the account menu. Clears the
// must_change_password flag on success.
export async function changePasswordAction(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirm) return { error: "The two passwords don't match." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    // Supabase rejects re-using the current password and other weak values.
    return { error: error.message || "Could not update your password." };
  }

  await supabase.from("profiles").update({ must_change_password: false }).eq("id", user.id);

  redirect("/pipeline");
}
