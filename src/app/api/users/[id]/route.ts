import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireRole, errorResponse, HttpError } from "@/lib/session";
import { userUpdateSchema } from "@/lib/validation";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const actor = await requireRole("admin");
    const body = await req.json();
    const data = userUpdateSchema.parse(body);

    const existing = await prisma.user.findUnique({ where: { id: params.id } });
    if (!existing) throw new HttpError(404, "User not found.");

    // Guard: an admin cannot demote or deactivate their own account.
    if (existing.id === actor.id) {
      if (data.role && data.role !== "admin") {
        throw new HttpError(400, "You cannot change your own admin role.");
      }
      if (data.isActive === false) {
        throw new HttpError(400, "You cannot deactivate your own account.");
      }
    }

    // Optional password reset.
    let passwordHash: string | undefined;
    if (typeof body.password === "string" && body.password.length >= 6) {
      passwordHash = await bcrypt.hash(body.password, 10);
    }

    const user = await prisma.user.update({
      where: { id: params.id },
      data: {
        role: data.role ?? undefined,
        isActive: data.isActive ?? undefined,
        warehouseId: data.warehouseId === undefined ? undefined : data.warehouseId,
        name: data.name ?? undefined,
        passwordHash,
      },
      select: { id: true, email: true, name: true, role: true, isActive: true, warehouseId: true },
    });

    await audit({ actorUserId: actor.id, action: "update", entity: "user", entityId: user.id });
    return NextResponse.json({ user });
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      return NextResponse.json({ error: "Invalid user data." }, { status: 400 });
    }
    return errorResponse(err);
  }
}

// Deactivate (soft-delete). Users are referenced by movements/batches, so we
// never hard-delete — we set isActive=false to revoke access.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const actor = await requireRole("admin");
    if (params.id === actor.id) {
      throw new HttpError(400, "You cannot deactivate your own account.");
    }
    const existing = await prisma.user.findUnique({ where: { id: params.id } });
    if (!existing) throw new HttpError(404, "User not found.");

    await prisma.user.update({ where: { id: params.id }, data: { isActive: false } });
    await audit({ actorUserId: actor.id, action: "deactivate", entity: "user", entityId: params.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
