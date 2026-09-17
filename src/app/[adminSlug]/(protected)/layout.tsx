import type { Metadata } from "next";

import { AdminShell } from "@/components/admin-shell";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Lead Desk",
};

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ adminSlug: string }>;
}) {
  const { adminSlug } = await params;
  const admin = await requireAdmin(adminSlug);
  return <AdminShell adminEmail={admin.email}>{children}</AdminShell>;
}
