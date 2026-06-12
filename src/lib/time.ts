// Date/time helpers. Postgres gives us `date` as 'YYYY-MM-DD' and `time` as
// 'HH:MM:SS'; all wall-clock math assumes the server runs in (or is configured
// to) the market's timezone — single-market MVP, one TZ in config.

export function slotStart(visitDate: string, startTime: string): Date {
  return new Date(`${visitDate}T${startTime.length === 5 ? `${startTime}:00` : startTime}`);
}

export function hoursUntil(d: Date, from: Date = new Date()): number {
  return (d.getTime() - from.getTime()) / 36e5;
}

export function todayISO(): string {
  return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local
}

export function addDaysISO(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00`); // noon avoids DST edges
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
}

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(min: number): string {
  const h = String(Math.floor(min / 60)).padStart(2, "0");
  const m = String(min % 60).padStart(2, "0");
  return `${h}:${m}:00`;
}

export function fmtDate(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function fmtTime(timeStr: string): string {
  const [h, m] = timeStr.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  const hour = ((h + 11) % 12) + 1;
  return `${hour}:${String(m).padStart(2, "0")}${ampm}`;
}
