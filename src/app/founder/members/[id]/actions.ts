"use server";

import { redirect } from "next/navigation";
import { requireFounder } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { logEvent } from "@/lib/events";

export async function saveMemberAction(formData: FormData) {
  await requireFounder();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/founder/members");

  await supabaseAdmin()
    .from("members")
    .update({
      status: String(formData.get("status") ?? "active"),
      shade_preference: String(formData.get("shade_preference") ?? "").trim() || null,
      service_notes: String(formData.get("service_notes") ?? "").trim() || null,
      standing_appointment: formData.get("standing_appointment") === "on",
    })
    .eq("id", id);
  await logEvent({ type: "member.edited", actor_type: "founder", member_id: id });
  redirect(`/founder/members/${id}?ok=1`);
}
