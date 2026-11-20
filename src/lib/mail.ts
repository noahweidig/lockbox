export function appUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

type Mail = { to: string; subject: string; text: string; html: string };

export async function sendMail(m: Mail) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV !== "production") console.log(`\n[mail] to=${m.to}\n${m.subject}\n${m.text}\n`);
    else console.warn("RESEND_API_KEY not set; email not sent");
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "LockBox <onboarding@resend.dev>",
      to: m.to,
      subject: m.subject,
      text: m.text,
      html: m.html,
    }),
  });
  if (!res.ok) throw new Error(`Email failed: ${res.status} ${await res.text()}`);
}

function layout(title: string, body: string, url: string, cta: string) {
  return `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
<h2 style="margin:0 0 12px">${title}</h2><p style="line-height:1.5">${body}</p>
<p><a href="${url}" style="display:inline-block;background:#6d5efc;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">${cta}</a></p>
<p style="color:#666;font-size:13px">If the button fails, paste this link into your browser:<br>${url}</p></div>`;
}

export const resetMail = (to: string, url: string): Mail => ({
  to,
  subject: "Reset your LockBox password",
  text: `Reset your password (valid 1 hour): ${url}\n\nResetting a password pauses secret reveals for 24 hours. Ignore this email if you didn't ask.`,
  html: layout(
    "Reset your password",
    "This link is valid for 1 hour. Resetting your password pauses secret reveals for 24 hours. Ignore this email if you didn't request it.",
    url,
    "Reset password",
  ),
});

export const verifyMail = (to: string, url: string): Mail => ({
  to,
  subject: "Confirm your LockBox email",
  text: `Confirm your email: ${url}`,
  html: layout("Confirm your email", "Confirm this address so you can recover your account.", url, "Confirm email"),
});
