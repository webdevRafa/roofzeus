// functions/src/index.ts
import { onObjectFinalized } from "firebase-functions/v2/storage";
import { onDocumentCreated, onDocumentDeleted } from "firebase-functions/v2/firestore";
import { setGlobalOptions } from "firebase-functions/v2/options";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { Resend } from 'resend';

import * as admin from "firebase-admin";
import * as path from "path";
import * as os from "os";
import * as fs from "fs/promises";
import sharp from "sharp";
import { randomUUID, createHash } from "node:crypto";

import { defineSecret } from "firebase-functions/params";

const RESEND_API_KEY = defineSecret("RESEND_API_KEY");
const INVITE_FROM_EMAIL = defineSecret("INVITE_FROM_EMAIL");
const APP_BASE_URL = defineSecret("APP_BASE_URL");

const VERIFY_FROM_EMAIL = defineSecret("VERIFY_FROM_EMAIL");

admin.initializeApp();
setGlobalOptions({ region: "us-central1", memory: "1GiB", timeoutSeconds: 540 });

/**
 * 1) Convert uploads at jobs/{jobId}/attachments/* to WEBP (q=90),
 *    write a doc in jobPhotos, bump counters on the job, delete original.
 */
export const processJobPhoto = onObjectFinalized(
  { bucket: "roofzeus-2f15c.firebasestorage.app", region: "us-central1" },
  async (event) => {
    const filePath = event.data.name || "";
    const bucketName = event.data.bucket;
    const contentType = event.data.contentType || "";
    const metadata = event.data.metadata || {};

    // ✅ Only image uploads
    if (!contentType.startsWith("image/")) return;

    // ✅ Ignore derivatives to avoid loops
    if (filePath.endsWith("_webp90.webp")) return;

    // ✅ Support BOTH:
    // 1) New: organizations/{orgId}/jobs/{jobId}/attachments/*
    // 2) Old: jobs/{jobId}/attachments/*
    const orgMatch = filePath.match(
      /^organizations\/([^/]+)\/jobs\/([^/]+)\/attachments\//
    );
    const legacyMatch = filePath.match(/^jobs\/([^/]+)\/attachments\//);

    const orgId = orgMatch?.[1] ?? null;
    const jobId = orgMatch?.[2] ?? legacyMatch?.[1] ?? null;

    // Must be in an attachments folder (either schema)
    const isOrgUpload = !!orgMatch;
    const isLegacyUpload = !!legacyMatch;
    if (!isOrgUpload && !isLegacyUpload) return;

    const bucket = admin.storage().bucket(bucketName);

    // Paths
    const dirname = path.dirname(filePath);
    const basename = path.basename(filePath, path.extname(filePath));
    const webpFileName = `${basename}_webp90.webp`;
    const webpDestPath = path.join(dirname, webpFileName);

    // Temp files
    const tempOriginal = path.join(os.tmpdir(), path.basename(filePath));
    const tempWebp = path.join(os.tmpdir(), webpFileName);

    try {
      // Download original
      await bucket.file(filePath).download({ destination: tempOriginal });

      // Convert → WEBP q=90
      await sharp(tempOriginal).rotate().webp({ quality: 90 }).toFile(tempWebp);

      // Upload derivative with a token
      const token = randomUUID();
      await bucket.upload(tempWebp, {
        destination: webpDestPath,
        metadata: {
          contentType: "image/webp",
          metadata: { firebaseStorageDownloadTokens: token },
        },
      });

      // Build public URL
      const url = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(
        webpDestPath
      )}?alt=media&token=${token}`;

      const caption = (metadata.caption as string) || "";

      if (!jobId) return;

      const db = admin.firestore();
      const batch = db.batch();

      // ✅ Decide Firestore paths based on schema
      const photoRef = orgId
        ? db.collection(`organizations/${orgId}/jobPhotos`).doc()
        : db.collection("jobPhotos").doc(); // legacy

      batch.set(photoRef, {
        orgId: orgId || null,
        jobId,
        url,
        path: webpDestPath,
        caption,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const jobRef = orgId
        ? db.doc(`organizations/${orgId}/jobs/${jobId}`)
        : db.doc(`jobs/${jobId}`); // legacy

      batch.set(
        jobRef,
        {
          photoCount: admin.firestore.FieldValue.increment(1),
          lastPhotoUrl: url,
          lastPhotoAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      await batch.commit();

      // Delete the original to save storage
      await bucket.file(filePath).delete().catch(() => {});
    } catch (err) {
      console.error("processJobPhoto error:", err);
    } finally {
      await fs.unlink(tempOriginal).catch(() => {});
      await fs.unlink(tempWebp).catch(() => {});
    }
  }
);


/**
 * 2) When a jobPhotos doc is deleted, remove the Storage file and decrement counters.const path = `organizations/${orgId}/jobs/${job.id}/attachments/${filename}`;

 *    onDocumentDeleted provides a single snapshot; use event.data.data().
 */
export const cleanupPhotoOnDelete = onDocumentDeleted("jobPhotos/{photoId}", async (event) => {
  const snap = event.data; // QueryDocumentSnapshot of the deleted doc
  if (!snap) return;

  const data = snap.data() as { path?: string; jobId?: string; url?: string } | undefined;
  if (!data) return;

  try {
    // Delete the webp file in Storage (if we stored the path)
    if (data.path) {
      const bucket = admin.storage().bucket();
      await bucket.file(data.path).delete().catch(() => {});
    }

    // Decrement photoCount on the job
    if (data.jobId) {
      await admin.firestore().doc(`jobs/${data.jobId}`).set(
        {
          photoCount: admin.firestore.FieldValue.increment(-1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
  } catch (err) {
    console.error("cleanupPhotoOnDelete error:", err);
  }
});

export const cleanupOrgPhotoOnDelete = onDocumentDeleted(
  "organizations/{orgId}/jobPhotos/{photoId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data() as { path?: string; jobId?: string } | undefined;
    if (!data) return;

    const orgId = event.params.orgId as string;

    try {
      // Delete the webp file in Storage
      if (data.path) {
        const bucket = admin.storage().bucket();
        await bucket.file(data.path).delete().catch(() => {});
      }

      // Decrement photoCount on the org-nested job
      if (data.jobId) {
        await admin
          .firestore()
          .doc(`organizations/${orgId}/jobs/${data.jobId}`)
          .set(
            {
              photoCount: admin.firestore.FieldValue.increment(-1),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
      }
    } catch (err) {
      console.error("cleanupOrgPhotoOnDelete error:", err);
    }
  }
);


/**
 * claimEmployeeInvite
 *
 * Callable Cloud Function to allow an authenticated user to claim an employee
 * invite.  It expects an `inviteId` in the request data and uses context.auth
 * to determine the caller's uid.  It marks the invite as accepted, attaches
 * the user's uid to the employee document, and copies any role/accessRole
 * snapshots if those fields are unset on the employee.  Errors are thrown
 * for unauthenticated callers, missing invites, or non-pending invites.
 */

function getResend() {
  const key = RESEND_API_KEY.value();
  if (!key) throw new Error("Missing RESEND_API_KEY secret");
  return new Resend(key);
}


export const claimEmployeeInvite = onCall(
  { region: "us-central1" },
  async (request) => {
    const inviteId = String(request.data?.inviteId || "").trim();
    const orgId = String(request.data?.orgId || "").trim();

    const auth = request.auth;
    if (!auth?.uid) {
      throw new HttpsError("unauthenticated", "Must be called while authenticated.");
    }
    if (!orgId) {
      throw new HttpsError("invalid-argument", "Missing orgId parameter.");
    }
    if (!inviteId) {
      throw new HttpsError("invalid-argument", "Missing inviteId parameter.");
    }

    const uid = auth.uid;
    const db = admin.firestore();

    // ✅ ORG NESTED invite doc
    const inviteRef = db.doc(`organizations/${orgId}/employeeInvites/${inviteId}`);
    const inviteSnap = await inviteRef.get();

    if (!inviteSnap.exists) {
      throw new HttpsError("not-found", "Invite not found.");
    }

    const invite = inviteSnap.data() as any;

    if (invite.status !== "pending") {
      throw new HttpsError(
        "failed-precondition",
        `Invite is not pending (current status: ${invite.status}).`
      );
    }

    // ✅ Verify email matches invite email
    const callerEmail = String(auth.token?.email || "").trim().toLowerCase();
    const inviteEmail = String(invite.email || "").trim().toLowerCase();
    if (!callerEmail || callerEmail !== inviteEmail) {
      throw new HttpsError(
        "failed-precondition",
        `This invite is for ${inviteEmail}, but you are signed in as ${callerEmail}.`
      );
    }

    const employeeId = String(invite.employeeId || "").trim();
    if (!employeeId) {
      throw new HttpsError("failed-precondition", "Invite missing employeeId.");
    }

    // ✅ ORG NESTED employee doc
    const employeeRef = db.doc(`organizations/${orgId}/employees/${employeeId}`);

    await db.runTransaction(async (trx) => {
      const employeeSnap = await trx.get(employeeRef);
      if (!employeeSnap.exists) {
        throw new HttpsError("not-found", "Employee associated with invite not found.");
      }

      const employee = employeeSnap.data() as any;

      const empUpdates: any = {
        userId: uid,
        // keep orgId consistent on the employee doc (optional but recommended)
        orgId,
        invite: {
          ...(employee.invite || {}),
          status: "accepted",
          acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      };

      // Copy snapshots only if employee doesn't already have them
      if (!employee.role && invite.roleSnapshot) empUpdates.role = invite.roleSnapshot;
      if (!employee.accessRole && invite.accessRoleSnapshot)
        empUpdates.accessRole = invite.accessRoleSnapshot;

      trx.set(employeeRef, empUpdates, { merge: true });

      trx.set(
        inviteRef,
        {
          status: "accepted",
          acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
          acceptedByUserId: uid,
        },
        { merge: true }
      );
    });

    return { ok: true };
  }
);

// -------------------------
// Custom Email Verification
// -------------------------

type EmailVerifyDoc = {
  uid: string;
  email: string;
  tokenHash: string;
  createdAt: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp;
  expiresAtMs: number;
  consumedAt?: FirebaseFirestore.FieldValue | FirebaseFirestore.Timestamp | null;
  consumedIp?: string | null;
  resendCount?: number | FirebaseFirestore.FieldValue;
};

function sha256(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

function buildVerifyEmailLink(token: string) {
  const baseUrl = (APP_BASE_URL.value() || "").replace(/\/$/, "");
  // Your FE page can read `token` from query string:
  // /verify-email?token=...
  return `${baseUrl}/verify-email?token=${encodeURIComponent(token)}`;
}

async function sendVerificationEmail(toEmail: string, token: string) {
  const resend = getResend();

  const from = (VERIFY_FROM_EMAIL.value() || INVITE_FROM_EMAIL.value() || "").trim();
  if (!from) throw new Error("Missing VERIFY_FROM_EMAIL (or INVITE_FROM_EMAIL) secret");

  const verifyUrl = buildVerifyEmailLink(token);
  const subject = "Verify your email for Roof Zeus";

  const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system; line-height:1.5;">
      <h2 style="margin:0 0 10px;">Verify your email</h2>
      <p style="margin:0 0 14px;">
        Click the button below to verify your email address.
      </p>
      <p style="margin:0 0 18px;">
        <a href="${verifyUrl}" style="display:inline-block; padding:10px 14px; border-radius:10px; background:#111827; color:#fff; text-decoration:none;">
          Verify Email
        </a>
      </p>
      <p style="margin:0 0 10px; color:#6b7280; font-size:12px;">
        Or paste this link into your browser:
        <br/>
        <a href="${verifyUrl}">${verifyUrl}</a>
      </p>
      <p style="margin:0; color:#6b7280; font-size:12px;">
        If you didn’t create an account, you can ignore this email.
      </p>
    </div>
  `;

  const { error } = await resend.emails.send({
    from,
    to: [toEmail],
    subject,
    html,
  });

  if (error) throw new Error(`Resend error: ${error.message || String(error)}`);
}

/**
 * sendCustomEmailVerification
 * - Must be called while authenticated
 * - Creates a one-time token doc in Firestore
 * - Sends an email with your own verification link via Resend
 */
export const sendCustomEmailVerification = onCall(
  {
    region: "us-central1",
    secrets: [RESEND_API_KEY, APP_BASE_URL, VERIFY_FROM_EMAIL, INVITE_FROM_EMAIL],
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Must be signed in.");
    }

    const uid = request.auth.uid;

    // Pull Auth user to get canonical email + current verified state
    const authUser = await admin.auth().getUser(uid);
    const email = String(authUser.email || "").trim().toLowerCase();
    if (!email) throw new HttpsError("failed-precondition", "User has no email.");
    if (authUser.emailVerified) return { ok: true, alreadyVerified: true };

    const db = admin.firestore();

    // Throttle resend (optional but recommended)
    // If you store these fields on users/{uid}, this becomes easy to enforce.
    // We'll enforce based on latest token doc instead (simple + works now).
    const recentSnap = await db
      .collection("emailVerifications")
      .where("uid", "==", uid)
      .orderBy("expiresAtMs", "desc")
      .limit(1)
      .get();

    if (!recentSnap.empty) {
      const last = recentSnap.docs[0].data() as EmailVerifyDoc;
      // if last token was created recently, block spam
      const createdAtMs =
        (last.createdAt as any)?.toMillis?.() ?? null;

      // If we can't read createdAtMs, skip throttle; otherwise enforce 60s
      if (typeof createdAtMs === "number") {
        const ms = Date.now() - createdAtMs;
        if (ms >= 0 && ms < 60_000) {
          return { ok: true, skipped: true, reason: "throttled" };
        }
      }
    }

    // Create a one-time token (store only hash in Firestore)
    const token = randomUUID();
    const tokenHash = sha256(token);
    const expiresAtMs = Date.now() + 1000 * 60 * 60 * 24; // 24 hours

    const ref = db.collection("emailVerifications").doc();
    await ref.set({
      uid,
      email,
      tokenHash,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAtMs,
      consumedAt: null,
      resendCount: 1,
    } satisfies EmailVerifyDoc as any);

    try {
      await sendVerificationEmail(email, token);
    } catch (err: any) {
      console.error("sendCustomEmailVerification email error:", err);
      throw new HttpsError("internal", err?.message || "Failed to send verification email.");
    }

    return { ok: true };
  }
);

/**
 * confirmCustomEmailVerification
 * - Called from your /verify-email page with the token from query string
 * - Validates tokenHash, expiry, and unused status
 * - Marks Firebase Auth user emailVerified=true
 * - Writes audit markers (optional but recommended)
 */
export const confirmCustomEmailVerification = onCall(
  { region: "us-central1" },
  async (request) => {
    const token = String(request.data?.token || "").trim();
    if (!token) throw new HttpsError("invalid-argument", "Missing token.");

    const tokenHash = sha256(token);
    const db = admin.firestore();

    const q = await db
      .collection("emailVerifications")
      .where("tokenHash", "==", tokenHash)
      .limit(1)
      .get();

    if (q.empty) throw new HttpsError("not-found", "Invalid or expired verification link.");

    const docSnap = q.docs[0];
    const data = docSnap.data() as EmailVerifyDoc;

    if (data.consumedAt) {
      throw new HttpsError("failed-precondition", "This verification link has already been used.");
    }

    if (typeof data.expiresAtMs === "number" && Date.now() > data.expiresAtMs) {
      throw new HttpsError("deadline-exceeded", "Verification link expired. Please request a new one.");
    }

    // Mark Auth email verified
    await admin.auth().updateUser(data.uid, { emailVerified: true });

    // Consume token + write audit markers
    await db.runTransaction(async (trx) => {
      trx.set(
        docSnap.ref,
        {
          consumedAt: admin.firestore.FieldValue.serverTimestamp(),
          consumedIp: (request.rawRequest as any)?.ip ?? null,
        },
        { merge: true }
      );

      // Optional: also stamp users/{uid} so your UI can show “Verified”
      trx.set(
        db.doc(`users/${data.uid}`),
        {
          emailVerified: true,
          emailVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    return { ok: true };
  }
);


// Create full accept‑invite URL using APP_BASE_URL
function buildInviteLink(orgId: string, inviteId: string): string {
  const baseUrl = (APP_BASE_URL.value() || "").replace(/\/$/, "");
  return `${baseUrl}/accept-invite?orgId=${encodeURIComponent(
    orgId
  )}&inviteId=${encodeURIComponent(inviteId)}`;
}


async function sendInviteEmail(toEmail: string, orgId: string, inviteId: string) {
  const resend = getResend();
  const inviteUrl = buildInviteLink(orgId, inviteId);

  const from = (INVITE_FROM_EMAIL.value() ||
    "Roger's Roofing <no-reply@rogersroofingtx.com>").trim();

  const subject = "You have been invited to join Roger's Roofing";

  const html = `
    <p>Hello,</p>
    <p>You’ve been invited to join the Rogers Roofing team. Click the link below to accept your invitation:</p>
    <p><a href="${inviteUrl}">${inviteUrl}</a></p>
    <p>If you weren’t expecting this invitation, you can ignore this email.</p>
  `;

  const { error } = await resend.emails.send({
    from,
    to: [toEmail],
    subject,
    html,
  });

  if (error) throw new Error(`Resend error: ${error.message || String(error)}`);
}



export const sendEmployeeInvite = onCall(
  {
    region: "us-central1",
    secrets: [RESEND_API_KEY, INVITE_FROM_EMAIL, APP_BASE_URL],
  },
  async (request) => {
    const inviteId = String(request.data?.inviteId || "").trim();
    const orgId = String(request.data?.orgId || "").trim();

    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Must be signed in.");
    }
    if (!orgId) {
      throw new HttpsError("invalid-argument", "Missing orgId parameter.");
    }
    if (!inviteId) {
      throw new HttpsError("invalid-argument", "Missing inviteId parameter.");
    }

    const db = admin.firestore();

    const inviteRef = db.doc(`organizations/${orgId}/employeeInvites/${inviteId}`);
    const inviteSnap = await inviteRef.get();
    if (!inviteSnap.exists) {
      throw new HttpsError("not-found", "Invite not found.");
    }

    const invite = inviteSnap.data() as any;
    const employeeId = String(invite.employeeId || "").trim();
    if (!employeeId) {
      throw new HttpsError("failed-precondition", "Invite missing employeeId.");
    }

    const employeeRef = db.doc(`organizations/${orgId}/employees/${employeeId}`);
    const employeeSnap = await employeeRef.get();
    if (!employeeSnap.exists) {
      throw new HttpsError("not-found", "Employee associated with invite not found.");
    }

    const currentStatus = invite.status || "pending";
    if (currentStatus !== "pending" && currentStatus !== "sent") {
      throw new HttpsError(
        "failed-precondition",
        `Invite status is ${currentStatus}; cannot send.`
      );
    }

    const toEmail = String(invite.email || "").trim();
    if (!toEmail) {
      throw new HttpsError("invalid-argument", "Invite is missing an email address.");
    }

    try {
      await sendInviteEmail(toEmail, orgId, inviteId);
    } catch (err: any) {
      console.error(err);
      throw new HttpsError("internal", err?.message || "Failed to send invite email.");
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const batch = db.batch();

    batch.set(inviteRef, { lastSentAt: now, status: "pending" }, { merge: true });

    const employeeInviteMeta = (employeeSnap.data() as any).invite || {};
    batch.set(
      employeeRef,
      {
        invite: {
          ...employeeInviteMeta,
          status: "pending",
          email: toEmail,
          lastSentAt: now,
          inviteDocId: inviteId,
        },
      },
      { merge: true }
    );

    await batch.commit();
    return { ok: true };
  }
);


export const onEmployeeInviteCreated = onDocumentCreated(
  {
    document: "organizations/{orgId}/employeeInvites/{inviteId}",
    region: "us-central1",
    secrets: [RESEND_API_KEY, INVITE_FROM_EMAIL, APP_BASE_URL],
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data() as any;
    if (!data) return;

    const inviteId = snap.id;
    const orgId = event.params.orgId as string;

    // Only send if status is pending and lastSentAt is not set
    if (data.status !== "pending" || data.lastSentAt) return;

    const toEmail = String(data.email || "").trim();
    if (!toEmail) return;

    try {
      await sendInviteEmail(toEmail, orgId, inviteId);

      const db = admin.firestore();
      const now = admin.firestore.FieldValue.serverTimestamp();

      const inviteRef = db.doc(`organizations/${orgId}/employeeInvites/${inviteId}`);

      const employeeId = String(data.employeeId || "").trim();
      if (!employeeId) return;

      const employeeRef = db.doc(`organizations/${orgId}/employees/${employeeId}`);

      const batch = db.batch();
      batch.set(inviteRef, { lastSentAt: now }, { merge: true });

      // merge existing employee invite meta
      const empSnap = await employeeRef.get();
      const empData = empSnap.exists ? (empSnap.data() as any) : {};
      const existingInviteMeta = empData.invite || {};

      batch.set(
        employeeRef,
        {
          invite: {
            ...existingInviteMeta,
            status: "pending",
            email: toEmail,
            lastSentAt: now,
            inviteDocId: inviteId,
          },
        },
        { merge: true }
      );

      await batch.commit();
    } catch (err) {
      console.error("Failed to send invite email on create:", err);
    }
  }
);


async function ensureInvoicePublicToken(invoiceId: string, invoice: any): Promise<string> {
  const existing = String(invoice.publicToken || "").trim();
  if (existing) return existing;

  const token = randomUUID();
  await admin.firestore().doc(`invoices/${invoiceId}`).set(
    { publicToken: token },
    { merge: true }
  );

  return token;
}


export const sendInvoiceEmail = onCall(
  {
    region: "us-central1",
    secrets: [RESEND_API_KEY, INVITE_FROM_EMAIL, APP_BASE_URL],
  },
  async (request) => {
    // Auth guard
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }

    const invoiceId = String(request.data?.invoiceId || "").trim();
    const email = String(request.data?.email || "").trim();
    if (!invoiceId) {
      throw new HttpsError("invalid-argument", "Missing invoiceId.");
    }
    if (!email || !email.includes("@")) {
      throw new HttpsError("invalid-argument", "Missing/invalid email.");
    }

    const db = admin.firestore();
    // Pull invoice doc
    const snap = await db.doc(`invoices/${invoiceId}`).get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "Invoice not found.");
    }
    const invoice = snap.data() as any;

    // Multi-tenant check: require orgId on invoice and match caller’s org
    const invoiceOrgId = String(invoice.orgId || "").trim();
    if (!invoiceOrgId) {
      throw new HttpsError(
        "failed-precondition",
        "Invoice missing orgId. Re-save invoice with latest schema."
      );
    }
    const uid = request.auth.uid;
    const userSnap = await db.doc(`users/${uid}`).get();
    const userOrgId = userSnap.exists ? String((userSnap.data() as any).orgId || "") : "";
    let employeeOrgId = "";
    if (!userOrgId) {
      const empQ = await db
        .collection("employees")
        .where("userId", "==", uid)
        .limit(1)
        .get();
      if (!empQ.empty) {
        employeeOrgId = String((empQ.docs[0].data() as any).orgId || "");
      }
    }
    const callerOrgId = userOrgId || employeeOrgId;
    if (!callerOrgId || callerOrgId !== invoiceOrgId) {
      throw new HttpsError("permission-denied", "Not allowed to send this invoice.");
    }

    // Idempotency: skip if already sent recently
    const last = invoice.lastEmailSentAt?.toDate?.() ?? null;
    if (last) {
      const ms = Date.now() - last.getTime();
      if (ms >= 0 && ms < 2 * 60 * 1000) {
        return { ok: true, id: null, skipped: true, reason: "recently_sent" };
      }
    }
    // Skip if another send is already in-flight
    const inFlight = invoice.emailSendInFlightAt?.toDate?.() ?? null;
    if (inFlight) {
      const ms = Date.now() - inFlight.getTime();
      if (ms >= 0 && ms < 2 * 60 * 1000) {
      return { ok: true, id: null, skipped: true, reason: "in_flight" };
      }
    }

    // Set in-flight lock (non-fatal if it fails)
    try {
      await db.doc(`invoices/${invoiceId}`).set(
        { emailSendInFlightAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );
    } catch (err) {
      console.error("Failed to set emailSendInFlightAt (non-fatal):", err);
    }

    try {
      // Prepare Resend
      const resend = getResend();
      const from = INVITE_FROM_EMAIL.value();
      const appBase = APP_BASE_URL.value();
      if (!from) throw new HttpsError("failed-precondition", "Missing INVITE_FROM_EMAIL secret.");
      if (!appBase)
        throw new HttpsError("failed-precondition", "Missing APP_BASE_URL secret.");

      // Build subject, HTML and invoice link
      const number = invoice.number || "Invoice";
      const totalCents = Number(invoice.money?.totalCents || 0);
      const total = (totalCents / 100).toLocaleString(undefined, {
        style: "currency",
        currency: "USD",
      });
      const publicToken = await ensureInvoicePublicToken(invoiceId, invoice);
      const invoiceUrl = buildInvoiceLink(invoiceId, publicToken);
      const subject = `${number} from Roger’s Roofing`;
      const html = `
        <div style="font-family: ui-sans-serif, system-ui, -apple-system; line-height:1.5;">
          <h2 style="margin:0 0 8px;">${number}</h2>
          <p style="margin:0 0 12px;">Total due: <b>${total}</b></p>
          <p style="margin:0 0 16px;">
            View your invoice here:
            <a href="${invoiceUrl}">${invoiceUrl}</a>
          </p>
          <p style="margin:0; color:#666; font-size:12px;">
            If you have any questions, reply to this email.
          </p>
        </div>
      `;

      // Send email via Resend
      const { data, error } = await resend.emails.send({
        from,
        to: [email],
        subject,
        html,
      });
      
      if (error) {
        console.error("Resend invoice send error:", error);
      
        // Persist failure for UI + audit
        try {
          await db.doc(`invoices/${invoiceId}`).set(
            {
              lastEmailError: error.message || "Failed to send invoice email.",
              lastEmailErrorAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        } catch (err) {
          console.error("Failed to persist lastEmailError:", err);
        }
      
        throw new HttpsError(
          "internal",
          error.message || "Failed to send invoice email."
        );
      }
      
      // Persist success markers (and clear any previous error)
      try {
        await db.doc(`invoices/${invoiceId}`).set(
          {
            lastEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
            lastEmailResendId: data?.id || null,
            lastEmailError: null,
            lastEmailErrorAt: null,
          },
          { merge: true }
        );
      } catch (err) {
        console.error("Failed to update invoice email audit fields:", err);
      }
      
      return { ok: true, id: data?.id || null };
      
    } finally {
      // Always clear in-flight lock (non-fatal)
      try {
        await db.doc(`invoices/${invoiceId}`).set(
          { emailSendInFlightAt: admin.firestore.FieldValue.delete() },
          { merge: true }
        );
      } catch (err) {
        console.error("Failed to clear emailSendInFlightAt:", err);
      }
    }
  }
);



// Helper to build invoice URL from APP_BASE_URL.  Duplicated logic from
// sendInvoiceEmail so triggers can reuse it.
function buildInvoiceLink(invoiceId: string, publicToken: string): string {
  const baseUrl = (APP_BASE_URL.value() || "").replace(/\/$/, "");
  return `${baseUrl}/invoice/${encodeURIComponent(invoiceId)}?token=${encodeURIComponent(publicToken)}`;
}



// Helper to send the invoice via Resend using the same template as sendInvoiceEmail.
// This function runs server-side and does not perform auth/org checks; callers must
// enforce appropriate permissions.  It updates lastEmailSentAt on the invoice doc.
async function sendInvoiceViaResend(invoiceId: string, invoice: any, toEmail: string) {
  const resend = getResend();
  const from = INVITE_FROM_EMAIL.value();
  const appBase = APP_BASE_URL.value();
  if (!from) throw new Error("Missing INVITE_FROM_EMAIL secret.");
  if (!appBase) throw new Error("Missing APP_BASE_URL secret.");
  const number = invoice.number || "Invoice";
  const totalCents = Number(invoice.money?.totalCents || 0);
  const total = (totalCents / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
  const publicToken = await ensureInvoicePublicToken(invoiceId, invoice);
const invoiceUrl = buildInvoiceLink(invoiceId, publicToken);

  const subject = `${number} from Roger’s Roofing`;
  const html = `
      <div style="font-family: ui-sans-serif, system-ui, -apple-system; line-height:1.5;">
        <h2 style="margin:0 0 8px;">${number}</h2>
        <p style="margin:0 0 12px;">Total due: <b>${total}</b></p>
        <p style="margin:0 0 16px;">
          View your invoice here:
          <a href="${invoiceUrl}">${invoiceUrl}</a>
        </p>
        <p style="margin:0; color:#666; font-size:12px;">
          If you have any questions, reply to this email.
        </p>
      </div>
    `;
    const { data, error } = await resend.emails.send({
      from,
      to: [toEmail],
      subject,
      html,
    });
    
    if (error) {
      await admin.firestore().doc(`invoices/${invoiceId}`).set(
        {
          lastEmailError: error.message || "Failed to send invoice email.",
          lastEmailErrorAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    
      throw new Error(error.message || "Failed to send invoice email.");
    }
    
 // update delivery markers on the invoice
await admin.firestore().doc(`invoices/${invoiceId}`).set(
  {
    lastEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
    lastEmailResendId: (data as any)?.id ?? null,
    lastEmailError: null,
    lastEmailErrorAt: null,
  },
  { merge: true }
);

}

/**
 * onInvoiceCreated
 *
 * Firestore trigger that automatically sends an invoice email when an invoice
 * document is first created with status "sent" and a customer email.  This
 * mirrors the auto-send behavior used for employee invites and makes the
 * feature more reliable by not relying solely on the client to call the
 * sendInvoiceEmail callable.  It also prevents duplicate sends by checking
 * for an existing lastEmailSentAt timestamp.
 */
export const onInvoiceCreated = onDocumentCreated(
  {
    document: "invoices/{invoiceId}",
    region: "us-central1",
    secrets: [RESEND_API_KEY, INVITE_FROM_EMAIL, APP_BASE_URL],
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data() as any;
    if (!data) return;

    const invoiceId = snap.id;

    if (data.status !== "sent") return;

    const email = data.customer?.email;
    if (!email) return;

    // Already sent => do nothing
    if (data.lastEmailSentAt) return;

    // Respect in-flight lock (prevents race with callable/manual sends)
    const inFlight = data.emailSendInFlightAt?.toDate?.() ?? null;
    if (inFlight) {
      const ms = Date.now() - inFlight.getTime();
      if (ms >= 0 && ms < 2 * 60 * 1000) return;
    }

    // Set in-flight lock
    try {
      await admin.firestore().doc(`invoices/${invoiceId}`).set(
        { emailSendInFlightAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );
    } catch (err) {
      console.error("Failed to set emailSendInFlightAt in trigger:", err);
      // Still continue; worst case we might send twice, but our sent markers help.
    }

    try {
      await sendInvoiceViaResend(invoiceId, data, email);
    } catch (err) {
      console.error("Failed to send invoice email on create:", err);
    } finally {
      // Always clear lock
      try {
        await admin.firestore().doc(`invoices/${invoiceId}`).set(
          { emailSendInFlightAt: admin.firestore.FieldValue.delete() },
          { merge: true }
        );
      } catch (err) {
        console.error("Failed to clear emailSendInFlightAt in trigger:", err);
      }
    }
  }
);


