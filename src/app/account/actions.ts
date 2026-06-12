"use server";

import { redirect } from "next/navigation";
import { config } from "@/config/app";
import { requireMember } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { logEvent } from "@/lib/events";

export async function savePreferencesAction(formData: FormData) {
  const member = await requireMember();
  const shade = String(formData.get("shade_preference") ?? "").trim() || null;
  const standing = formData.get("standing") === "on";
  const standingWindow = String(formData.get("standing_window") ?? "") || null;

  await supabaseAdmin()
    .from("members")
    .update({
      shade_preference: shade,
      standing_appointment: standing,
      standing_window: standingWindow,
    })
    .eq("id", member.id);

  if (standing !== member.standing_appointment) {
    await logEvent({
      type: "member.standing_toggled",
      actor_type: "member",
      actor_id: member.id,
      member_id: member.id,
      house_id: member.house_id,
      payload: { standing },
    });
  }

  redirect("/account?ok=1");
}

// Pause/cancel/card changes all live in Stripe's portal — no payment surface
// of our own (spec §9).
export async function portalAction() {
  const member = await requireMember();
  if (!member.stripe_customer_id) redirect("/account?error=1");

  const session = await getStripe().billingPortal.sessions.create({
    customer: member.stripe_customer_id,
    return_url: `${config.appBaseUrl}/account`,
  });
  redirect(session.url);
}

export async function logoutAction() {
  const sb = await supabaseServer();
  await sb.auth.signOut();
  redirect("/");
}
