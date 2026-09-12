/** Private local operator tool. No public admin routes and no outbound lead submissions. */
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
const require = createRequire(import.meta.url);
const [command, reference, evidencePath] = process.argv.slice(2);
const {
  readSettings,
  readiness,
} = require("../functions/lib/modernize-contract.js");
if (command === "check-config") {
  try {
    const settings = readSettings(await readFile(reference, "utf8"));
    const missing = readiness(settings);
    console.log(
      JSON.stringify(
        {
          mode: settings.mode,
          environment: settings.environment,
          configurationReady: missing.length === 0,
          missing,
        },
        null,
        2,
      ),
    );
    if (missing.length) process.exitCode = 2;
  } catch {
    console.error(
      "Could not validate settings. Check the file path and JSON format.",
    );
    process.exitCode = 1;
  }
} else {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  if (!projectId)
    throw Error("Set GOOGLE_CLOUD_PROJECT to the intended project.");
  const db = getFirestore(
    initializeApp({ credential: applicationDefault(), projectId }),
    "roofzeus-leads",
  );
  const collection = db.collection("modernizeRequests");
  if (command === "list") {
    const rows = await collection.orderBy("createdAt", "desc").limit(50).get();
    console.table(
      rows.docs.map((doc) => ({
        reference: doc.id,
        status: doc.get("status"),
        phase: doc.get("phase"),
        environment: doc.get("environment"),
        created: new Date(doc.get("createdAt")).toISOString(),
        partnerLeadId: doc.get("partnerLeadId") || "",
        reason: doc.get("reason") || "",
      })),
    );
  } else if (
    command === "reconcile" &&
    /^RZM-[A-F0-9]{16}$/.test(reference || "") &&
    evidencePath
  ) {
    const evidence = JSON.parse(await readFile(evidencePath, "utf8"));
    if (!["accepted", "no_match"].includes(evidence.status))
      throw Error("Use a partner-confirmed accepted or no_match status.");
    for (const field of ["operator", "evidence"])
      if (
        typeof evidence[field] !== "string" ||
        !evidence[field].trim() ||
        evidence[field].length > 500
      )
        throw Error(`Missing or invalid ${field}.`);
    if (
      evidence.status === "accepted" &&
      !/^[a-zA-Z0-9_-]{1,100}$/.test(evidence.partnerLeadId || "")
    )
      throw Error(
        "Accepted reconciliation requires the confirmed Modernize lead ID.",
      );
    const ref = collection.doc(reference);
    await db.runTransaction(async (tx) => {
      const record = await tx.get(ref);
      if (!record.exists) throw Error("Request not found.");
      if (
        !["unknown", "processing"].includes(record.get("status")) ||
        Date.now() - record.get("createdAt") < 120000
      )
        throw Error(
          "Only uncertain requests older than two minutes can be reconciled.",
        );
      tx.update(ref, {
        status: evidence.status,
        phase: "complete",
        reason: "operator_reconciled",
        updatedAt: Date.now(),
        ...(evidence.status === "accepted"
          ? { partnerLeadId: evidence.partnerLeadId }
          : {}),
      });
      tx.create(db.collection("modernizeAudit").doc(), {
        reference,
        action: "reconcile",
        previousStatus: record.get("status"),
        status: evidence.status,
        operator: evidence.operator,
        evidence: evidence.evidence,
        at: Date.now(),
      });
    });
    console.log("Reconciliation recorded. No lead was sent or resent.");
  } else {
    throw Error(
      "Usage: node operations/modernize.mjs check-config <settings-file> | list | reconcile <RZM-reference> <evidence-file>",
    );
  }
}
