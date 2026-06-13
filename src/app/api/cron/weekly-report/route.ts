import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildReportSummary, renderReportHtml } from "@/lib/report";
import { sendEmail } from "@/lib/email";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * Weekly report endpoint, intended to be triggered by a scheduler (Vercel Cron,
 * GitHub Actions, etc.). Protected by a shared secret — NOT by user session —
 * so it can be called by an unattended job.
 *
 * Authorize with either:
 *   - Header: `Authorization: Bearer <CRON_SECRET>`
 *   - Query:  `?secret=<CRON_SECRET>`
 */
async function handle(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }

  const url = new URL(req.url);
  const provided =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    url.searchParams.get("secret") ||
    "";

  if (provided !== secret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const summary = await buildReportSummary(7);
  const html = renderReportHtml(summary);

  // Recipient: explicit owner email, else the first active owner, else admin.
  let to = process.env.REPORT_OWNER_EMAIL;
  if (!to) {
    const owner = await prisma.user.findFirst({
      where: { role: "owner", isActive: true },
      select: { email: true },
    });
    to = owner?.email;
  }
  if (!to) {
    const admin = await prisma.user.findFirst({
      where: { role: "admin", isActive: true },
      select: { email: true },
    });
    to = admin?.email;
  }
  if (!to) {
    return NextResponse.json({ error: "No report recipient found." }, { status: 400 });
  }

  const result = await sendEmail({
    to,
    subject: "📦 Weekly Inventory Report",
    html,
  });

  await audit({
    action: "weekly_report_sent",
    entity: "report",
    metadata: { to, provider: result.provider, totals: summary.totals },
  });

  return NextResponse.json({ ok: true, sentTo: to, provider: result.provider, totals: summary.totals });
}

export async function GET(req: Request) {
  try {
    return await handle(req);
  } catch (err) {
    console.error("Weekly report failed:", err);
    return NextResponse.json({ error: "Failed to generate report." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
