import type { Assignee } from "./db";

export const WEDDING_DAY = "2027-07-04";
const ZONE = "America/Detroit";

// Calendar dates are plain YYYY-MM-DD strings in Gun Lake's time zone.
export function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONE }).format(
    new Date(),
  );
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) /
      86_400_000,
  );
}

export function formatDate(date: string, withYear = false): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

export function monthLabel(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
}

// "Overdue 3 days", "Due today", "Due in 5 days", or a plain date further out.
export function relativeDue(date: string, now = today()) {
  const days = daysBetween(now, date);
  if (days < 0)
    return { tone: "late", text: `${-days} day${days === -1 ? "" : "s"} late` };
  if (days === 0) return { tone: "soon", text: "Today" };
  if (days === 1) return { tone: "soon", text: "Tomorrow" };
  if (days <= 14) return { tone: "soon", text: `In ${days} days` };
  return { tone: "later", text: formatDate(date, !date.startsWith(now.slice(0, 4))) };
}

export function money(cents: number | null | undefined, exact = false): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: exact ? 2 : 0,
    minimumFractionDigits: exact && cents! % 100 !== 0 ? 2 : 0,
  }).format((cents ?? 0) / 100);
}

export function personName(who: Assignee | string | null | undefined): string {
  if (who === "hannah") return "Hannah";
  if (who === "james") return "James";
  if (who === "both") return "Both of us";
  return "Unassigned";
}

export function timeAgo(iso: string): string {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso.slice(0, 10), true);
}
