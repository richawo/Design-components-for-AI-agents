import "server-only";
import crypto from "node:crypto";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { DEVICE_HEADER, sanitizeProps, validId, type Props, type ServerEvent } from "./events";
import { deliver, type AnalyticsBindings } from "./sink";

/**
 * Record a conversion only the server can confirm (a Checkout session, a paid
 * purchase). It never throws and never delays the response it accompanies.
 */
export async function trackServer(event: ServerEvent, identity: { userId?: string | null; deviceId?: string | null; insertId?: string }, props: Props = {}) {
  try {
    const context = await getCloudflareContext({ async: true });
    const record = {
      event, time: Date.now(), insertId: identity.insertId ?? crypto.randomUUID(),
      deviceId: validId(identity.deviceId) ? identity.deviceId : null,
      userId: identity.userId ?? null, sessionId: null, source: "server" as const, props: sanitizeProps(props),
    };
    const delivery = deliver(context.env as unknown as AnalyticsBindings, [record]);
    if (context.ctx?.waitUntil) context.ctx.waitUntil(delivery);
    else await delivery;
  } catch {
    // Analytics must never affect commerce.
  }
}

/** The browser's anonymous device id, when a commerce request carried one. */
export const requestDevice = (req: Request) => {
  const value = req.headers.get(DEVICE_HEADER);
  return validId(value) ? value : null;
};
