import { Resend } from "resend";

// Swap to a verified smartmoneyfolio.com address once domain verification
// (DNS records in Cloudflare, per the Resend dashboard) is complete. Until
// then, this falls back to Resend's own test sender — emails in that mode
// are only deliverable to the Resend account's own verified email, which is
// fine for development but not for real users. Set RESET_EMAIL_FROM once
// verification is done; no code change needed at that point.
const FROM_ADDRESS = process.env.RESET_EMAIL_FROM ?? "SmartMoneyFolio <onboarding@resend.dev>";

// Constructed lazily, inside the function that actually sends — `new
// Resend(undefined)` throws immediately if RESEND_API_KEY isn't set, and
// Next.js evaluates this module at build time (to collect route page data),
// not just at request time. A module-level `new Resend(...)` would fail the
// whole production build on any environment without the key configured yet
// (e.g. a preview build before Vercel's env var is added).
function getResendClient(): Resend {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const resend = getResendClient();
  await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: "Reset your SmartMoneyFolio password",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Reset your password</h2>
        <p>Someone requested a password reset for this SmartMoneyFolio account. If this was you, click below — this link expires in 1 hour.</p>
        <p><a href="${resetUrl}" style="display:inline-block;background:#10b981;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Reset Password</a></p>
        <p style="color:#64748b;font-size:12px;">If you didn't request this, you can safely ignore this email — your password won't change.</p>
      </div>
    `,
  });
}
