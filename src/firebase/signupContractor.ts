// src/firebase/signupContractor.ts
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from "firebase/auth";
import {
  collection,
  doc,
  serverTimestamp,
  writeBatch,
  type FieldValue,
} from "firebase/firestore";
import { auth, db } from "./firebaseConfig";

const LS_ACTIVE_ORG_KEY = "rr_activeOrgId";

export type ContractorSignupInput = {
  fullName: string;
  email: string;
  password: string;

  // personal contact
  userPhone?: string;

  // org info
  companyName: string;
  companyLegalName?: string;
  companyPhone?: string;
};

function cleanPhone(p?: string): string | null {
  const v = (p ?? "").trim();
  return v.length ? v : null;
}

function firebaseErrorMessage(err: unknown): string {
  const code = (err as any)?.code as string | undefined;

  if (!code) return err instanceof Error ? err.message : String(err);

  switch (code) {
    case "auth/email-already-in-use":
      return "That email is already in use. Try logging in instead.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/weak-password":
      return "Password is too weak. Use at least 6 characters.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      return err instanceof Error ? err.message : String(err);
  }
}

export async function signupContractorWithEmail(input: ContractorSignupInput) {
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  const companyName = input.companyName.trim();
  const companyLegalName = (input.companyLegalName ?? "").trim() || companyName;

  if (fullName.length < 2) throw new Error("Please enter your full name.");
  if (!email.includes("@")) throw new Error("Please enter a valid email.");
  if ((input.password ?? "").trim().length < 6)
    throw new Error("Password must be at least 6 characters.");
  if (companyName.length < 2) throw new Error("Please enter a company name.");

  try {
    // 1) Auth user
    const cred = await createUserWithEmailAndPassword(
      auth,
      email,
      input.password
    );
    const uid = cred.user.uid;

    // Optional: display name
    await updateProfile(cred.user, { displayName: fullName });
   
    
    // 2) Create orgId (auto id)
    const orgRef = doc(collection(db, "organizations"));
    const orgId = orgRef.id;

    const now = serverTimestamp() as unknown as FieldValue;

    // 3) Build docs
    const orgDoc = {
      id: orgId,
      name: companyName,
      legalName: companyLegalName,
      phone: cleanPhone(input.companyPhone),
      email,

      // Ownership fields you described
      ownerUserId: uid,
      createdByUserId: uid,

      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    // GLOBAL user profile (top-level)
    const userDoc = {
      id: uid,
      name: fullName,
      email,
      phone: cleanPhone(input.userPhone),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    // ORG-NESTED employee profile
    // NOTE: this MUST live under organizations/{orgId}/employees/{uid}
    // so the app never touches collection(db,"employees") again.
    const employeeDoc = {
      id: uid,
      orgId,
      userId: uid,
      name: fullName,
      email,
      phone: cleanPhone(input.userPhone),

      role: "owner",
      accessRole: "admin",
      isActive: true,

      // keep nulls (never undefined) to be Firestore-safe
      address: null,
      invite: null,

      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    // GLOBAL membership index (top-level) - keep as-is for fast lookups
    const membershipId = `${orgId}_${uid}`;
    const membershipDoc = {
      id: membershipId,
      orgId,
      userId: uid,
      role: "owner",
      employeeId: uid,

      // ✅ CRITICAL: your hook queries status == "active"
      status: "active",

      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    // 4) Commit as one atomic batch
    const batch = writeBatch(db);

    // org doc (top-level)
    batch.set(orgRef, orgDoc);

    // user doc (top-level)
    batch.set(doc(db, "users", uid), userDoc);

    // employee doc (ORG-NESTED)
    batch.set(doc(db, "organizations", orgId, "employees", uid), employeeDoc);

    // membership doc (top-level)
    batch.set(doc(db, "memberships", membershipId), membershipDoc);

    await batch.commit();

    try {
      await sendEmailVerification(cred.user, {
        url: `${window.location.origin}/verify-email`,
        handleCodeInApp: false,
      });
    } catch (err) {
      console.warn("sendEmailVerification failed:", err);
    }
    
    // 5) Persist active org for app shell
    localStorage.setItem(LS_ACTIVE_ORG_KEY, orgId);

    return { uid, orgId };
  } catch (e) {
    throw new Error(firebaseErrorMessage(e));
  }
}
