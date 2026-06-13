import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireRole, errorResponse, HttpError } from "@/lib/session";
import { userInviteSchema } from "@/lib/validation";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole("admin");
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        warehouseId: true,
        createdAt: true,
        warehouse: { select: { name: true } },
      },
    });
    return NextResponse.json({ users });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requireRole("admin");
    const data = userInviteSchema.parse(await req.json());
    const email = data.email.toLowerCase();

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) throw new HttpError(409, `A user with email "${email}" already exists.`);

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        name: data.name ?? null,
        role: data.role,
        warehouseId: data.warehouseId ?? null,
        passwordHash,
        isActive: true,
        invitedById: actor.id,
      },
      select: { id: true, email: true, name: true, role: true, isActive: true, warehouseId: true },
    });

    await audit({
      actorUserId: actor.id,
      action: "create",
      entity: "user",
      entityId: user.id,
      metadata: { email: user.email, role: user.role },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      return NextResponse.json({ error: "Invalid user data." }, { status: 400 });
    }
    return errorResponse(err);
  }
}
