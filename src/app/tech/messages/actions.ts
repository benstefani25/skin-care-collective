"use server";

import { redirect } from "next/navigation";
import { config } from "@/config/app";
import { requireTech } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { logEvent } from "@/lib/events";
import { sendSms } from "@/lib/twilio";

// Tech replies to a relayed member note. The member's phone number is looked
// up and used server-side only — it never reaches the tech's screen, and the
// text arrives from the brand number.
export async function relayReplyAction(formData: FormData) {
  const tech = await requireTech();
  const memberId = String(formData.get("member_id") ?? "");
  const reply = String(formData.get("reply") ?? "").trim().slice(0, 480);
  if (!memberId || !reply) redirect("/tech/messages?error=1");

  const db = supabaseAdmin();

  // Only allow replying to members who actually have a relay thread with this tech.
  const { data: thread } = await db
    .from("messages")
    .select("id")
    .eq("tech_id", tech.id)
    .eq("member_id", memberId)
    .eq("handled_by", "relay")
    .limit(1)
    .maybeSingle();
  if (!thread) redirect("/tech/messages?error=1");

  const { data: member } = await db
    .from("members")
    .select("phone, house_id")
    .eq("id", memberId)
    .maybeSingle();
  if (!member?.phone) redirect("/tech/messages?error=1");

  await sendSms(member!.phone, `${tech.first_name} (your tan tech): ${reply} — ${config.brandName}`);
  await db.from("messages").insert({
    member_id: memberId,
    tech_id: tech.id,
    direction: "outbound",
    body: reply,
    channel: "sms",
    handled_by: "relay",
  });
  await logEvent({
    type: "message.relayed_to_member",
    actor_type: "tech",
    actor_id: tech.id,
    tech_id: tech.id,
    member_id: memberId,
    house_id: member!.house_id,
  });

  redirect("/tech/messages?ok=1");
}
