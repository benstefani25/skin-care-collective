"use server";

import { redirect } from "next/navigation";
import { requireFounder } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { logEvent } from "@/lib/events";

export async function saveTechAction(formData: FormData) {
  await requireFounder();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/founder/techs");

  const status = String(formData.get("status") ?? "active");
  const semester = parseInt(String(formData.get("semester_number") ?? "1"), 10) || 1;
  const update: Record<string, unknown> = { status, semester_number: semester };
  if (status === "offboarded") update.offboarded_at = new Date().toISOString();

  await supabaseAdmin().from("techs").update(update).eq("id", id);
  await logEvent({ type: "tech.edited", actor_type: "founder", tech_id: id, payload: { status, semester } });
  redirect("/founder/techs?ok=1");
}
