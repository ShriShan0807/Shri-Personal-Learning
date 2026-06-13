import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, errorResponse, HttpError } from "@/lib/session";
import { warehouseSchema } from "@/lib/validation";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const actor = await requireRole("admin");
    const data = warehouseSchema.partial().parse(await req.json());

    const existing = await prisma.warehouse.findUnique({ where: { id: params.id } });
    if (!existing) throw new HttpError(404, "Warehouse not found.");

    const warehouse = await prisma.warehouse.update({
      where: { id: params.id },
      data: { name: data.name ?? undefined, location: data.location ?? undefined },
    });
    await audit({ actorUserId: actor.id, action: "update", entity: "warehouse", entityId: warehouse.id });
    return NextResponse.json({ warehouse });
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      return NextResponse.json({ error: "Invalid warehouse data." }, { status: 400 });
    }
    return errorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const actor = await requireRole("admin");
    const itemCount = await prisma.item.count({ where: { warehouseId: params.id } });
    if (itemCount > 0) {
      throw new HttpError(409, "Cannot delete a warehouse that has items.");
    }
    await prisma.warehouse.delete({ where: { id: params.id } });
    await audit({ actorUserId: actor.id, action: "delete", entity: "warehouse", entityId: params.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
