import { afterEach, describe, expect, it, vi } from "vitest";
import { commerceFixture } from "./commerce-db";
import { inviteMember, removeMember } from "@/lib/commerce/team";
import { accountDetails, verifiedStoredKey } from "@/lib/commerce/licences";

afterEach(() => vi.unstubAllGlobals());
function fixture() {
  const f = commerceFixture();
  const user = { id: "usr_owner", email: "owner@example.invalid", stripe_customer_id: "cus_owner" };
  f.sql.prepare("INSERT INTO users VALUES (?, ?, ?, ?)").run(user.id, user.email, user.stripe_customer_id, Date.now());
  f.sql.prepare("INSERT INTO licences(id,user_id,checkout_session_id,stripe_customer_id,plan,seats,status,created_at,updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run("lic_team", user.id, "cs_team", "cus_owner", "team-lifetime", 10, "active", Date.now(), Date.now());
  const mail = vi.fn(async () => new Response('{}', { status: 200 }));
  vi.stubGlobal("fetch", mail);
  return { ...f, user, mail };
}
describe("Team licence seats", () => {
  it("counts the owner seat, rejects overbooking, and retries an existing invitation without using a second seat", async () => {
    const f = fixture();
    await Promise.all(Array.from({ length: 9 }, (_, i) => inviteMember(f.env, f.user, "lic_team", `member${i}@example.invalid`)));
    await expect(inviteMember(f.env, f.user, "lic_team", "extra@example.invalid")).rejects.toMatchObject({ status: 409 });
    await inviteMember(f.env, f.user, "lic_team", "member0@example.invalid");
    expect(f.sql.prepare("SELECT count(*) AS n FROM team_members").get()!.n).toBe(9);
    expect(f.mail).toHaveBeenCalledTimes(9);
    await expect(inviteMember(f.env, f.user, "lic_team", f.user.email)).rejects.toMatchObject({ status: 400 });
    f.sql.close();
  });
  it("lets a member recover a personal key, prevents managing another owner's seats, and revokes removed members", async () => {
    const f = fixture();
    const member = { id: "usr_member", email: "member@example.invalid", stripe_customer_id: null };
    f.sql.prepare("INSERT INTO users VALUES (?, ?, NULL, ?)").run(member.id, member.email, Date.now());
    await inviteMember(f.env, f.user, "lic_team", member.email);
    const key = (await accountDetails(f.env, member)).licences[0].token!;
    expect((await verifiedStoredKey(f.env, key)).ok).toBe(true);
    await expect(inviteMember(f.env, member, "lic_team", "other@example.invalid")).rejects.toMatchObject({ status: 404 });
    await expect(removeMember(f.env, member, "lic_team", member.email)).rejects.toMatchObject({ status: 404 });
    f.sql.prepare("UPDATE licences SET seats=1, plan='pro-lifetime'").run();
    expect((await verifiedStoredKey(f.env, key)).ok).toBe(false);
    expect((await accountDetails(f.env, member)).licences).toHaveLength(0);
    await removeMember(f.env, f.user, "lic_team", member.email);
    expect(f.sql.prepare("SELECT count(*) AS n FROM team_members").get()!.n).toBe(0);
    f.sql.close();
  });
  it("keeps an invitation recoverable when email sending fails and permits a safe retry", async () => {
    const f = fixture();
    f.mail.mockResolvedValueOnce(new Response('{}', { status: 500 }));
    await expect(inviteMember(f.env, f.user, "lic_team", "member@example.invalid")).rejects.toMatchObject({ status: 503 });
    expect(f.sql.prepare("SELECT invitation_sent_at FROM team_members").get()!.invitation_sent_at).toBeNull();
    await inviteMember(f.env, f.user, "lic_team", "member@example.invalid");
    expect(f.sql.prepare("SELECT invitation_sent_at FROM team_members").get()!.invitation_sent_at).toBeGreaterThan(0);
    expect(f.mail).toHaveBeenCalledTimes(2);
    f.sql.close();
  });
});
