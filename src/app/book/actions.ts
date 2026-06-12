"use server";

import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { bookAppointment, cancelAppointment, rescheduleAppointment } from "@/lib/booking";

// Every action re-derives the member from the session and verifies ownership
// server-side — form fields are never trusted.

export async function bookAction(formData: FormData) {
  const member = await requireMember();
  const slotId = String(formData.get("slot_id") ?? "");
  const room = String(formData.get("room") ?? "").trim() || null;
  if (!slotId) redirect("/book?error=slot_taken");

  const result = await bookAppointment({
    memberId: member.id,
    slotId,
    source: "self_serve",
    actor: { type: "member", id: member.id },
    room,
  });
  redirect(result.ok ? "/book?ok=booked" : `/book?error=${result.error}`);
}

export async function cancelAction(formData: FormData) {
  const member = await requireMember();
  const appointmentId = String(formData.get("appointment_id") ?? "");
  if (!(await ownsAppointment(member.id, appointmentId))) redirect("/book?error=not_yours");

  const result = await cancelAppointment({
    appointmentId,
    actor: { type: "member", id: member.id },
  });
  redirect(
    result.ok
      ? `/book?ok=${result.late ? "cancelled_late" : "cancelled"}`
      : `/book?error=${result.error}`
  );
}

export async function rescheduleAction(formData: FormData) {
  const member = await requireMember();
  const appointmentId = String(formData.get("appointment_id") ?? "");
  const newSlotId = String(formData.get("slot_id") ?? "");
  if (!(await ownsAppointment(member.id, appointmentId))) redirect("/book?error=not_yours");

  const result = await rescheduleAppointment({
    appointmentId,
    newSlotId,
    actor: { type: "member", id: member.id },
  });
  redirect(
    result.ok ? `/book?ok=${result.late ? "moved_late" : "moved"}` : `/book?error=${result.error}`
  );
}

async function ownsAppointment(memberId: string, appointmentId: string): Promise<boolean> {
  if (!appointmentId) return false;
  const { data } = await supabaseAdmin()
    .from("appointments")
    .select("member_id")
    .eq("id", appointmentId)
    .maybeSingle();
  return data?.member_id === memberId;
}
