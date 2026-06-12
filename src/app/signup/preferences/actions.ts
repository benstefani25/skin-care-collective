"use server";

import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifyToken } from "@/lib/links";
import { logEvent } from "@/lib/events";

export async function savePreferences(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const payload = verifyToken(token);
  if (!payload || payload.scope !== "member") redirect("/signup?error=invalid");

  const shade = String(formData.get("shade_preference") ?? "").trim() || null;
  const standing = formData.get("standing") === "on";
  const standingWindow = String(formData.get("standing_window") ?? "") || null;

  const db = supabaseAdmin();
  await db
    .from("members")
    .update({
      shade_preference: shade,
      standing_appointment: standing,
      standing_window: standingWindow,
    })
    .eq("id", payload!.id);

  await logEvent({
    type: "member.preferences_set",
    actor_type: "member",
    actor_id: payload!.id,
    member_id: payload!.id,
    payload: { standing, standing_window: standingWindow },
  });

  redirect("/signup/done");
}
