"use client";

import { useEffect, useState } from "react";

interface Warehouse {
  id: string;
  name: string;
}
interface Product {
  id: string;
  name: string;
  codePrefix: string;
  unit: string | null;
  inWarehouse: number;
  defaultWarehouse: Warehouse | null;
}
interface Movement {
  id: string;
  type: string;
  scannedAt: string;
  store: { name: string } | null;
  scannedBy: { name: string | null; email: string } | null;
}
interface Item {
  id: string;
  code: string;
  status: string;
  enteredAt: string | null;
  exitedAt: string | null;
  product: { name: string; codePrefix: string };
  warehouse: { name: string };
  store: { name: string } | null;
  movements: Movement[];
}

const STATUS_STYLE: Record<string, string> = {
  GENERATED: "bg-slate-100 text-slate-700",
  IN_WAREHOUSE: "bg-green-100 text-green-700",
  EXITED: "bg-red-100 text-red-700",
};

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [item, setItem] = useState<Item | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((d) => setProducts(d.products || []))
      .finally(() => setLoading(false));
  }, []);

  async function search() {
    const code = query.trim();
    if (!code) return;
    setSearching(true);
    setSearchError(null);
    setItem(null);
    try {
      const res = await fetch(`/api/items/by-code/${encodeURIComponent(code)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Not found.");
      setItem(data.item);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Not found.");
    } finally {
      setSearching(false);
    }
  }

  const totalInWarehouse = products.reduce((sum, p) => sum + p.inWarehouse, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Inventory</h1>
        <p className="text-sm text-slate-500">
          Current stock is the count of items with status <strong>IN_WAREHOUSE</strong>.
        </p>
      </div>

      <div className="card flex items-center justify-between">
        <span className="text-sm text-slate-500">Total items in warehouse</span>
        <span className="text-2xl font-bold">{totalInWarehouse}</span>
      </div>

      <div className="card space-y-2">
        <label className="label">Find an item by code</label>
        <div className="flex items-center gap-2">
          <input
            className="input"
            placeholder="MILK1L-000123-7F2A"
            value={query}
            onChange={(e) => setQuery(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && search()}
          />
          <button className="btn-primary whitespace-nowrap" disabled={searching} onClick={search}>
            {searching ? "Searching…" : "Search"}
          </button>
        </div>
        {searchError && <p className="text-sm text-red-700">{searchError}</p>}

        {item && (
          <div className="mt-3 space-y-3 rounded-lg border border-slate-200 p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold">{item.product.name}</div>
                <code className="text-xs text-slate-500">{item.code}</code>
              </div>
              <span className={`badge ${STATUS_STYLE[item.status] ?? ""}`}>{item.status}</span>
            </div>
            <dl className="grid grid-cols-2 gap-1 text-sm">
              <dt className="text-slate-500">Warehouse</dt>
              <dd className="text-right">{item.warehouse.name}</dd>
              {item.store && (
                <>
                  <dt className="text-slate-500">Shipped to</dt>
                  <dd className="text-right">{item.store.name}</dd>
                </>
              )}
            </dl>
            {item.movements.length > 0 && (
              <ul className="space-y-1 text-sm">
                {item.movements.map((m) => (
                  <li key={m.id} className="flex justify-between">
                    <span>
                      <span className={`badge ${m.type === "ENTRY" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                        {m.type}
                      </span>
                      {m.store ? ` → ${m.store.name}` : ""}
                      {m.scannedBy ? ` · ${m.scannedBy.name || m.scannedBy.email}` : ""}
                    </span>
                    <span className="text-slate-400">{new Date(m.scannedAt).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="card overflow-x-auto p-0">
        {loading ? (
          <p className="p-5 text-sm text-slate-500">Loading…</p>
        ) : products.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">No products yet.</p>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Product</th>
                <th>Prefix</th>
                <th>Unit</th>
                <th>Default warehouse</th>
                <th className="text-right">In warehouse</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium">{p.name}</td>
                  <td><code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{p.codePrefix}</code></td>
                  <td>{p.unit || "—"}</td>
                  <td>{p.defaultWarehouse?.name || "—"}</td>
                  <td className="text-right font-semibold">{p.inWarehouse}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
