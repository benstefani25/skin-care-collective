"use server";

import { redirect } from "next/navigation";
import { config } from "@/config/app";
import { requireTech } from "@/lib/auth";
import {
  broadcastRunningLate,
  checkInAppointment,
  checkInVisit,
  checkOutVisit,
  completeAppointment,
  noShowAppointment,
} from "@/lib/techops";

// Thin wrappers: derive the tech from the session, pass ids through to
// techops, which re-verifies ownership and that the work is today's.

export async function visitCheckInAction(formData: FormData) {
  const tech = await requireTech();
  const result = await checkInVisit(String(formData.get("visit_id") ?? ""), tech.id);
  redirect(result.ok ? "/tech?ok=1" : `/tech?error=${result.error}`);
}

export async function visitCheckOutAction(formData: FormData) {
  const tech = await requireTech();
  const result = await checkOutVisit(String(formData.get("visit_id") ?? ""), tech.id);
  redirect(result.ok ? "/tech?ok=1" : `/tech?error=${result.error}`);
}

export async function apptCheckInAction(formData: FormData) {
  const tech = await requireTech();
  const result = await checkInAppointment(String(formData.get("appointment_id") ?? ""), tech.id);
  redirect(result.ok ? "/tech?ok=1" : `/tech?error=${result.error}`);
}

export async function apptCompleteAction(formData: FormData) {
  const tech = await requireTech();
  const result = await completeAppointment(String(formData.get("appointment_id") ?? ""), tech.id);
  redirect(result.ok ? "/tech?ok=1" : `/tech?error=${result.error}`);
}

export async function apptNoShowAction(formData: FormData) {
  const tech = await requireTech();
  const result = await noShowAppointment(String(formData.get("appointment_id") ?? ""), tech.id);
  redirect(result.ok ? "/tech?ok=1" : `/tech?error=${result.error}`);
}

export async function runningLateAction() {
  const tech = await requireTech();
  const result = await broadcastRunningLate(tech.id, config.techLateDefaultMinutes);
  redirect(result.ok ? "/tech?ok=late_sent" : `/tech?error=${result.error}`);
}
