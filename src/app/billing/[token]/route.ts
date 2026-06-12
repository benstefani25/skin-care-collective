// Tokenized landing for dunning SMS links: verifies the member token, mints a
// fresh Stripe customer-portal session, and bounces the member into it.
import { NextResponse } from "next/server";
import { config } from "@/config/app";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifyToken } from "@/lib/links";
import { getStripe } from "@/lib/stripe";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const payload = verifyToken(token);
  if (!payload || payload.scope !== "member") {
    return NextResponse.redirect(`${config.appBaseUrl}/login`);
  }

  const { data: member } = await supabaseAdmin()
    .from("members")
    .select("stripe_customer_id")
    .eq("id", payload.id)
    .maybeSingle();
  if (!member?.stripe_customer_id) {
    return NextResponse.redirect(`${config.appBaseUrl}/login`);
  }

  const session = await getStripe().billingPortal.sessions.create({
    customer: member.stripe_customer_id,
    return_url: config.appBaseUrl,
  });
  return NextResponse.redirect(session.url);
}
