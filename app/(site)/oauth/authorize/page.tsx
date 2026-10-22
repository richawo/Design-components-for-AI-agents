import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OAuthConsent, OAuthProblem } from "@/components/site/oauth-consent";
import { SiteI18n } from "@/components/site/site-i18n";
import { SESSION_COOKIE, sessionTokenUser } from "@/lib/commerce/auth";
import { CommerceError, commerceEnv } from "@/lib/commerce/env";
import { accountLicence, checkAuthorization, oauthOrigin } from "@/lib/commerce/oauth";
import { siteCopy } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Connect your agent", robots: { index: false, follow: false } };

/** Where the user returns after approving, phrased so a look-alike client is easy to spot. */
function destination(uri: string) {
  const url = new URL(uri);
  if (url.protocol === "http:") return `this computer (${url.host})`;
  if (url.protocol === "https:") return url.host;
  return `the app that opens ${url.protocol}// links`;
}

export default async function AuthorizePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) for (const item of [value].flat()) if (item !== undefined) params.append(key, item);
  const dictionary = await siteCopy("en", "connect");
  const wrap = (node: React.ReactNode) => <SiteI18n inherit locale="en" dictionary={dictionary}><div className="mx-auto max-w-xl px-5 pb-28 pt-14 sm:px-8 lg:pt-20">{node}</div></SiteI18n>;

  let env;
  try { env = await commerceEnv(); } catch (error) {
    return wrap(<OAuthProblem message={error instanceof CommerceError ? error.message : "Sign-in is temporarily unavailable."} />);
  }
  let check;
  try { check = await checkAuthorization(env, oauthOrigin(), params); } catch (error) {
    return wrap(<OAuthProblem message={error instanceof CommerceError ? error.message : "Sign-in is temporarily unavailable."} />);
  }
  if (!check.ok) {
    if ("redirect" in check) redirect(check.redirect);
    return wrap(<OAuthProblem message={check.fatal} />);
  }
  const user = await sessionTokenUser(env, (await cookies()).get(SESSION_COOKIE)?.value);
  const licence = user ? await accountLicence(env, user) : null;
  return wrap(<OAuthConsent
    query={params.toString()}
    client={check.request.client.name}
    destination={destination(check.request.redirectUri)}
    email={user?.email ?? null}
    pro={licence?.ok ?? false}
  />);
}
