import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signSession, cookieOptions, SESSION_COOKIE, type Role } from "@/lib/auth";
import { loginSchema } from "@/lib/validation";
import { audit } from "@/lib/audit";
import { errorResponse, HttpError } from "@/lib/session";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = loginSchema.parse(body);

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    // Constant-ish path: always reject with same message to avoid user enumeration.
    if (!user || !user.isActive || !user.passwordHash) {
      throw new HttpError(401, "Invalid email or password.");
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new HttpError(401, "Invalid email or password.");

    const token = await signSession({
      id: user.id,
      email: user.email,
      role: user.role as Role,
      name: user.name,
      warehouseId: user.warehouseId,
    });

    await audit({ actorUserId: user.id, action: "login", entity: "user", entityId: user.id });

    const res = NextResponse.json({
      user: { id: user.id, email: user.email, role: user.role, name: user.name },
    });
    res.cookies.set(SESSION_COOKIE, token, cookieOptions());
    return res;
  } catch (err) {
    if (err instanceof Error && err.name === "ZodError") {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }
    return errorResponse(err);
  }
}
