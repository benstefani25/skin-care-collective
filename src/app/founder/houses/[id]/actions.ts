"use server";

import { redirect } from "next/navigation";
import { requireFounder } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { logEvent } from "@/lib/events";

export async function saveHouseAction(formData: FormData) {
  await requireFounder();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/founder/houses");

  const update = {
    status: String(formData.get("status") ?? "prospect"),
    house_director_name: String(formData.get("house_director_name") ?? "").trim() || null,
    house_director_contact: String(formData.get("house_director_contact") ?? "").trim() || null,
    access_notes: String(formData.get("access_notes") ?? "").trim(),
    insurance_note: String(formData.get("insurance_note") ?? "").trim() || null,
  };
  await supabaseAdmin().from("houses").update(update).eq("id", id);
  await logEvent({
    type: "house.updated",
    actor_type: "founder",
    house_id: id,
    payload: { status: update.status },
  });
  redirect(`/founder/houses/${id}?ok=1`);
}
