"use server";

import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { appointmentLink, verifyToken } from "@/lib/links";
import { cancelAppointment, rescheduleAppointment } from "@/lib/booking";
import { slotStart } from "@/lib/time";

export async function oneTapSkip(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const payload = verifyToken(token);
  if (!payload || payload.scope !== "appointment") redirect("/");

  const { data: appt } = await supabaseAdmin()
    .from("appointments")
    .select("member_id")
    .eq("id", payload!.id)
    .maybeSingle();

  const result = await cancelAppointment({
    appointmentId: payload!.id,
    actor: { type: "member", id: appt?.member_id ?? null },
    reason: "one_tap_skip",
  });
  redirect(result.ok ? `/a/${token}?done=skipped` : `/a/${token}?error=1`);
}

export async function oneTapMove(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const newSlotId = String(formData.get("slot_id") ?? "");
  const payload = verifyToken(token);
  if (!payload || payload.scope !== "appointment") redirect("/");

  const { data: appt } = await supabaseAdmin()
    .from("appointments")
    .select("member_id")
    .eq("id", payload!.id)
    .maybeSingle();

  const result = await rescheduleAppointment({
    appointmentId: payload!.id,
    newSlotId,
    actor: { type: "member", id: appt?.member_id ?? null },
  });
  if (!result.ok) redirect(`/a/${token}?error=1`);

  // Hand back a token for the NEW appointment so the confirmation page (and
  // any further changes) point at the live booking.
  const db = supabaseAdmin();
  const { data: next } = await db
    .from("appointments")
    .select("*, slot:slots(*, visit:visits(*))")
    .eq("id", result.appointmentId)
    .single();
  const link = appointmentLink(
    result.appointmentId,
    slotStart(next.slot.visit.date, next.slot.start_time)
  );
  redirect(`${link.substring(link.indexOf("/a/"))}?done=moved`);
}
