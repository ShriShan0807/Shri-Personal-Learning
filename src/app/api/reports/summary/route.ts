import { NextResponse } from "next/server";
import { requireRole, errorResponse } from "@/lib/session";
import { buildReportSummary } from "@/lib/report";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireRole("admin", "owner", "manager");
    const url = new URL(req.url);
    const days = Math.min(Math.max(Number(url.searchParams.get("days")) || 7, 1), 90);
    const summary = await buildReportSummary(days);
    return NextResponse.json({ summary });
  } catch (err) {
    return errorResponse(err);
  }
}
