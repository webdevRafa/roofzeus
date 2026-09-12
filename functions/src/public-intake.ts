import { onRequest } from "firebase-functions/v2/https";
import {
  defineBoolean,
  defineSecret,
  defineString,
} from "firebase-functions/params";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import { createHmac, randomUUID } from "node:crypto";
import { IntakeError, validateIntake } from "./intake-model";

const TURNSTILE_SECRET_KEY = defineSecret("TURNSTILE_SECRET_KEY");
const PUBLIC_INTAKE_ENABLED = defineBoolean("PUBLIC_INTAKE_ENABLED", {
  default: false,
});
const PUBLIC_ALLOWED_ORIGINS = defineString("PUBLIC_ALLOWED_ORIGINS", {
  default: "https://roofzeus.com,https://www.roofzeus.com",
});

// A separate database isolates homeowner PII from the existing contractor app's rules.
export const submitPublicIntake = onRequest(
  {
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 30,
    maxInstances: 10,
    secrets: [TURNSTILE_SECRET_KEY],
    invoker: "public",
  },
  async (req, res) => {
    res.set("Cache-Control", "no-store");
    const origins = PUBLIC_ALLOWED_ORIGINS.value()
      .split(",")
      .map((s) => s.trim());
    const origin = req.get("origin") || "";
    if (!origins.includes(origin)) {
      res
        .status(403)
        .json({ error: "This site is not authorized to submit requests." });
      return;
    }
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Vary", "Origin");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }
    if (req.method !== "POST") {
      res.set("Allow", "POST, OPTIONS");
      res.status(405).json({ error: "Use POST." });
      return;
    }
    if (!PUBLIC_INTAKE_ENABLED.value()) {
      res
        .status(503)
        .json({
          error:
            "Online requests are not open yet. Please check back soon. Your request has not been sent.",
        });
      return;
    }
    try {
      if (!req.is("application/json") || (req.rawBody?.length || 0) > 16000)
        throw new IntakeError("Invalid request size or format.");
      const data = validateIntake(req.body);
      const secret = TURNSTILE_SECRET_KEY.value();
      const hash = (value: string) =>
        createHmac("sha256", secret).update(value).digest("hex");
      const db = getFirestore("roofzeus-leads");
      const payloadHash = hash(JSON.stringify(data));
      const receiptRef = db.collection("receipts").doc(data.requestId);
      const receipt = await receiptRef.get();
      if (receipt.exists) {
        if (receipt.get("payloadHash") !== payloadHash)
          throw new IntakeError(
            "This request has already been submitted. Start a new request to change the details.",
            409,
          );
        res.status(200).json({ reference: receipt.get("reference") });
        return;
      }
      const token = req.body.turnstileToken;
      if (typeof token !== "string" || !token || token.length > 2048)
        throw new IntakeError("Please complete the security verification.");
      const verification = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          body: new URLSearchParams({ secret, response: token }),
          signal: AbortSignal.timeout(7000),
        },
      );
      if (!verification.ok)
        throw new IntakeError(
          "Security verification is temporarily unavailable. Please try again.",
          503,
        );
      const verified = (await verification.json()) as {
        success?: boolean;
        hostname?: string;
        action?: string;
      };
      if (
        !verified.success ||
        verified.action !== "roofing-intake" ||
        verified.hostname !== new URL(origin).hostname
      )
        throw new IntakeError(
          "Security verification expired or failed. Please try again.",
        );
      const now = Date.now();
      const windowKey = Math.floor(now / (15 * 60 * 1000));
      const ipHash = hash(
        `${new Date(now).toISOString().slice(0, 10)}:${req.ip || "unknown"}`,
      );
      const rateRef = db.collection("rateLimits").doc(`${ipHash}-${windowKey}`);
      const contactRateRef = db
        .collection("rateLimits")
        .doc(`${hash(data.email)}-${windowKey}`);
      const duplicateKey = hash(
        `${data.kind}:${data.email}:${data.kind === "homeowner" ? `${data.address.toLowerCase()}:${data.zip}:${data.service}` : data.businessName.toLowerCase()}:${Math.floor(now / 86400000)}`,
      );
      const duplicateRef = db.collection("duplicates").doc(duplicateKey);
      let geoValidation = "not_applicable";
      if (data.kind === "homeowner") {
        geoValidation = "manual_review_required";
        try {
          const geoResponse = await fetch(
            `https://api.zippopotam.us/us/${data.zip}`,
            { signal: AbortSignal.timeout(4000) },
          );
          if (geoResponse.ok) {
            const geo = (await geoResponse.json()) as {
              places?: { "state abbreviation": string }[];
            };
            if (
              geo.places?.length &&
              !geo.places.some((p) => p["state abbreviation"] === data.state)
            )
              throw new IntakeError(
                "The ZIP code and state do not match. Please check the property location.",
              );
            if (geo.places?.length) geoValidation = "zip_state_matched";
          }
        } catch (e) {
          if (e instanceof IntakeError) throw e;
        }
      }
      const newReference = `RZ-${randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`;
      const reference = await db.runTransaction(async (transaction) => {
        const [currentReceipt, rate, contactRate, duplicate] =
          await Promise.all([
            transaction.get(receiptRef),
            transaction.get(rateRef),
            transaction.get(contactRateRef),
            transaction.get(duplicateRef),
          ]);
        if (currentReceipt.exists) {
          if (currentReceipt.get("payloadHash") !== payloadHash)
            throw new IntakeError(
              "This request has already been submitted.",
              409,
            );
          return currentReceipt.get("reference") as string;
        }
        if (
          (rate.get("count") || 0) >= 6 ||
          (contactRate.get("count") || 0) >= 3
        )
          throw new IntakeError(
            "Too many requests. Please wait 15 minutes before trying again.",
            429,
          );
        const expiresAt = Timestamp.fromMillis(now + 2 * 86400000);
        for (const ref of [rateRef, contactRateRef])
          transaction.set(
            ref,
            { count: FieldValue.increment(1), expiresAt },
            { merge: true },
          );
        const reference = duplicate.exists
          ? (duplicate.get("reference") as string)
          : newReference;
        transaction.create(receiptRef, {
          reference,
          payloadHash,
          expiresAt: Timestamp.fromMillis(now + 30 * 86400000),
        });
        if (!duplicate.exists) {
          const { requestId: _requestId, ...record } = data;
          void _requestId;
          transaction.create(
            db
              .collection(
                data.kind === "homeowner"
                  ? "requests"
                  : "contractorApplications",
              )
              .doc(reference),
            {
              ...record,
              reference,
              createdAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
              consentAt: FieldValue.serverTimestamp(),
              status: "new",
              geoValidation,
              sharingStatus: "not_shared",
              namedPartnerConsent: null,
              assignedContractorId: null,
              market:
                data.kind === "homeowner" &&
                data.state === "TX" &&
                data.city.toLowerCase() === "san antonio"
                  ? "san-antonio-pilot"
                  : "network-development",
            },
          );
          transaction.create(duplicateRef, { reference, expiresAt });
        }
        return reference;
      });
      res.status(201).json({ reference });
    } catch (e) {
      if (e instanceof IntakeError) {
        res.status(e.status).json({ error: e.message });
        return;
      }
      // Never write request bodies, contact information, tokens, or credentials to logs.
      console.error(
        "Public intake failed",
        e instanceof Error ? e.name : "UnknownError",
      );
      res
        .status(503)
        .json({
          error:
            "We could not confirm your request. Please try again. Your details are still on this page.",
        });
    }
  },
);
