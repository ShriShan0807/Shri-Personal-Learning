import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, requireRole, errorResponse } from "@/lib/session";
import { warehouseSchema } from "@/lib/validation";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireUser();
    const warehouses = await prisma.warehouse.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json({ warehouses });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireRole("admin");
    const data = warehouseSchema.parse(await req.json());
    const warehouse = await prisma.warehouse.create({
      data: { name: data.name, location: data.location ?? null },
    });
    await audit({ actorUserId: user.id, action: "create", entity: "warehouse", entityId: warehouse.id });
    return NextResponse.json({ warehouse }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      return NextResponse.json({ error: "Invalid warehouse data." }, { status: 400 });
    }
    return errorResponse(err);
  }
}
