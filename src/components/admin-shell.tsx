"use client";

import {
  BarChart3,
  ClipboardList,
  ExternalLink,
  LogOut,
  Menu,
  Users,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

export function AdminShell({
  children,
  adminEmail,
}: {
  children: React.ReactNode;
  adminEmail: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // The admin base path is not fixed - it's whichever allowed segment the
  // visitor is currently on (see src/lib/admin-routes.ts) - so every link here
  // is built from the live URL rather than a hardcoded "/admin".
  const base = `/${pathname.split("/")[1] ?? ""}`;
  const navigation = [
    { href: base, label: "Overview", icon: BarChart3 },
    { href: `${base}/leads`, label: "Leads", icon: Users },
    { href: `${base}/questionnaire`, label: "Questionnaire", icon: ClipboardList },
  ];

  async function logout() {
    setIsLoggingOut(true);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
      router.replace(`${base}/login`);
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="admin-shell">
      <header className="admin-mobile-header">
        <Image src="/assets/global-surat-logo.png" alt="Global Surat" width={150} height={80} />
        <button type="button" onClick={() => setIsMenuOpen((open) => !open)} aria-label="Toggle admin menu">
          {isMenuOpen ? <X /> : <Menu />}
        </button>
      </header>

      <aside className={isMenuOpen ? "admin-sidebar open" : "admin-sidebar"}>
        <Link href={base} className="admin-brand" onClick={() => setIsMenuOpen(false)}>
          <Image src="/assets/global-surat-logo.png" alt="Global Surat" width={175} height={94} priority />
          <span>LEAD DESK</span>
        </Link>
        <nav aria-label="Admin navigation">
          {navigation.map((item) => {
            const active = item.href === base ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={active ? "active" : ""} onClick={() => setIsMenuOpen(false)}>
                <Icon size={19} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="admin-sidebar-bottom">
          <a href="/contact" target="_blank" rel="noopener noreferrer"><ExternalLink size={17} /> View landing page</a>
          <div className="admin-account">
            <span>{adminEmail.slice(0, 1).toUpperCase()}</span>
            <div><strong>{adminEmail}</strong><small>Administrator</small></div>
          </div>
          <button type="button" onClick={logout} disabled={isLoggingOut}>
            <LogOut size={17} /> {isLoggingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </aside>
      {isMenuOpen && <button className="admin-menu-backdrop" aria-label="Close menu" onClick={() => setIsMenuOpen(false)} />}
      <div className="admin-main">{children}</div>
    </div>
  );
}
