"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { Role } from "@/lib/auth";

interface NavUser {
  email: string;
  role: Role;
  name?: string | null;
}

const LINKS: { href: string; label: string; roles?: Role[] }[] = [
  { href: "/", label: "Dashboard" },
  { href: "/scan", label: "Scan" },
  { href: "/inventory", label: "Inventory" },
  { href: "/products", label: "Products", roles: ["admin", "manager"] },
  { href: "/labels", label: "Labels", roles: ["admin"] },
  { href: "/reports", label: "Reports", roles: ["admin", "owner", "manager"] },
  { href: "/admin", label: "Admin", roles: ["admin"] },
];

export default function NavBar({ user }: { user: NavUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const links = LINKS.filter((l) => !l.roles || l.roles.includes(user.role));

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">📦</span>
          <span className="font-semibold">Warehouse</span>
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                isActive(l.href)
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <div className="text-sm font-medium">{user.name || user.email}</div>
            <div className="text-xs uppercase tracking-wide text-slate-400">{user.role}</div>
          </div>
          <button onClick={logout} className="btn-secondary !px-3 !py-1.5 text-xs">
            Sign out
          </button>
          <button
            className="rounded-lg border border-slate-300 px-2 py-1 md:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            ☰
          </button>
        </div>
      </div>

      {open && (
        <nav className="flex flex-col gap-1 border-t border-slate-200 px-4 py-2 md:hidden">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                isActive(l.href) ? "bg-brand-50 text-brand-700" : "text-slate-600"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
