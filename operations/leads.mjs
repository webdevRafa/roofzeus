/** Private operator utility. Uses Application Default Credentials; never bundle this into the site. */
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { readFile } from "node:fs/promises";
const [command, reference, file] = process.argv.slice(2);
const projectId = process.env.GOOGLE_CLOUD_PROJECT;
if (!projectId)
  throw new Error("Set GOOGLE_CLOUD_PROJECT to the intended Firebase project.");
const db = getFirestore(
  initializeApp({ credential: applicationDefault(), projectId }),
  "roofzeus-leads",
);
const validReference = (value) => /^RZ-[A-F0-9]{16}$/.test(value || "");
if (command === "list" || command === "partners") {
  const collection =
    command === "partners" ? "contractorApplications" : "requests";
  const snapshot = await db
    .collection(collection)
    .orderBy("createdAt", "desc")
    .limit(30)
    .get();
  console.table(
    snapshot.docs.map((doc) => ({
      reference: doc.id,
      status: doc.get("status"),
      created: doc.get("createdAt")?.toDate().toISOString(),
      service: doc.get("service"),
      market: doc.get("market"),
      sharing: doc.get("sharingStatus"),
    })),
  );
} else if (command === "show" && validReference(reference)) {
  const lead = await db.collection("requests").doc(reference).get();
  const record = lead.exists
    ? lead
    : await db.collection("contractorApplications").doc(reference).get();
  if (!record.exists) throw new Error("Request not found.");
  console.log(JSON.stringify(record.data(), null, 2));
} else if (
  command === "record-introduction" &&
  validReference(reference) &&
  file
) {
  // This records a human-confirmed introduction. It does not send or sell the lead.
  const approval = JSON.parse(await readFile(file, "utf8"));
  for (const key of [
    "contractorId",
    "contractorName",
    "consentEvidence",
    "consentAt",
    "operator",
  ])
    if (typeof approval[key] !== "string" || !approval[key].trim())
      throw new Error(`Missing ${key}.`);
  const consentTime = Date.parse(approval.consentAt);
  if (!Number.isFinite(consentTime) || consentTime > Date.now())
    throw new Error("Consent must have an actual, past timestamp.");
  await db.runTransaction(async (transaction) => {
    const ref = db.collection("requests").doc(reference);
    const partnerRef = db
      .collection("contractorApplications")
      .doc(approval.contractorId);
    const [lead, partner] = await Promise.all([
      transaction.get(ref),
      transaction.get(partnerRef),
    ]);
    if (!lead.exists || lead.get("kind") !== "homeowner")
      throw new Error("Homeowner request not found.");
    if (
      !partner.exists ||
      partner.get("status") !== "approved" ||
      partner.get("businessName") !== approval.contractorName
    )
      throw new Error(
        "Contractor must be reviewed and approved under this exact business name.",
      );
    if (!(partner.get("territoryZips") || []).includes(lead.get("zip")))
      throw new Error("Contractor does not serve the property ZIP.");
    if (
      lead.get("sharingStatus") !== "not_shared" ||
      ["closed", "withdrawn"].includes(lead.get("status"))
    )
      throw new Error("Request is closed, withdrawn, or already assigned.");
    transaction.update(ref, {
      namedPartnerConsent: approval,
      assignedContractorId: approval.contractorId,
      sharingStatus: "permission_recorded",
      status: "introduction_ready",
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.create(ref.collection("audit").doc(), {
      action: "named_partner_permission_recorded",
      ...approval,
      recordedAt: FieldValue.serverTimestamp(),
    });
  });
  console.log(
    "Permission recorded. No information has been sent. Coordinate the agreed introduction privately.",
  );
} else {
  console.log(
    "Usage: node operations/leads.mjs list | partners | show RZ-REFERENCE | record-introduction RZ-REFERENCE approval.json",
  );
  process.exitCode = 1;
}
