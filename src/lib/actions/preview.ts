"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

// Master Admin "Preview as" — stores a narrowing scope in a cookie.
// Value format: "master_admin" | "recruiter" | "client:<clientId>"
export async function setPreviewAction(value: string) {
  const store = await cookies();
  if (!value || value === "master_admin") {
    store.delete("sc_preview");
  } else {
    store.set("sc_preview", value, {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
    });
  }
  revalidatePath("/", "layout");
}
