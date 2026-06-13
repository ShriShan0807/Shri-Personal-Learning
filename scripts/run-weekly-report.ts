/**
 * Weekly report runner — generates the inventory summary and emails it to the
 * owner. Run via `npm run cron:weekly`. Intended for schedulers that prefer a
 * script (GitHub Actions, system cron) over the HTTP endpoint.
 *
 * Uses the same aggregation + email helpers as /api/cron/weekly-report.
 */
import { prisma } from "../src/lib/prisma";
import { buildReportSummary, renderReportHtml } from "../src/lib/report";
import { sendEmail } from "../src/lib/email";
import { audit } from "../src/lib/audit";

async function main() {
  const summary = await buildReportSummary(7);
  const html = renderReportHtml(summary);

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
    throw new Error("No report recipient found (set REPORT_OWNER_EMAIL or seed an owner/admin).");
  }

  const result = await sendEmail({ to, subject: "📦 Weekly Inventory Report", html });
  await audit({
    action: "weekly_report_sent",
    entity: "report",
    metadata: { to, provider: result.provider, totals: summary.totals },
  });

  console.log(`Weekly report sent to ${to} via ${result.provider}.`);
  console.log("Totals:", summary.totals);
}

main()
  .catch((err) => {
    console.error("Weekly report failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
