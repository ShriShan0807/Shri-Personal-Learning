import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, requireRole, errorResponse } from "@/lib/session";
import { storeSchema } from "@/lib/validation";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireUser();
    const stores = await prisma.store.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json({ stores });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireRole("admin");
    const data = storeSchema.parse(await req.json());
    const store = await prisma.store.create({
      data: { name: data.name, location: data.location ?? null },
    });
    await audit({ actorUserId: user.id, action: "create", entity: "store", entityId: store.id });
    return NextResponse.json({ store }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      return NextResponse.json({ error: "Invalid store data." }, { status: 400 });
    }
    return errorResponse(err);
  }
}
