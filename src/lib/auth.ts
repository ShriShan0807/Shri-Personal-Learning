import { SignJWT, jwtVerify, type JWTPayload } from "jose";

export type Role = "admin" | "owner" | "manager" | "staff";

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
  name?: string | null;
  warehouseId?: string | null;
}

const COOKIE_NAME = "wims_session";

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET is not set or too short (min 16 chars).");
  }
  return new TextEncoder().encode(secret);
}

function maxAgeSeconds(): number {
  const v = Number(process.env.SESSION_MAX_AGE);
  return Number.isFinite(v) && v > 0 ? v : 60 * 60 * 24 * 7;
}

export const SESSION_COOKIE = COOKIE_NAME;

/** Sign a session JWT for the given user. Edge-safe (uses jose). */
export async function signSession(user: SessionUser): Promise<string> {
  const maxAge = maxAgeSeconds();
  return new SignJWT({
    email: user.email,
    role: user.role,
    name: user.name ?? null,
    warehouseId: user.warehouseId ?? null,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${maxAge}s`)
    .sign(getSecret());
}

/** Verify a session JWT and return the SessionUser, or null if invalid. */
export async function verifySession(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payloadToUser(payload);
  } catch {
    return null;
  }
}

function payloadToUser(payload: JWTPayload): SessionUser | null {
  if (!payload.sub || typeof payload.email !== "string" || typeof payload.role !== "string") {
    return null;
  }
  return {
    id: payload.sub,
    email: payload.email,
    role: payload.role as Role,
    name: (payload.name as string | null) ?? null,
    warehouseId: (payload.warehouseId as string | null) ?? null,
  };
}

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds(),
  };
}
