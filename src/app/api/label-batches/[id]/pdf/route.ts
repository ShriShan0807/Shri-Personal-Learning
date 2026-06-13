import { prisma } from "@/lib/prisma";
import { requireRole, HttpError } from "@/lib/session";
import { buildLabelPdf } from "@/lib/pdf";

export const dynamic = "force-dynamic";

// Generate the printable label PDF for a batch on demand (QR + code + name).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole("admin");

    const batch = await prisma.labelBatch.findUnique({
      where: { id: params.id },
      include: { product: { select: { name: true } } },
    });
    if (!batch) throw new HttpError(404, "Batch not found.");

    const items = await prisma.item.findMany({
      where: { batchId: batch.id },
      orderBy: { code: "asc" },
      select: { code: true },
    });

    const pdf = await buildLabelPdf(
      items.map((it) => ({ code: it.code, productName: batch.product.name }))
    );

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="labels-${batch.id}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: err.status,
        headers: { "Content-Type": "application/json" },
      });
    }
    console.error(err);
    return new Response(JSON.stringify({ error: "Failed to generate PDF." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
