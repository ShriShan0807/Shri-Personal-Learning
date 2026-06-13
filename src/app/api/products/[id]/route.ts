import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, errorResponse, HttpError } from "@/lib/session";
import { productUpdateSchema } from "@/lib/validation";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole("admin", "manager");
    const data = productUpdateSchema.parse(await req.json());

    const existing = await prisma.product.findUnique({ where: { id: params.id } });
    if (!existing) throw new HttpError(404, "Product not found.");

    const product = await prisma.product.update({
      where: { id: params.id },
      data: {
        name: data.name ?? undefined,
        description: data.description ?? undefined,
        category: data.category ?? undefined,
        unit: data.unit ?? undefined,
        defaultWarehouseId: data.defaultWarehouseId ?? undefined,
      },
    });

    await audit({ actorUserId: user.id, action: "update", entity: "product", entityId: product.id });
    return NextResponse.json({ product });
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      return NextResponse.json({ error: "Invalid product data." }, { status: 400 });
    }
    return errorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole("admin");
    const itemCount = await prisma.item.count({ where: { productId: params.id } });
    if (itemCount > 0) {
      throw new HttpError(409, "Cannot delete a product that has items. Deactivate instead.");
    }
    await prisma.product.delete({ where: { id: params.id } });
    await audit({ actorUserId: user.id, action: "delete", entity: "product", entityId: params.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
