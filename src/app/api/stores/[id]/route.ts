import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, errorResponse, HttpError } from "@/lib/session";
import { storeSchema } from "@/lib/validation";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const actor = await requireRole("admin");
    const data = storeSchema.partial().parse(await req.json());

    const existing = await prisma.store.findUnique({ where: { id: params.id } });
    if (!existing) throw new HttpError(404, "Store not found.");

    const store = await prisma.store.update({
      where: { id: params.id },
      data: { name: data.name ?? undefined, location: data.location ?? undefined },
    });
    await audit({ actorUserId: actor.id, action: "update", entity: "store", entityId: store.id });
    return NextResponse.json({ store });
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      return NextResponse.json({ error: "Invalid store data." }, { status: 400 });
    }
    return errorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const actor = await requireRole("admin");
    const itemCount = await prisma.item.count({ where: { storeId: params.id } });
    if (itemCount > 0) {
      throw new HttpError(409, "Cannot delete a store that items have been shipped to.");
    }
    await prisma.store.delete({ where: { id: params.id } });
    await audit({ actorUserId: actor.id, action: "delete", entity: "store", entityId: params.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
