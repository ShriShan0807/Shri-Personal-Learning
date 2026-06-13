interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
}

/**
 * Send an email via Resend if RESEND_API_KEY is configured; otherwise log to
 * the console (useful for local development without an email provider).
 */
export async function sendEmail({ to, subject, html }: SendEmailArgs): Promise<{ ok: boolean; provider: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Warehouse <reports@warehouse.local>";

  if (!apiKey) {
    console.log("\n=== EMAIL (console fallback — set RESEND_API_KEY to send for real) ===");
    console.log(`From:    ${from}`);
    console.log(`To:      ${to}`);
    console.log(`Subject: ${subject}`);
    console.log("--- HTML body ---");
    console.log(html);
    console.log("=== END EMAIL ===\n");
    return { ok: true, provider: "console" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend send failed (${res.status}): ${text}`);
  }
  return { ok: true, provider: "resend" };
}
