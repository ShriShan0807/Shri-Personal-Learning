"use client";

import { useEffect, useState } from "react";

interface Warehouse {
  id: string;
  name: string;
}
interface Product {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  unit: string | null;
  codePrefix: string;
  inWarehouse: number;
  defaultWarehouse: Warehouse | null;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    name: "",
    codePrefix: "",
    category: "",
    unit: "",
    description: "",
    defaultWarehouseId: "",
  });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [p, w] = await Promise.all([
        fetch("/api/products").then((r) => r.json()),
        fetch("/api/warehouses").then((r) => r.json()),
      ]);
      setProducts(p.products || []);
      setWarehouses(w.warehouses || []);
    } catch {
      setError("Failed to load products.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          codePrefix: form.codePrefix.toUpperCase(),
          defaultWarehouseId: form.defaultWarehouseId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create product.");
      setForm({ name: "", codePrefix: "", category: "", unit: "", description: "", defaultWarehouseId: "" });
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create product.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Products</h1>
        <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Cancel" : "+ New product"}
        </button>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {showForm && (
        <form onSubmit={submit} className="card grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Name</label>
            <input className="input" required value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Code prefix (2-16, A-Z/0-9)</label>
            <input className="input uppercase" required value={form.codePrefix}
              onChange={(e) => setForm({ ...form, codePrefix: e.target.value.toUpperCase() })}
              placeholder="MILK1L" />
          </div>
          <div>
            <label className="label">Category</label>
            <input className="input" value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </div>
          <div>
            <label className="label">Unit</label>
            <input className="input" value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="carton" />
          </div>
          <div>
            <label className="label">Default warehouse</label>
            <select className="input" value={form.defaultWarehouseId}
              onChange={(e) => setForm({ ...form, defaultWarehouseId: e.target.value })}>
              <option value="">— none —</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="label">Description</label>
            <textarea className="input" rows={2} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <button className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Create product"}
            </button>
          </div>
        </form>
      )}

      <div className="card overflow-x-auto p-0">
        {loading ? (
          <p className="p-5 text-sm text-slate-500">Loading…</p>
        ) : products.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">No products yet.</p>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Name</th>
                <th>Prefix</th>
                <th>Category</th>
                <th>Unit</th>
                <th>Warehouse</th>
                <th className="text-right">In warehouse</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium">{p.name}</td>
                  <td><code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{p.codePrefix}</code></td>
                  <td>{p.category || "—"}</td>
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
