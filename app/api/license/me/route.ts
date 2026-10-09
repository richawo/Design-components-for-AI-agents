import { licenseFromRequest, signLicense } from "@/lib/license";
import { requireCommerceLicense } from "@/lib/commerce/licences";
import { commerceFailure, privateJson } from "@/lib/commerce/env";

/** Reads paid access from durable billing state; a success redirect never grants access. */
export async function GET(req: Request) {
  try {
    const result = await requireCommerceLicense(req);
    if (!result.ok) return privateJson({ active: false, reason: result.reason });
    const token = result.license.v === 2 ? signLicense(result.license, 2) : licenseFromRequest(req);
    return privateJson({ active: true, license: result.license, token });
  } catch (error) { return commerceFailure(error); }
}
