import { createHmac, randomUUID } from "node:crypto";
import {
  Lead,
  ModernizeError,
  Settings,
  pingPayload,
  postPayload,
  readiness,
  validateLead,
} from "./modernize-contract";

export type DeliveryStatus =
  "processing" | "accepted" | "no_match" | "not_sent" | "unknown";
export type Delivery = {
  reference: string;
  status: DeliveryStatus;
  environment: string;
  payloadHash: string;
  createdAt: number;
  phase: "reserved" | "ping" | "post" | "complete";
  partnerLeadId?: string;
  offeredPrice?: number;
  reason?: string;
};
export type Reservation = {
  lead: Lead;
  receiptKey: string;
  duplicateKey: string;
  certificateKey: string;
  ipKey: string;
  contactKey: string;
  delivery: Delivery;
  consentText: string;
};
export interface DeliveryStore {
  find(receiptKey: string): Promise<Delivery | undefined>;
  reserve(
    input: Reservation,
  ): Promise<{ delivery: Delivery; created: boolean }>;
  update(reference: string, patch: Partial<Delivery>): Promise<void>;
}
type Dependencies = {
  store: DeliveryStore;
  secret: string;
  fetcher?: typeof fetch;
  now?: () => number;
};
export function receiptResult(delivery: Delivery, now = Date.now()) {
  // A process terminated after reserving/sending must never invite an automatic resale.
  const status =
    delivery.status === "processing" && now - delivery.createdAt > 60000
      ? "unknown"
      : delivery.status;
  return {
    reference: delivery.reference,
    status,
    environment: delivery.environment,
  };
}
export async function deliverModernize(
  input: unknown,
  settings: Settings,
  context: { ip: string; hostname: string },
  dependencies: Dependencies,
) {
  if (settings.mode !== "api" || readiness(settings).length)
    throw new ModernizeError(
      "Estimate matching is not open yet. Your details have not been submitted.",
      503,
    );
  if (
    settings.environment === "staging" &&
    !["localhost", "127.0.0.1"].includes(context.hostname)
  )
    throw new ModernizeError(
      "Staging is available only on the local test site.",
      403,
    );
  const lead = validateLead(input, settings);
  const { store, secret } = dependencies;
  const fetcher = dependencies.fetcher || fetch;
  const now = (dependencies.now || Date.now)();
  const hash = (value: string) =>
    createHmac("sha256", secret).update(value).digest("hex");
  const receiptKey = `${settings.environment}-${lead.requestId}`;
  const payloadHash = hash(JSON.stringify(lead));
  const previous = await store.find(receiptKey);
  if (previous) {
    if (previous.payloadHash !== payloadHash)
      throw new ModernizeError(
        "This submission has already been recorded. Reload to start a different request.",
        409,
      );
    return receiptResult(previous, now);
  }
  const token = (input as Record<string, unknown>).turnstileToken;
  if (typeof token !== "string" || !token || token.length > 2048)
    throw new ModernizeError("Complete the security check.");
  try {
    const response = await fetcher(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: new URLSearchParams({ secret, response: token }),
        signal: AbortSignal.timeout(7000),
        redirect: "error",
      },
    );
    const verified = (await response.json()) as {
      success?: boolean;
      hostname?: string;
      action?: string;
    };
    if (
      !response.ok ||
      !verified.success ||
      verified.hostname !== context.hostname ||
      verified.action !== "roofing-intake"
    )
      throw Error();
  } catch {
    throw new ModernizeError(
      "Security verification failed or expired. Please try again.",
      400,
    );
  }
  // Reject contradictory geography. An outage does not silently certify location.
  try {
    const response = await fetcher(`https://api.zippopotam.us/us/${lead.zip}`, {
      signal: AbortSignal.timeout(4000),
      redirect: "error",
    });
    const geo = response.ok
      ? ((await response.json()) as {
          places?: { "state abbreviation": string }[];
        })
      : null;
    if (
      response.status === 404 ||
      (geo?.places?.length &&
        !geo.places.some((p) => p["state abbreviation"] === lead.state))
    )
      throw new ModernizeError("Check the property's ZIP code and state.");
  } catch (error) {
    if (error instanceof ModernizeError) throw error;
  }
  const period = Math.floor(now / 900000),
    day = Math.floor(now / 86400000);
  const reservation = await store.reserve({
    lead,
    receiptKey,
    consentText: settings.consentText,
    duplicateKey: hash(
      `${settings.environment}:${lead.phone}:${lead.zip}:${lead.address.toLowerCase()}:${lead.plan}:${day}`,
    ),
    certificateKey: hash(`${settings.environment}:${lead.trustedFormToken}`),
    ipKey: `ip-${hash(`${context.ip}:${day}`)}-${period}`,
    contactKey: `contact-${hash(lead.phone)}-${period}`,
    delivery: {
      reference: `RZM-${randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`,
      payloadHash,
      status: "processing",
      phase: "reserved",
      createdAt: now,
      environment: settings.environment,
    },
  });
  if (!reservation.created) return receiptResult(reservation.delivery, now);
  const delivery = reservation.delivery;
  const host =
    settings.environment === "production"
      ? "form-service-hs.qnst.com"
      : "hsapiservice.quinstage.com";
  const send = async (path: string, body: unknown) => {
    const response = await fetcher(`https://${host}/ping-post/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
      redirect: "error",
    });
    if (!response.ok) throw Error("Partner HTTP error");
    const data = (await response.json()) as Record<string, unknown>;
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw Error("Invalid partner response");
    return data;
  };
  const finish = async (
    status: DeliveryStatus,
    reason: string,
    extra: Partial<Delivery> = {},
  ) => {
    const patch = { status, reason, phase: "complete" as const, ...extra };
    await store.update(delivery.reference, patch);
    return receiptResult({ ...delivery, ...patch }, now);
  };
  let posting = false;
  try {
    await store.update(delivery.reference, { phase: "ping" });
    const ping = await send("pings", pingPayload(lead, settings));
    if (ping.status === "rejected")
      return await finish("no_match", "ping_rejected");
    if (
      ping.status !== "success" ||
      typeof ping.pingToken !== "string" ||
      !ping.pingToken ||
      ping.pingToken.length > 500
    )
      return await finish("not_sent", "invalid_ping");
    const price =
      typeof ping.price === "string" && /^\d+(\.\d{1,2})?$/.test(ping.price)
        ? Number(ping.price)
        : typeof ping.price === "number"
          ? ping.price
          : NaN;
    if (!Number.isFinite(price) || price < 0)
      return await finish("not_sent", "invalid_price");
    if (price < settings.minimumPrice)
      return await finish("no_match", "below_minimum", { offeredPrice: price });
    // Persist this boundary BEFORE Post. Unknown outcomes are never automatically retried.
    await store.update(delivery.reference, {
      phase: "post",
      offeredPrice: price,
    });
    posting = true;
    const post = await send(
      "posts",
      postPayload(lead, settings, ping.pingToken),
    );
    if (post.status === "rejected")
      return await finish("no_match", "post_rejected");
    if (
      post.status === "success" &&
      typeof post.leadId === "string" &&
      /^[a-zA-Z0-9_-]{1,100}$/.test(post.leadId)
    ) {
      return await finish("accepted", "partner_accepted", {
        partnerLeadId: post.leadId,
      });
    }
    return await finish("unknown", "unconfirmed_post");
  } catch {
    try {
      return await finish(
        posting ? "unknown" : "not_sent",
        posting ? "post_interrupted" : "ping_interrupted",
      );
    } catch {
      return receiptResult({ ...delivery, status: "unknown" }, now);
    }
  }
}
