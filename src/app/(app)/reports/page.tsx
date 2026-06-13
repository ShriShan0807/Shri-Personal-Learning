"use client";

import { useCallback, useEffect, useState } from "react";

interface Summary {
  rangeDays: number;
  from: string;
  to: string;
  totals: { entries: number; exits: number; inWarehouse: number; generated: number };
  stockByProduct: { productId: string; name: string; codePrefix: string; inWarehouse: number }[];
  lowStock: { productId: string; name: string; inWarehouse: number }[];
  exitsByStore: { storeId: string; name: string; count: number }[];
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`rounded-xl p-4 ${tone}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-slate-600">{label}</div>
    </div>
  );
}

export default function ReportsPage() {
  const [days, setDays] = useState(7);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (d: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/summary?days=${d}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load report.");
      setSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(days);
  }, [days, load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reports</h1>
        <select className="input max-w-[180px]" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {loading || !summary ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          <p className="text-sm text-slate-500">
            {new Date(summary.from).toLocaleDateString()} – {new Date(summary.to).toLocaleDateString()}
          </p>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="In warehouse" value={summary.totals.inWarehouse} tone="bg-slate-100" />
            <Stat label="Entries" value={summary.totals.entries} tone="bg-green-50" />
            <Stat label="Exits" value={summary.totals.exits} tone="bg-blue-50" />
            <Stat label="Awaiting entry" value={summary.totals.generated} tone="bg-amber-50" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card p-0">
              <h2 className="border-b border-slate-100 px-5 py-3 font-semibold">Stock by product</h2>
              <table className="tbl">
                <tbody>
                  {summary.stockByProduct.length === 0 ? (
                    <tr><td className="p-4 text-slate-500">No products.</td></tr>
                  ) : summary.stockByProduct.map((p) => (
                    <tr key={p.productId}>
                      <td className="font-medium">{p.name} <code className="text-xs text-slate-400">{p.codePrefix}</code></td>
                      <td className="text-right font-semibold">{p.inWarehouse}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card p-0">
              <h2 className="border-b border-slate-100 px-5 py-3 font-semibold">Items shipped to stores</h2>
              <table className="tbl">
                <tbody>
                  {summary.exitsByStore.length === 0 ? (
                    <tr><td className="p-4 text-slate-500">No shipments in this period.</td></tr>
                  ) : summary.exitsByStore.map((s) => (
                    <tr key={s.storeId}>
                      <td className="font-medium">{s.name}</td>
                      <td className="text-right font-semibold">{s.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {summary.lowStock.length > 0 && (
            <div className="card border-amber-200 bg-amber-50">
              <h2 className="mb-2 font-semibold text-amber-900">⚠️ Low stock</h2>
              <ul className="flex flex-wrap gap-2">
                {summary.lowStock.map((p) => (
                  <li key={p.productId} className="rounded-lg bg-white px-3 py-1 text-sm">
                    {p.name}: <strong className="text-red-600">{p.inWarehouse}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
