import { prisma } from "./prisma";

export interface ReportSummary {
  rangeDays: number;
  from: string;
  to: string;
  totals: {
    entries: number;
    exits: number;
    inWarehouse: number;
    generated: number;
  };
  stockByProduct: { productId: string; name: string; codePrefix: string; inWarehouse: number }[];
  lowStock: { productId: string; name: string; inWarehouse: number }[];
  exitsByStore: { storeId: string; name: string; count: number }[];
}

const LOW_STOCK_THRESHOLD = Number(process.env.LOW_STOCK_THRESHOLD) || 10;

/** Aggregate inventory activity over the last `rangeDays` days plus current stock. */
export async function buildReportSummary(rangeDays = 7): Promise<ReportSummary> {
  const to = new Date();
  const from = new Date(to.getTime() - rangeDays * 24 * 60 * 60 * 1000);

  const [entries, exits, inWarehouse, generated, products, stockGroups, exitGroups] =
    await Promise.all([
      prisma.movement.count({ where: { type: "ENTRY", scannedAt: { gte: from } } }),
      prisma.movement.count({ where: { type: "EXIT", scannedAt: { gte: from } } }),
      prisma.item.count({ where: { status: "IN_WAREHOUSE" } }),
      prisma.item.count({ where: { status: "GENERATED" } }),
      prisma.product.findMany({ select: { id: true, name: true, codePrefix: true } }),
      prisma.item.groupBy({
        by: ["productId"],
        where: { status: "IN_WAREHOUSE" },
        _count: { _all: true },
      }),
      prisma.movement.groupBy({
        by: ["storeId"],
        where: { type: "EXIT", scannedAt: { gte: from }, storeId: { not: null } },
        _count: { _all: true },
      }),
    ]);

  const stockMap = new Map(stockGroups.map((s) => [s.productId, s._count._all]));
  const stockByProduct = products
    .map((p) => ({
      productId: p.id,
      name: p.name,
      codePrefix: p.codePrefix,
      inWarehouse: stockMap.get(p.id) ?? 0,
    }))
    .sort((a, b) => b.inWarehouse - a.inWarehouse);

  const lowStock = stockByProduct
    .filter((p) => p.inWarehouse < LOW_STOCK_THRESHOLD)
    .map(({ productId, name, inWarehouse }) => ({ productId, name, inWarehouse }));

  const storeIds = exitGroups.map((g) => g.storeId as string);
  const stores = storeIds.length
    ? await prisma.store.findMany({ where: { id: { in: storeIds } }, select: { id: true, name: true } })
    : [];
  const storeNameMap = new Map(stores.map((s) => [s.id, s.name]));
  const exitsByStore = exitGroups
    .map((g) => ({
      storeId: g.storeId as string,
      name: storeNameMap.get(g.storeId as string) ?? "Unknown",
      count: g._count._all,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    rangeDays,
    from: from.toISOString(),
    to: to.toISOString(),
    totals: { entries, exits, inWarehouse, generated },
    stockByProduct,
    lowStock,
    exitsByStore,
  };
}

/** Render a report summary as a self-contained HTML email body. */
export function renderReportHtml(s: ReportSummary): string {
  const fmt = (d: string) => new Date(d).toLocaleDateString();
  const row = (cells: (string | number)[]) =>
    `<tr>${cells.map((c) => `<td style="padding:6px 10px;border-bottom:1px solid #eee">${c}</td>`).join("")}</tr>`;

  const stockRows = s.stockByProduct.length
    ? s.stockByProduct.map((p) => row([`${p.name} <code>${p.codePrefix}</code>`, p.inWarehouse])).join("")
    : row(["No products", "—"]);

  const lowRows = s.lowStock.length
    ? s.lowStock.map((p) => row([p.name, `<strong style="color:#b91c1c">${p.inWarehouse}</strong>`])).join("")
    : row(["None 🎉", "—"]);

  const storeRows = s.exitsByStore.length
    ? s.exitsByStore.map((g) => row([g.name, g.count])).join("")
    : row(["No shipments this period", "—"]);

  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:0 auto;color:#0f172a">
    <h1 style="font-size:20px">📦 Weekly Inventory Report</h1>
    <p style="color:#64748b;font-size:14px">${fmt(s.from)} – ${fmt(s.to)} (last ${s.rangeDays} days)</p>

    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr>
        <td style="padding:12px;background:#f1f5f9;border-radius:8px">
          <div style="font-size:24px;font-weight:700">${s.totals.inWarehouse}</div>
          <div style="font-size:12px;color:#64748b">In warehouse</div>
        </td>
        <td style="padding:12px;background:#f0fdf4;border-radius:8px">
          <div style="font-size:24px;font-weight:700">${s.totals.entries}</div>
          <div style="font-size:12px;color:#64748b">Entries</div>
        </td>
        <td style="padding:12px;background:#eff6ff;border-radius:8px">
          <div style="font-size:24px;font-weight:700">${s.totals.exits}</div>
          <div style="font-size:12px;color:#64748b">Exits</div>
        </td>
        <td style="padding:12px;background:#fafafa;border-radius:8px">
          <div style="font-size:24px;font-weight:700">${s.totals.generated}</div>
          <div style="font-size:12px;color:#64748b">Awaiting entry</div>
        </td>
      </tr>
    </table>

    <h2 style="font-size:16px">Stock by product</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px"><tbody>${stockRows}</tbody></table>

    <h2 style="font-size:16px;margin-top:20px">Low stock (&lt; ${LOW_STOCK_THRESHOLD})</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px"><tbody>${lowRows}</tbody></table>

    <h2 style="font-size:16px;margin-top:20px">Items shipped to stores</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px"><tbody>${storeRows}</tbody></table>

    <p style="color:#94a3b8;font-size:12px;margin-top:24px">Warehouse Inventory Management System — automated report.</p>
  </div>`;
}
