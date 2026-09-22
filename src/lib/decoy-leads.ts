import { createHmac } from "node:crypto";

/**
 * Synthetic lead rows for the CSV export's decoy mode.
 *
 * These rows are invented from nothing — no value here is derived from a real
 * lead, not even a timestamp. The only thing borrowed from the database is the
 * row COUNT, so the file is the size someone would expect. That keeps the
 * guarantee simple to state and simple to check: a decoy export leaks nothing
 * but how many leads exist.
 *
 * Generation is deterministic (seeded off the row index), so exporting twice
 * produces byte-identical files. Fresh random names on every download would
 * itself be the tell.
 *
 * Note on the phone numbers: they are structurally valid Indian mobile numbers,
 * which is what makes them believable, and which also means one could in
 * principle belong to a real stranger. Nothing ever dials them, but if you would
 * rather they were unassignable, say so and the prefix can be changed.
 */

const SEED = "global-surat:decoy-leads:v1";

const FIRST_NAMES = [
  "Rajesh", "Priya", "Amit", "Sneha", "Kiran", "Nilesh", "Hetal", "Jigar",
  "Mitesh", "Bhavna", "Darshan", "Foram", "Harsh", "Krupa", "Manish", "Nidhi",
  "Parth", "Rina", "Sagar", "Tejal", "Vishal", "Yogita", "Ankit", "Dhara",
];

const LAST_NAMES = [
  "Patel", "Shah", "Desai", "Mehta", "Joshi", "Trivedi", "Chauhan", "Rana",
  "Bhatt", "Parmar", "Solanki", "Vyas", "Gandhi", "Modi", "Thakkar", "Pandya",
];

const CITIES = [
  "Surat", "Ahmedabad", "Vadodara", "Rajkot", "Bharuch", "Navsari",
  "Anand", "Bhavnagar", "Jamnagar", "Valsad",
];

const SOURCES = ["facebook", "direct", "google", "instagram", "referral"];
const STATUSES = ["new", "contacted", "qualified", "won", "not_interested"];
const LANGUAGES = ["en", "hi", "gu"];
const GROWTH_PATHS = ["lead_generation", "d2c_growth", "seo"];
const BUDGETS = ["under_1_lakh", "1_3_lakh", "3_5_lakh", "above_5_lakh"];
const EMAIL_DOMAINS = ["gmail.com", "yahoo.in", "outlook.com", "rediffmail.com"];

/** A stable stream of numbers for one row, so the same index always yields the same lead. */
function digitsFor(index: number): number[] {
  const digest = createHmac("sha256", SEED).update(String(index)).digest();
  return Array.from(digest);
}

function pick<T>(list: T[], value: number): T {
  return list[value % list.length];
}

export type DecoyLead = {
  id: string;
  createdAt: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  language: string;
  status: string;
  source: string;
  utm: Record<string, string>;
  answers: Record<string, unknown>;
};

export function buildDecoyLeads(count: number): DecoyLead[] {
  const leads: DecoyLead[] = [];
  // Spread the invented rows backwards from a fixed point rather than from
  // `now`, so the same export run twice is identical down to the timestamps.
  const newest = Date.UTC(2026, 8, 12, 9, 30, 0);

  for (let index = 0; index < count; index += 1) {
    const d = digitsFor(index);

    const firstName = pick(FIRST_NAMES, d[0]);
    const lastName = pick(LAST_NAMES, d[1]);
    const mobile = `${6 + (d[2] % 4)}${String(d[3]).padStart(3, "0")}${String(d[4]).padStart(3, "0")}${String(d[5] % 1000).padStart(3, "0")}`.slice(0, 10);
    const growthPath = pick(GROWTH_PATHS, d[10]);

    leads.push({
      id: [
        Buffer.from(d.slice(0, 4)).toString("hex"),
        Buffer.from(d.slice(4, 6)).toString("hex"),
        Buffer.from(d.slice(6, 8)).toString("hex"),
        Buffer.from(d.slice(8, 10)).toString("hex"),
        Buffer.from(d.slice(10, 16)).toString("hex"),
      ].join("-"),
      createdAt: new Date(newest - index * (1000 * 60 * 60 * 19 + d[6] * 90000)).toISOString(),
      name: `${firstName} ${lastName}`,
      phone: `+91${mobile}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${d[7] % 90 + 10}@${pick(EMAIL_DOMAINS, d[8])}`,
      city: pick(CITIES, d[9]),
      language: pick(LANGUAGES, d[11]),
      status: pick(STATUSES, d[12]),
      source: pick(SOURCES, d[13]),
      utm: {
        source: pick(SOURCES, d[13]),
        medium: d[14] % 2 === 0 ? "cpc" : "social",
        campaign: `growth-check-${(d[15] % 9) + 1}`,
        content: "",
        term: "",
        fbclid: "",
        gclid: "",
      },
      answers: {
        growth_path: growthPath,
        full_name: `${firstName} ${lastName}`,
        phone: `+91${mobile}`,
        city: pick(CITIES, d[9]),
        monthly_ad_budget: pick(BUDGETS, d[16]),
      },
    });
  }

  return leads;
}
