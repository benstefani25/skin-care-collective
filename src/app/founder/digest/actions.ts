"use server";

import { redirect } from "next/navigation";
import { requireFounder } from "@/lib/auth";
import { runWeeklyDigest } from "@/lib/qc";

export async function generateDigestAction() {
  await requireFounder();
  const result = await runWeeklyDigest();
  redirect(result ? "/founder/digest" : "/founder/digest?error=1");
}
