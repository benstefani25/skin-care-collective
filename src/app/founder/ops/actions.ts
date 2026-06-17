"use server";

import { redirect } from "next/navigation";
import { requireFounder } from "@/lib/auth";
import { generateMorningBrief } from "@/lib/ops";

export async function generateBriefAction() {
  await requireFounder();
  await generateMorningBrief();
  redirect("/founder/ops");
}
