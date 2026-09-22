import "server-only";

import { notFound } from "next/navigation";

/**
 * The admin panel is not mounted at a fixed, guessable path. It answers at
 * whichever URL segments are listed here, and returns the site's ordinary 404
 * for every other segment - including the old `/admin`. This is obscurity,
 * not authentication: the password login behind it is still the actual
 * security boundary. Treat it as one more speed bump against automated
 * scanners hammering a well-known `/admin`, not as access control.
 *
 * Rotatable without a code change via ADMIN_URL_SLUGS (comma-separated).
 * Never put these values in `robots.txt` or in any link on the public site -
 * both are readable by anyone and would publish the "secret" path.
 */
const DEFAULT_ADMIN_SLUGS = ["gsm-admin", "fenil-admin"];

export function adminSlugs(): string[] {
  const raw = process.env.ADMIN_URL_SLUGS;
  if (!raw) return DEFAULT_ADMIN_SLUGS;

  const slugs = raw
    .split(",")
    .map((slug) => slug.trim())
    .filter(Boolean);

  return slugs.length ? slugs : DEFAULT_ADMIN_SLUGS;
}

/** Renders the ordinary 404 page for any segment not in the allowlist. */
export function assertValidAdminSlug(slug: string): void {
  if (!adminSlugs().includes(slug)) notFound();
}
