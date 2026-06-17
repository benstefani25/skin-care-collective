"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { config } from "@/config/app";
import { rateLimit } from "@/lib/ratelimit";
import { captureLead } from "@/lib/leads";

export async function submitHouseLead(formData: FormData) {
  const hdrs = await headers();
  const ip = (hdrs.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (!rateLimit(`lead:${ip}`, config.signupMaxPerWindow, config.signupWindowMs)) {
    redirect("/bring-scc?error=rate_limited");
  }

  const campus = String(formData.get("campus") ?? "").trim();
  const house = String(formData.get("house") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const contact = String(formData.get("contact") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  if (!campus || !house || !name || !contact) redirect("/bring-scc?error=invalid");

  await captureLead("house_lead", { campus, house, name, contact, note });
  redirect("/bring-scc?ok=1");
}
