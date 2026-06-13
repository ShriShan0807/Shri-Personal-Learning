"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";

// Scanner uses browser-only camera APIs, so load it client-side only.
const Scanner = dynamic(() => import("@/components/Scanner"), { ssr: false });

interface Store {
  id: string;
  name: string;
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
  status: "GENERATED" | "IN_WAREHOUSE" | "EXITED";
  enteredAt: string | null;
  exitedAt: string | null;
  product: { name: string; codePrefix: string; unit: string | null };
  warehouse: { name: string };
  store: { name: string } | null;
  movements: Movement[];
}

type Lookup = { item: Item; nextAction: "ENTRY" | "EXIT" | null };
type Mode = "ENTRY" | "EXIT";

const STATUS_STYLE: Record<string, string> = {
  GENERATED: "bg-slate-100 text-slate-700",
  IN_WAREHOUSE: "bg-green-100 text-green-700",
  EXITED: "bg-red-100 text-red-700",
};

export default function ScanPage() {
  const [mode, setMode] = useState<Mode>("ENTRY");
  const [cameraOn, setCameraOn] = useState(false);
  const [manual, setManual] = useState("");
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadStores = useCallback(async () => {
    if (stores.length > 0) return;
    const s = await fetch("/api/stores").then((r) => r.json());
    setStores(s.stores || []);
  }, [stores.length]);

  function changeMode(next: Mode) {
    setMode(next);
    setError(null);
    setToast(null);
    setLookup(null);
    setManual("");
    if (next === "EXIT") loadStores();
  }

  const lookupCode = useCallback(async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setError(null);
    setToast(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/items/by-code/${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lookup failed.");
      setLookup(data);
      setStoreId("");
    } catch (err) {
      setLookup(null);
      setError(err instanceof Error ? err.message : "Lookup failed.");
    } finally {
      setBusy(false);
    }
  }, []);

  const onResult = useCallback((code: string) => {
    setCameraOn(false);
    lookupCode(code);
  }, [lookupCode]);

  async function confirmScan() {
    if (!lookup) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/items/${encodeURIComponent(lookup.item.code)}/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "EXIT" ? { mode, storeId } : { mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scan failed.");
      setToast(
        data.action === "ENTRY"
          ? "✅ Item entered the warehouse."
          : "📦 Item exited to store."
      );
      setLookup(null);
      setManual("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed.");
    } finally {
      setBusy(false);
    }
  }

  const item = lookup?.item;
  // Whether the selected mode is valid for this item's current status.
  const canEnter = item?.status === "GENERATED";
  const canExit = item?.status === "IN_WAREHOUSE";
  const modeAllowed = mode === "ENTRY" ? canEnter : canExit;

  function blockedReason(): string | null {
    if (!item) return null;
    if (mode === "ENTRY") {
      if (item.status === "IN_WAREHOUSE") return "This item has already been entered into the warehouse.";
      if (item.status === "EXITED") return "This item has already exited and cannot be entered again.";
    } else {
      if (item.status === "GENERATED") return "This item has not been entered yet. Switch to Entry mode first.";
      if (item.status === "EXITED") return "This item has already exited the warehouse.";
    }
    return null;
  }

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Scan</h1>
        <p className="text-sm text-slate-500">
          Choose <strong>Entry</strong> or <strong>Exit</strong> mode, then scan a QR label or enter its code.
        </p>
      </div>

      {/* Mode selector */}
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => changeMode("ENTRY")}
          className={`rounded-lg py-2 text-sm font-semibold transition ${
            mode === "ENTRY" ? "bg-white text-green-700 shadow" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          ⬇️ Entry
        </button>
        <button
          type="button"
          onClick={() => changeMode("EXIT")}
          className={`rounded-lg py-2 text-sm font-semibold transition ${
            mode === "EXIT" ? "bg-white text-blue-700 shadow" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          ⬆️ Exit
        </button>
      </div>

      {toast && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-800">{toast}</p>}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {mode === "EXIT" && (
        <div className="card space-y-2">
          <label className="label">Destination store</label>
          <select className="input" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
            <option value="">— select store —</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <p className="text-xs text-slate-400">Required before an item can be scanned out.</p>
        </div>
      )}

      <div className="card space-y-3">
        {cameraOn ? (
          <>
            <Scanner active={cameraOn} onResult={onResult} />
            <button className="btn-secondary w-full" onClick={() => setCameraOn(false)}>
              Stop camera
            </button>
          </>
        ) : (
          <button className="btn-primary w-full" onClick={() => { setCameraOn(true); setLookup(null); }}>
            📷 Start camera ({mode === "ENTRY" ? "Entry" : "Exit"} mode)
          </button>
        )}

        <div className="flex items-center gap-2">
          <input
            className="input"
            placeholder="Enter code, e.g. MILK1L-000123-7F2A"
            value={manual}
            onChange={(e) => setManual(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && lookupCode(manual)}
          />
          <button className="btn-secondary whitespace-nowrap" disabled={busy} onClick={() => lookupCode(manual)}>
            Look up
          </button>
        </div>
      </div>

      {item && (
        <div className="card space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-lg font-semibold">{item.product.name}</div>
              <code className="text-xs text-slate-500">{item.code}</code>
            </div>
            <span className={`badge ${STATUS_STYLE[item.status]}`}>{item.status}</span>
          </div>

          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-slate-500">Warehouse</dt>
            <dd className="text-right">{item.warehouse.name}</dd>
            {item.store && (
              <>
                <dt className="text-slate-500">Store</dt>
                <dd className="text-right">{item.store.name}</dd>
              </>
            )}
          </dl>

          {modeAllowed ? (
            mode === "ENTRY" ? (
              <button className="btn-primary w-full" disabled={busy} onClick={confirmScan}>
                {busy ? "Working…" : "Confirm ENTRY → add to warehouse"}
              </button>
            ) : (
              <button className="btn-primary w-full" disabled={busy || !storeId} onClick={confirmScan}>
                {busy ? "Working…" : storeId ? "Confirm EXIT → ship to store" : "Select a store first"}
              </button>
            )
          ) : (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {blockedReason()}
            </p>
          )}

          {item.movements.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">History</div>
              <ul className="space-y-1 text-sm">
                {item.movements.map((m) => (
                  <li key={m.id} className="flex justify-between">
                    <span>
                      <span className={`badge ${m.type === "ENTRY" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                        {m.type}
                      </span>
                      {m.store ? ` → ${m.store.name}` : ""}
                    </span>
                    <span className="text-slate-400">{new Date(m.scannedAt).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
