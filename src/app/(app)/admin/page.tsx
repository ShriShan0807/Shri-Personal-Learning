"use client";

import { useEffect, useState } from "react";

type Role = "admin" | "owner" | "manager" | "staff";

interface Warehouse { id: string; name: string; location?: string | null }
interface Store { id: string; name: string; location?: string | null }
interface User {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  isActive: boolean;
  warehouseId: string | null;
  warehouse?: { name: string } | null;
}

const ROLES: Role[] = ["admin", "owner", "manager", "staff"];

export default function AdminPage() {
  const [tab, setTab] = useState<"users" | "warehouses" | "stores">("users");
  const [users, setUsers] = useState<User[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const [u, w, s] = await Promise.all([
        fetch("/api/users").then((r) => r.json()),
        fetch("/api/warehouses").then((r) => r.json()),
        fetch("/api/stores").then((r) => r.json()),
      ]);
      setUsers(u.users || []);
      setWarehouses(w.warehouses || []);
      setStores(s.stores || []);
    } catch {
      setError("Failed to load admin data.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  function flash(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3000);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin Console</h1>

      {notice && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{notice}</p>}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex gap-1 border-b border-slate-200">
        {(["users", "warehouses", "stores"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium capitalize ${
              tab === t ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "users" && (
        <UsersTab users={users} warehouses={warehouses} onChange={load} onError={setError} onFlash={flash} />
      )}
      {tab === "warehouses" && (
        <WarehousesTab warehouses={warehouses} onChange={load} onError={setError} onFlash={flash} />
      )}
      {tab === "stores" && (
        <StoresTab stores={stores} onChange={load} onError={setError} onFlash={flash} />
      )}
    </div>
  );
}

/* ------------------------------- Users ------------------------------- */
function UsersTab({
  users, warehouses, onChange, onError, onFlash,
}: {
  users: User[]; warehouses: Warehouse[];
  onChange: () => void; onError: (m: string) => void; onFlash: (m: string) => void;
}) {
  const [form, setForm] = useState({ email: "", name: "", role: "staff" as Role, warehouseId: "", password: "" });
  const [saving, setSaving] = useState(false);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, warehouseId: form.warehouseId || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create user.");
      setForm({ email: "", name: "", role: "staff", warehouseId: "", password: "" });
      onFlash("User created.");
      onChange();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to create user.");
    } finally {
      setSaving(false);
    }
  }

  async function update(id: string, patch: Partial<User>) {
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed.");
      onFlash("User updated.");
      onChange();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Update failed.");
    }
  }

  async function deactivate(id: string) {
    if (!confirm("Deactivate this user? They will lose access.")) return;
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Deactivate failed.");
      onFlash("User deactivated.");
      onChange();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Deactivate failed.");
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={invite} className="card grid gap-4 md:grid-cols-3">
        <div>
          <label className="label">Email</label>
          <input type="email" required className="input" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label className="label">Name</label>
          <input className="input" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="label">Role</label>
          <select className="input" value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Warehouse (staff/manager)</label>
          <select className="input" value={form.warehouseId}
            onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}>
            <option value="">— none —</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Initial password (min 6)</label>
          <input type="text" required minLength={6} className="input" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <div className="flex items-end">
          <button className="btn-primary w-full" disabled={saving}>
            {saving ? "Creating…" : "Create user"}
          </button>
        </div>
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="tbl">
          <thead>
            <tr><th>Email</th><th>Name</th><th>Role</th><th>Warehouse</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={u.isActive ? "" : "opacity-50"}>
                <td className="font-medium">{u.email}</td>
                <td>{u.name || "—"}</td>
                <td>
                  <select className="input !py-1 text-xs" value={u.role}
                    onChange={(e) => update(u.id, { role: e.target.value as Role })}>
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td>{u.warehouse?.name || "—"}</td>
                <td>
                  <span className={`badge ${u.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                    {u.isActive ? "active" : "inactive"}
                  </span>
                </td>
                <td className="text-right">
                  {u.isActive ? (
                    <button className="text-xs text-red-600 hover:underline" onClick={() => deactivate(u.id)}>
                      Deactivate
                    </button>
                  ) : (
                    <button className="text-xs text-brand-600 hover:underline"
                      onClick={() => update(u.id, { isActive: true })}>
                      Reactivate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ----------------------------- Warehouses ---------------------------- */
function WarehousesTab({
  warehouses, onChange, onError, onFlash,
}: {
  warehouses: Warehouse[]; onChange: () => void; onError: (m: string) => void; onFlash: (m: string) => void;
}) {
  const [form, setForm] = useState({ name: "", location: "" });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/warehouses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, location: form.location || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed.");
      setForm({ name: "", location: "" });
      onFlash("Warehouse created.");
      onChange();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed.");
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this warehouse?")) return;
    try {
      const res = await fetch(`/api/warehouses/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed.");
      onFlash("Warehouse deleted.");
      onChange();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={create} className="card grid gap-4 md:grid-cols-3">
        <div>
          <label className="label">Name</label>
          <input required className="input" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="label">Location</label>
          <input className="input" value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })} />
        </div>
        <div className="flex items-end">
          <button className="btn-primary w-full">Add warehouse</button>
        </div>
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="tbl">
          <thead><tr><th>Name</th><th>Location</th><th></th></tr></thead>
          <tbody>
            {warehouses.map((w) => (
              <tr key={w.id}>
                <td className="font-medium">{w.name}</td>
                <td>{w.location || "—"}</td>
                <td className="text-right">
                  <button className="text-xs text-red-600 hover:underline" onClick={() => remove(w.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------- Stores ------------------------------ */
function StoresTab({
  stores, onChange, onError, onFlash,
}: {
  stores: Store[]; onChange: () => void; onError: (m: string) => void; onFlash: (m: string) => void;
}) {
  const [form, setForm] = useState({ name: "", location: "" });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, location: form.location || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed.");
      setForm({ name: "", location: "" });
      onFlash("Store created.");
      onChange();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed.");
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this store?")) return;
    try {
      const res = await fetch(`/api/stores/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed.");
      onFlash("Store deleted.");
      onChange();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={create} className="card grid gap-4 md:grid-cols-3">
        <div>
          <label className="label">Name</label>
          <input required className="input" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="label">Location</label>
          <input className="input" value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })} />
        </div>
        <div className="flex items-end">
          <button className="btn-primary w-full">Add store</button>
        </div>
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="tbl">
          <thead><tr><th>Name</th><th>Location</th><th></th></tr></thead>
          <tbody>
            {stores.map((s) => (
              <tr key={s.id}>
                <td className="font-medium">{s.name}</td>
                <td>{s.location || "—"}</td>
                <td className="text-right">
                  <button className="text-xs text-red-600 hover:underline" onClick={() => remove(s.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
