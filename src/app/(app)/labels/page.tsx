"use client";

import { useEffect, useState } from "react";

interface Product { id: string; name: string; codePrefix: string }
interface Warehouse { id: string; name: string }
interface Batch {
  id: string;
  quantity: number;
  status: string;
  createdAt: string;
  product: { name: string; codePrefix: string };
  warehouse: { name: string };
  _count: { items: number };
}

export default function LabelsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [form, setForm] = useState({ productId: "", warehouseId: "", quantity: 10 });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const [p, w, b] = await Promise.all([
      fetch("/api/products").then((r) => r.json()),
      fetch("/api/warehouses").then((r) => r.json()),
      fetch("/api/label-batches").then((r) => r.json()),
    ]);
    setProducts(p.products || []);
    setWarehouses(w.warehouses || []);
    setBatches(b.batches || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/label-batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: form.productId,
          warehouseId: form.warehouseId,
          quantity: Number(form.quantity),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate labels.");
      // Auto-download the freshly generated PDF.
      window.open(`/api/label-batches/${data.batch.id}/pdf`, "_blank");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate labels.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">QR Label Generation</h1>
      <p className="text-sm text-slate-500">
        Order a batch of unique QR labels for a product. Each label is a single-use item code.
      </p>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <form onSubmit={submit} className="card grid gap-4 md:grid-cols-4">
        <div className="md:col-span-2">
          <label className="label">Product</label>
          <select className="input" required value={form.productId}
            onChange={(e) => setForm({ ...form, productId: e.target.value })}>
            <option value="">— select product —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.codePrefix})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Warehouse</label>
          <select className="input" required value={form.warehouseId}
            onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}>
            <option value="">— select —</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Quantity</label>
          <input type="number" min={1} max={5000} className="input" required value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
        </div>
        <div className="md:col-span-4">
          <button className="btn-primary" disabled={submitting}>
            {submitting ? "Generating…" : "Generate & download PDF"}
          </button>
        </div>
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="tbl">
          <thead>
            <tr>
              <th>Created</th>
              <th>Product</th>
              <th>Warehouse</th>
              <th className="text-right">Qty</th>
              <th>Status</th>
              <th>PDF</th>
            </tr>
          </thead>
          <tbody>
            {batches.length === 0 ? (
              <tr><td colSpan={6} className="p-5 text-center text-slate-500">No batches yet.</td></tr>
            ) : (
              batches.map((b) => (
                <tr key={b.id}>
                  <td>{new Date(b.createdAt).toLocaleString()}</td>
                  <td className="font-medium">{b.product.name}</td>
                  <td>{b.warehouse.name}</td>
                  <td className="text-right">{b._count.items}</td>
                  <td>
                    <span className={`badge ${b.status === "READY" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>
                      {b.status}
                    </span>
                  </td>
                  <td>
                    <a className="text-brand-600 hover:underline" href={`/api/label-batches/${b.id}/pdf`} target="_blank">
                      Download
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
