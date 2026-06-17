"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { requireFounder } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { TablesUpdate } from "@/lib/supabase/types";
import { logEvent } from "@/lib/events";

export async function saveMemberAction(formData: FormData) {
  await requireFounder();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/founder/members");

  const db = supabaseAdmin();
  const isLiaison = formData.get("is_liaison") === "on";

  const update: TablesUpdate<"members"> = {
    status: String(formData.get("status") ?? "active"),
    shade_preference: String(formData.get("shade_preference") ?? "").trim() || null,
    service_notes: String(formData.get("service_notes") ?? "").trim() || null,
    standing_appointment: formData.get("standing_appointment") === "on",
    is_liaison: isLiaison,
  };

  // Mint a referral code the first time a member becomes a liaison (T2-8).
  if (isLiaison) {
    const { data: cur } = await db.from("members").select("referral_code").eq("id", id).maybeSingle();
    if (!cur?.referral_code) update.referral_code = randomBytes(5).toString("hex");
  }

  await db.from("members").update(update).eq("id", id);
  await logEvent({ type: "member.edited", actor_type: "founder", member_id: id, payload: { is_liaison: isLiaison } });
  redirect(`/founder/members/${id}?ok=1`);
}
