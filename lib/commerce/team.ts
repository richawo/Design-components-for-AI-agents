import "server-only";
import type { AccountUser } from "./auth";
import { digest, normalizedEmail, rateLimit } from "./auth";
import type { LicenceRow } from "./billing";
import { CommerceError, type CommerceEnv } from "./env";
import { activeLicence } from "./licences";
import { sendMail } from "./mail";

async function ownedTeam(env: CommerceEnv, user: AccountUser, licenceId: string) {
  const row = await env.COMMERCE_DB.prepare("SELECT * FROM licences WHERE id=? AND user_id=?").bind(licenceId, user.id).first<LicenceRow>();
  if (!row) throw new CommerceError(404, "This licence is not in your account.");
  if (row.seats < 2 || !activeLicence(row)) throw new CommerceError(403, "An active Team licence is required to manage seats.");
  return row;
}

export async function inviteMember(env: CommerceEnv, user: AccountUser, licenceId: string, value: unknown) {
  const email = normalizedEmail(value);
  await ownedTeam(env, user, licenceId);
  if (email === user.email) throw new CommerceError(400, "Your account already uses the owner seat.");
  await rateLimit(env, `invite:${user.id}`, 30);
  // Capacity and the insert are one statement. Concurrent invitations cannot overbook the licence.
  await env.COMMERCE_DB.prepare(
    `INSERT OR IGNORE INTO team_members(licence_id, email, created_at)
     SELECT id, ?, ? FROM licences WHERE id=? AND user_id=? AND status='active'
       AND (expires_at IS NULL OR expires_at>?)
       AND (SELECT count(*) FROM team_members WHERE licence_id=licences.id)<seats-1`,
  ).bind(email, Date.now(), licenceId, user.id, Date.now() / 1000).run();
  const member = await env.COMMERCE_DB.prepare("SELECT created_at, invitation_sent_at FROM team_members WHERE licence_id=? AND email=?")
    .bind(licenceId, email).first<{ created_at: number; invitation_sent_at: number | null }>();
  if (!member) throw new CommerceError(409, "All seats are in use. Remove a member before inviting another.");
  if (!member.invitation_sent_at) {
    await sendMail(env, {
      to: email, subject: "Your Design for AI Team invitation", title: "Your team library is ready",
      idempotencyKey: `invite/${licenceId}/${digest(email, env.AUTH_SECRET)}/${member.created_at}`,
      text: "You have been added to a Design for AI Team licence.\n\nSign in with this email address at https://design.yaps.ai/account to get your own licence key, browse Pro components and connect your coding agents.\n\nYou do not need to pay. Your team owner manages billing.",
    });
    await env.COMMERCE_DB.prepare("UPDATE team_members SET invitation_sent_at=? WHERE licence_id=? AND email=? AND created_at=?")
      .bind(Date.now(), licenceId, email, member.created_at).run();
  }
  return { success: true };
}

export async function removeMember(env: CommerceEnv, user: AccountUser, licenceId: string, value: unknown) {
  const email = normalizedEmail(value);
  // Owners can remove seats from inactive licences too, so old invitations can be cleaned up.
  const row = await env.COMMERCE_DB.prepare("SELECT id FROM licences WHERE id=? AND user_id=?").bind(licenceId, user.id).first();
  if (!row) throw new CommerceError(404, "This licence is not in your account.");
  await env.COMMERCE_DB.prepare("DELETE FROM team_members WHERE licence_id=? AND email=?").bind(licenceId, email).run();
  return { success: true };
}
