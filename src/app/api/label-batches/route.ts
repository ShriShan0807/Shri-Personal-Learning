import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, requireUser, errorResponse, HttpError } from "@/lib/session";
import { labelBatchSchema } from "@/lib/validation";
import { buildItemCode } from "@/lib/codes";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireUser();
    const batches = await prisma.labelBatch.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        product: { select: { name: true, codePrefix: true } },
        warehouse: { select: { name: true } },
        _count: { select: { items: true } },
      },
    });
    return NextResponse.json({ batches });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireRole("admin");
    const { productId, warehouseId, quantity } = labelBatchSchema.parse(await req.json());

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new HttpError(404, "Product not found.");
    const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse) throw new HttpError(404, "Warehouse not found.");

    // Mint the batch + items in a single transaction. The atomic increment on
    // product.seqCounter guarantees unique, ordered sequence numbers even under
    // concurrent batch generation. A crypto-random suffix deters code forgery.
    const batch = await prisma.$transaction(async (tx) => {
      const created = await tx.labelBatch.create({
        data: {
          productId,
          warehouseId,
          quantity,
          status: "GENERATING",
          requestedById: user.id,
        },
      });

      const updated = await tx.product.update({
        where: { id: productId },
        data: { seqCounter: { increment: quantity } },
        select: { seqCounter: true, codePrefix: true },
      });

      const start = updated.seqCounter - quantity + 1;
      const items = Array.from({ length: quantity }, (_, i) => ({
        code: buildItemCode(updated.codePrefix, start + i),
        productId,
        batchId: created.id,
        warehouseId,
        status: "GENERATED",
      }));

      await tx.item.createMany({ data: items });

      return tx.labelBatch.update({
        where: { id: created.id },
        data: { status: "READY", completedAt: new Date() },
        include: {
          product: { select: { name: true, codePrefix: true } },
          warehouse: { select: { name: true } },
          _count: { select: { items: true } },
        },
      });
    });

    await audit({
      actorUserId: user.id,
      action: "create",
      entity: "label_batch",
      entityId: batch.id,
      metadata: { productId, quantity },
    });

    return NextResponse.json({ batch }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      return NextResponse.json({ error: "Invalid batch request." }, { status: 400 });
    }
    return errorResponse(err);
  }
}
