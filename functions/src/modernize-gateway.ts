import { onRequest } from "firebase-functions/v2/https";
import { defineSecret, defineString } from "firebase-functions/params";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import {
  ModernizeError,
  publicConfig,
  readSettings,
} from "./modernize-contract";
import {
  Delivery,
  DeliveryStore,
  deliverModernize,
} from "./modernize-delivery";

const MODERNIZE_SETTINGS = defineSecret("MODERNIZE_SETTINGS");
const TURNSTILE_SECRET_KEY = defineSecret("TURNSTILE_SECRET_KEY");
const PUBLIC_ALLOWED_ORIGINS = defineString("PUBLIC_ALLOWED_ORIGINS", {
  default: "https://roofzeus.com,https://www.roofzeus.com",
});

export function firestoreDeliveryStore(): DeliveryStore {
  const db = getFirestore("roofzeus-leads");
  const requests = db.collection("modernizeRequests"),
    receipts = db.collection("modernizeReceipts");
  return {
    async find(key) {
      const receipt = await receipts.doc(key).get();
      if (!receipt.exists) return undefined;
      const record = await requests.doc(receipt.get("reference")).get();
      if (!record.exists)
        throw new ModernizeError("This request needs operator review.", 409);
      return {
        ...record.data(),
        payloadHash: receipt.get("payloadHash"),
      } as Delivery;
    },
    async reserve(input) {
      return db.runTransaction(async (tx) => {
        const receiptRef = receipts.doc(input.receiptKey);
        const duplicateRef = db
          .collection("modernizeDuplicates")
          .doc(input.duplicateKey);
        const certificateRef = db
          .collection("modernizeCertificates")
          .doc(input.certificateKey);
        const ipRef = db.collection("modernizeRateLimits").doc(input.ipKey);
        const contactRef = db
          .collection("modernizeRateLimits")
          .doc(input.contactKey);
        const [receipt, duplicate, certificate, ip, contact] =
          await Promise.all(
            [receiptRef, duplicateRef, certificateRef, ipRef, contactRef].map(
              (ref) => tx.get(ref),
            ),
          );
        if (receipt.exists) {
          if (receipt.get("payloadHash") !== input.delivery.payloadHash)
            throw new ModernizeError(
              "This submission has already been recorded.",
              409,
            );
          const record = await tx.get(requests.doc(receipt.get("reference")));
          if (!record.exists)
            throw new ModernizeError(
              "This request needs operator review.",
              409,
            );
          return {
            created: false,
            delivery: {
              ...record.data(),
              payloadHash: input.delivery.payloadHash,
            } as Delivery,
          };
        }
        if ((ip.get("count") || 0) >= 6 || (contact.get("count") || 0) >= 3)
          throw new ModernizeError(
            "Too many requests. Please wait 15 minutes.",
            429,
          );
        if (certificate.exists && !duplicate.exists)
          throw new ModernizeError(
            "This form verification has already been used. Reload to start another request.",
            409,
          );
        const createdAt = input.delivery.createdAt;
        const expiresAt = Timestamp.fromMillis(createdAt + 90 * 86400000);
        // All reads precede all writes, including the existing duplicate outcome.
        const existing = duplicate.exists
          ? await tx.get(requests.doc(duplicate.get("reference")))
          : null;
        if (existing && !existing.exists)
          throw new ModernizeError("This request needs operator review.", 409);
        const reference = existing
          ? duplicate.get("reference")
          : input.delivery.reference;
        for (const [ref, snapshot] of [
          [ipRef, ip],
          [contactRef, contact],
        ] as const)
          tx.set(ref, {
            count: (snapshot.get("count") || 0) + 1,
            expiresAt: Timestamp.fromMillis(createdAt + 2 * 86400000),
          });
        tx.create(receiptRef, {
          reference,
          payloadHash: input.delivery.payloadHash,
          expiresAt,
        });
        if (existing)
          return { created: false, delivery: existing.data() as Delivery };
        tx.create(requests.doc(reference), {
          ...input.delivery,
          lead: input.lead,
          consentText: input.consentText,
          consentReceivedAt: createdAt,
          updatedAt: createdAt,
          expiresAt,
        });
        tx.create(duplicateRef, {
          reference,
          expiresAt: Timestamp.fromMillis(createdAt + 2 * 86400000),
        });
        tx.create(certificateRef, { reference, expiresAt });
        return { created: true, delivery: input.delivery };
      });
    },
    async update(reference, patch) {
      await requests.doc(reference).update({ ...patch, updatedAt: Date.now() });
    },
  };
}
export const modernizeGateway = onRequest(
  {
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 60,
    maxInstances: 10,
    secrets: [MODERNIZE_SETTINGS, TURNSTILE_SECRET_KEY],
    invoker: "public",
  },
  async (req, res) => {
    res.set("Cache-Control", "no-store");
    const origin = req.get("origin") || "";
    const origins = PUBLIC_ALLOWED_ORIGINS.value()
      .split(",")
      .map((s) => s.trim());
    if (!origins.includes(origin)) {
      res.status(403).json({ error: "This origin is not allowed." });
      return;
    }
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Vary", "Origin");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }
    try {
      const settings = readSettings(MODERNIZE_SETTINGS.value());
      const path = req.path.replace(/\/$/, "");
      if (req.method === "GET" && path === "/config") {
        const visible = publicConfig(settings);
        if (
          settings.environment === "staging" &&
          !["localhost", "127.0.0.1"].includes(new URL(origin).hostname)
        ) {
          res.json({
            ...visible,
            enabled: false,
            consentText: "",
            trustedFormScriptUrl: "",
            affiliateUrl: "",
          });
        } else res.json(visible);
        return;
      }
      if (req.method !== "POST" || path !== "/submit") {
        res.status(404).json({ error: "Unknown endpoint." });
        return;
      }
      if (!req.is("application/json") || (req.rawBody?.length || 0) > 16000)
        throw new ModernizeError("Invalid request size or format.");
      const result = await deliverModernize(
        req.body,
        settings,
        { ip: req.ip || "unknown", hostname: new URL(origin).hostname },
        {
          store: firestoreDeliveryStore(),
          secret: TURNSTILE_SECRET_KEY.value(),
        },
      );
      res.status(result.status === "processing" ? 202 : 200).json(result);
    } catch (error) {
      if (error instanceof ModernizeError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      // No request/partner response bodies, certificates, credentials or PII in logs.
      console.error("Modernize gateway unavailable");
      res
        .status(503)
        .json({
          error:
            "We could not confirm the request. Please try again with the same details.",
        });
    }
  },
);
