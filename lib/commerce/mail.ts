import "server-only";
import type { CommerceEnv } from "./env";
import { CommerceError } from "./env";

const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

export async function sendMail(env: CommerceEnv, message: {
  to: string; subject: string; title: string; text: string; idempotencyKey: string; code?: string;
}) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) throw new CommerceError(503, "Email delivery is temporarily unavailable.");
  const html = `<!doctype html><html lang="en"><body style="margin:0;padding:32px;background:#101010;color:#fafafa;font-family:Geist,-apple-system,BlinkMacSystemFont,sans-serif"><div style="max-width:560px;margin:auto;border:1px solid #333;border-radius:20px;padding:32px"><p style="font-size:12px;color:#aaa;letter-spacing:2px">DESIGN FOR AI</p><h1 style="font-size:28px">${escape(message.title)}</h1>${message.code ? `<p style="font-size:36px;letter-spacing:8px">${escape(message.code)}</p>` : ""}<p style="line-height:1.7;white-space:pre-wrap">${escape(message.text)}</p><p style="font-size:13px;color:#aaa">A Yaps project. <a style="color:#fff" href="https://design.yaps.ai/account">Your account</a></p></div></body></html>`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST", signal: AbortSignal.timeout(8000),
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": message.idempotencyKey },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [message.to], subject: message.subject, html, text: message.text }),
  });
  if (!response.ok) throw new CommerceError(503, "We could not send the email. Please try again shortly.");
}
