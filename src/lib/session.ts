import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession, type Role, type SessionUser } from "./auth";

/** Read and verify the current session from the request cookies (server-side). */
export async function getSession(): Promise<SessionUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  return verifySession(token);
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Returns the session user or throws HttpError(401). For use in route handlers. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) throw new HttpError(401, "Authentication required.");
  return user;
}

/** Returns the session user if their role is allowed, else throws HttpError(403). */
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    throw new HttpError(403, "You do not have permission to perform this action.");
  }
  return user;
}

/** Convert thrown errors (incl. HttpError) into a JSON NextResponse. */
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof HttpError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error("Unhandled API error:", err);
  const message = err instanceof Error ? err.message : "Internal server error.";
  return NextResponse.json({ error: message }, { status: 500 });
}

export const ROLE_RANK: Record<Role, number> = {
  staff: 1,
  manager: 2,
  owner: 3,
  admin: 4,
};
