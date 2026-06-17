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

// House contacts CRM (T2-5) — founder-only roster of house contacts.
export async function addContactAction(formData: FormData) {
  await requireFounder();
  const houseId = String(formData.get("house_id") ?? "");
  const role = String(formData.get("role") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!houseId || !role || !name) redirect(`/founder/houses/${houseId}?error=1`);

  await supabaseAdmin().from("house_contacts").insert({
    house_id: houseId,
    role,
    name,
    contact: String(formData.get("contact") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  });
  await logEvent({ type: "house.contact_added", actor_type: "founder", house_id: houseId, payload: { role } });
  redirect(`/founder/houses/${houseId}?ok=1`);
}

export async function deleteContactAction(formData: FormData) {
  await requireFounder();
  const id = String(formData.get("contact_id") ?? "");
  const houseId = String(formData.get("house_id") ?? "");
  if (id) await supabaseAdmin().from("house_contacts").delete().eq("id", id);
  await logEvent({ type: "house.contact_removed", actor_type: "founder", house_id: houseId, payload: { contact_id: id } });
  redirect(`/founder/houses/${houseId}?ok=1`);
}
