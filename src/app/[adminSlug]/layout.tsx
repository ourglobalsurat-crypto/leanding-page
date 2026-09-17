import type { Metadata } from "next";

import { assertValidAdminSlug } from "@/lib/admin-routes";

// Any segment not in the allowlist renders the site's ordinary 404 here, once,
// for the whole admin subtree — login page and dashboard alike.
export const metadata: Metadata = {
  robots: { index: false, follow: false, noarchive: true },
};

export const dynamic = "force-dynamic";

export default async function AdminSlugLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ adminSlug: string }>;
}) {
  const { adminSlug } = await params;
  assertValidAdminSlug(adminSlug);
  return children;
}
