import { leadStatuses, type LeadStatus } from "@/lib/types";

export const dashboardPresets = [
  ["today", "Today"], ["yesterday", "Yesterday"], ["7d", "Last 7 days"],
  ["30d", "Last 30 days"], ["month", "This month"], ["custom", "Custom dates"],
] as const;
export const statusLabels: Record<LeadStatus, string> = {
  new: "New", contacted: "Contacted", qualified: "Qualified", won: "Won", not_interested: "Not interested",
};
export type DashboardSearch = Record<string, string | string[] | undefined>;
export type DashboardFilters = ReturnType<typeof parseDashboardFilters>;
const DAY = 86_400_000;

export function shiftDate(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= "2000-01-01" &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

export function parseDashboardFilters(search: DashboardSearch, now = new Date()) {
  const single = (key: string) => typeof search[key] === "string" ? search[key] as string : "";
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  let range: string = dashboardPresets.some(([key]) => key === single("range")) ? single("range") : "7d";
  let end = range === "yesterday" ? shiftDate(today, -1) : today;
  let start = range === "month" ? `${today.slice(0, 7)}-01` : shiftDate(end, range === "30d" ? -29 : range === "7d" ? -6 : 0);
  let warning = "";
  if (range === "custom") {
    const from = single("start"), to = single("end");
    if (!validDate(from) || !validDate(to) || from > to || to > today || (Date.parse(to) - Date.parse(from)) / DAY >= 90) {
      warning = "Choose valid dates in order, up to today and no more than 90 days apart. Showing the last 7 days.";
      range = "7d";
      start = shiftDate(today, -6);
      end = today;
    } else { start = from; end = to; }
  }
  const days = Math.round((Date.parse(end) - Date.parse(start)) / DAY) + 1;
  const status = leadStatuses.includes(single("status") as LeadStatus) ? single("status") as LeadStatus : "";
  return {
    range, start, end, days, today, warning, status,
    source: single("source").slice(0, 200), campaign: single("campaign").slice(0, 200),
    startAt: new Date(`${start}T00:00:00+05:30`).toISOString(),
    endAt: new Date(`${shiftDate(end, 1)}T00:00:00+05:30`).toISOString(),
    previousStart: shiftDate(start, -days), previousEnd: shiftDate(start, -1),
    previousStartAt: new Date(`${shiftDate(start, -days)}T00:00:00+05:30`).toISOString(),
  };
}

export function periodChange(current: number, previous: number) {
  if (!previous) return current ? "No previous leads to compare" : "No change vs previous period";
  const change = ((current - previous) / previous) * 100;
  return `${change > 0 ? "+" : ""}${change.toFixed(1)}% vs previous period`;
}

export function displayDay(date: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}
