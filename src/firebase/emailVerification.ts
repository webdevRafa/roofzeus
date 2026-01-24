// src/firebase/emailVerification.ts
import { httpsCallable } from "firebase/functions";
import { functions } from "./firebaseConfig";

type SendEmailVerificationInput = {
  continueUrl?: string; // optional, safe
};

type SendEmailVerificationOutput = {
  ok: boolean;
  skipped?: boolean;
  alreadyVerified?: boolean;
  reason?: string;
};

type ConfirmEmailVerificationInput = {
  token: string;
};

type ConfirmEmailVerificationOutput = {
  ok: boolean;
};

export const sendCustomEmailVerificationCallable = httpsCallable<
  SendEmailVerificationInput,
  SendEmailVerificationOutput
>(functions, "sendCustomEmailVerification");

export const confirmCustomEmailVerificationCallable = httpsCallable<
  ConfirmEmailVerificationInput,
  ConfirmEmailVerificationOutput
>(functions, "confirmCustomEmailVerification");
