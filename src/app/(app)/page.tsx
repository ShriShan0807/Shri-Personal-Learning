import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="card">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-3xl font-bold">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

export default async function DashboardPage() {
  const user = await getSession();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [inWarehouse, products, entriesWeek, exitsWeek, generated] = await Promise.all([
    prisma.item.count({ where: { status: "IN_WAREHOUSE" } }),
    prisma.product.count(),
    prisma.movement.count({ where: { type: "ENTRY", scannedAt: { gte: weekAgo } } }),
    prisma.movement.count({ where: { type: "EXIT", scannedAt: { gte: weekAgo } } }),
    prisma.item.count({ where: { status: "GENERATED" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-slate-500">
          Welcome back{user?.name ? `, ${user.name}` : ""}.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="In warehouse" value={inWarehouse} hint="Items currently in stock" />
        <Stat label="Products" value={products} />
        <Stat label="Entries (7d)" value={entriesWeek} />
        <Stat label="Exits (7d)" value={exitsWeek} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/scan" className="card transition hover:shadow-md">
          <div className="text-2xl">📷</div>
          <div className="mt-2 font-semibold">Scan item</div>
          <p className="text-sm text-slate-500">Entry / exit via phone camera.</p>
        </Link>
        <Link href="/inventory" className="card transition hover:shadow-md">
          <div className="text-2xl">📊</div>
          <div className="mt-2 font-semibold">Inventory</div>
          <p className="text-sm text-slate-500">Current stock by product.</p>
        </Link>
        {(user?.role === "admin") && (
          <Link href="/labels" className="card transition hover:shadow-md">
            <div className="text-2xl">🏷️</div>
            <div className="mt-2 font-semibold">Generate labels</div>
            <p className="text-sm text-slate-500">{generated} labels awaiting entry.</p>
          </Link>
        )}
      </div>
    </div>
  );
}
