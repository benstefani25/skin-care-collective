"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { config } from "@/config/app";
import { rateLimit } from "@/lib/ratelimit";
import { captureLead } from "@/lib/leads";

export async function submitContact(formData: FormData) {
  const hdrs = await headers();
  const ip = (hdrs.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (!rateLimit(`contact:${ip}`, config.signupMaxPerWindow, config.signupWindowMs)) {
    redirect("/contact?error=rate_limited");
  }

  const name = String(formData.get("name") ?? "").trim();
  const contact = String(formData.get("contact") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  if (!name || !contact || !message) redirect("/contact?error=invalid");

  await captureLead("contact", { name, contact, message });
  redirect("/contact?ok=1");
}
