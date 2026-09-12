import { createHash } from "node:crypto";
import { normalizeEmail, normalizePhone } from "./contact-validation";

export const MATERIALS = {
  asphalt: "ROOFING_ASPHALT",
  composite: "ROOFING_COMPOSITE",
  metal: "ROOFING_METAL",
  tile: "ROOFING_TILE",
  slate: "ROOFING_NATURAL_SLATE",
  cedar: "ROOFING_CEDAR_SHAKE",
  tar: "ROOFING_TAR_TORCHDOWN",
} as const;
export const PLANS = {
  repair: "Repair existing roof",
  replacement: "Completely replace roof",
  new: "Install roof on new construction",
} as const;
export const TIMEFRAMES = ["Immediately", "1-6 months", "Don't know"] as const;
const STATES = new Set(
  "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(
    " ",
  ),
);

export type Settings = {
  mode: "api" | "hosted";
  environment: "disabled" | "staging" | "production";
  accountApproved: boolean;
  productionApproved: boolean;
  consentApproved: boolean;
  staticConsentApproved: boolean;
  singleAdvertiserConsentApproved: boolean;
  jornayaRequired: boolean;
  tagId: string;
  sourceId: string;
  consentText: string;
  consentAdvertiserName: string;
  consentVersion: string;
  trustedFormScriptUrl: string;
  approvedServices: string[];
  allowedZips: string[];
  minimumPrice: number;
  affiliateUrl: string;
  affiliateHostname: string;
};
export class ModernizeError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}
export function readSettings(raw: string): Settings {
  const data = JSON.parse(raw || "{}");
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("Invalid settings");
  const string = (key: string) =>
    typeof data[key] === "string" ? data[key].trim() : "";
  const strings = (key: string) =>
    Array.isArray(data[key])
      ? data[key].filter((v: unknown) => typeof v === "string")
      : [];
  return {
    mode: data.mode === "hosted" ? "hosted" : "api",
    environment: ["staging", "production"].includes(data.environment)
      ? data.environment
      : "disabled",
    accountApproved: data.accountApproved === true,
    productionApproved: data.productionApproved === true,
    consentApproved: data.consentApproved === true,
    staticConsentApproved: data.staticConsentApproved === true,
    singleAdvertiserConsentApproved:
      data.singleAdvertiserConsentApproved === true,
    jornayaRequired: data.jornayaRequired !== false,
    tagId: string("tagId"),
    sourceId: string("sourceId"),
    // Preserve the approved text byte-for-byte, including intentional whitespace.
    consentText: typeof data.consentText === "string" ? data.consentText : "",
    consentAdvertiserName: string("consentAdvertiserName"),
    consentVersion: string("consentVersion"),
    trustedFormScriptUrl: string("trustedFormScriptUrl"),
    approvedServices: strings("approvedServices"),
    allowedZips: strings("allowedZips"),
    minimumPrice:
      typeof data.minimumPrice === "number" &&
      Number.isFinite(data.minimumPrice) &&
      data.minimumPrice >= 0
        ? data.minimumPrice
        : 0,
    affiliateUrl: string("affiliateUrl"),
    affiliateHostname: string("affiliateHostname"),
  };
}
export function readiness(settings: Settings): string[] {
  const missing: string[] = [];
  if (settings.environment === "disabled") missing.push("environment");
  if (!settings.accountApproved) missing.push("publisher approval");
  if (settings.environment === "production" && !settings.productionApproved)
    missing.push("production approval");
  if (settings.mode === "hosted") {
    try {
      const url = new URL(settings.affiliateUrl);
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.port ||
        url.hostname !== settings.affiliateHostname ||
        !url.hostname.includes(".")
      )
        throw Error();
    } catch {
      missing.push("approved HTTPS affiliate link and exact hostname");
    }
    return missing;
  }
  if (!/^\d{1,30}$/.test(settings.tagId)) missing.push("tagId");
  if (settings.environment === "production" && settings.tagId === "204670250")
    missing.push("production tagId");
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(settings.sourceId))
    missing.push("sourceId");
  if (!settings.consentApproved || !settings.staticConsentApproved)
    missing.push("approved static consent flow");
  // This tag represents one actual, always-consented advertiser. A network or
  // generic partner list must not be mislabeled as a single advertiser.
  if (
    !settings.singleAdvertiserConsentApproved ||
    !settings.consentAdvertiserName ||
    settings.consentAdvertiserName.length > 200 ||
    /[<>\u0000-\u001f]/.test(settings.consentAdvertiserName) ||
    settings.consentText.split(settings.consentAdvertiserName).length !== 2
  )
    missing.push(
      "approved single advertiser named exactly once in consent, or additional consent integration",
    );
  if (settings.jornayaRequired)
    missing.push(
      "confirmation that Jornaya is not required, or additional integration",
    );
  if (
    settings.consentText.trim().length < 30 ||
    settings.consentText.length > 8000 ||
    /[<>]/.test(settings.consentText) ||
    !settings.consentVersion
  )
    missing.push("approved plain-text consent and version");
  if (
    !settings.approvedServices.length ||
    settings.approvedServices.some(
      (s) =>
        !Object.values(MATERIALS).includes(
          s as (typeof MATERIALS)[keyof typeof MATERIALS],
        ),
    )
  )
    missing.push("approved roofing services");
  if (settings.allowedZips.some((z) => !/^\d{5}$/.test(z)))
    missing.push("valid allowedZips");
  try {
    const url = new URL(settings.trustedFormScriptUrl);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "api.trustedform.com" ||
      url.pathname !== "/trustedform.js" ||
      url.username ||
      url.password ||
      url.port ||
      url.hash
    )
      throw Error();
    if (
      url.searchParams.get("field") !== "xxTrustedFormCertUrl" ||
      url.searchParams.get("use_tagged_consent") !== "true"
    )
      throw Error();
    if (
      url.searchParams.get("sandbox") !==
      (settings.environment === "production" ? "false" : "true")
    )
      throw Error();
  } catch {
    missing.push(
      "TrustedForm SDK URL, field, tagged consent and correct sandbox mode",
    );
  }
  return missing;
}
export function configVersion(settings: Settings) {
  return createHash("sha256").update(JSON.stringify(settings)).digest("hex");
}
export function publicConfig(settings: Settings) {
  const enabled = readiness(settings).length === 0;
  return {
    mode: settings.mode,
    enabled,
    environment: settings.environment,
    version: configVersion(settings),
    consentText: enabled && settings.mode === "api" ? settings.consentText : "",
    consentAdvertiserName:
      enabled && settings.mode === "api" ? settings.consentAdvertiserName : "",
    consentVersion: enabled ? settings.consentVersion : "",
    trustedFormScriptUrl:
      enabled && settings.mode === "api" ? settings.trustedFormScriptUrl : "",
    materials: Object.entries(MATERIALS)
      .filter(([, code]) => settings.approvedServices.includes(code))
      .map(([key]) => key),
    affiliateUrl:
      enabled && settings.mode === "hosted" ? settings.affiliateUrl : "",
  };
}
export type Lead = {
  requestId: string;
  configVersion: string;
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  material: keyof typeof MATERIALS;
  plan: keyof typeof PLANS;
  timeframe: (typeof TIMEFRAMES)[number];
  authorized: true;
  consent: true;
  consentVersion: string;
  trustedFormToken: string;
};
export function validateLead(
  input: unknown,
  settings: Settings,
  enforceCurrent = true,
): Lead {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new ModernizeError("Invalid request.");
  const data = input as Record<string, unknown>;
  const text = (key: string, min: number, max: number) => {
    const value =
      typeof data[key] === "string" ? (data[key] as string).trim() : "";
    if (
      value.length < min ||
      value.length > max ||
      /[\x00-\x1f\x7f]/.test(value)
    )
      throw new ModernizeError(`Check the ${key} field.`);
    return value;
  };
  if (data.website) throw new ModernizeError("Unable to accept this request.");
  const requestId = text("requestId", 36, 36);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      requestId,
    )
  )
    throw new ModernizeError("Reload this page to start a new request.");
  if (
    enforceCurrent &&
    (data.configVersion !== configVersion(settings) ||
      data.consentVersion !== settings.consentVersion)
  )
    throw new ModernizeError(
      "Our contact permission has changed. Reload and review it before submitting.",
      409,
    );
  if (data.consent !== true || data.authorized !== true)
    throw new ModernizeError(
      "Please confirm property authorization and contact permission.",
    );
  const material = text("material", 1, 30) as Lead["material"];
  const plan = text("plan", 1, 30) as Lead["plan"];
  const timeframe = text("timeframe", 1, 30) as Lead["timeframe"];
  if (
    !Object.prototype.hasOwnProperty.call(MATERIALS, material) ||
    (enforceCurrent && !settings.approvedServices.includes(MATERIALS[material]))
  )
    throw new ModernizeError("This roof material is not currently supported.");
  if (
    !Object.prototype.hasOwnProperty.call(PLANS, plan) ||
    !TIMEFRAMES.includes(timeframe)
  )
    throw new ModernizeError("Choose a roofing need and timeframe.");
  const zip = text("zip", 5, 5),
    state = text("state", 2, 2);
  if (!/^\d{5}$/.test(zip) || !STATES.has(state))
    throw new ModernizeError("Check your ZIP code and state.");
  if (
    enforceCurrent &&
    settings.allowedZips.length &&
    !settings.allowedZips.includes(zip)
  )
    throw new ModernizeError(
      "Estimate matching is not currently available in this ZIP code.",
      422,
    );
  const phone = normalizePhone(text("phone", 10, 25));
  if (!phone) throw new ModernizeError("Enter a valid U.S. phone number.");
  const email = normalizeEmail(text("email", 5, 180));
  if (!email) throw new ModernizeError("Enter a valid email address.");
  const trustedFormToken = text("trustedFormToken", 1, 250);
  if (
    !/^https:\/\/cert\.trustedform\.com\/[a-f0-9]{40}$/i.test(trustedFormToken)
  )
    throw new ModernizeError(
      "Form verification is unavailable. Please reload and try again.",
    );
  return {
    requestId,
    configVersion: text("configVersion", 64, 64),
    consentVersion: text("consentVersion", 1, 100),
    firstName: text("firstName", 1, 80),
    lastName: text("lastName", 1, 80),
    address: text("address", 5, 180),
    city: text("city", 2, 80),
    state,
    zip,
    phone,
    email,
    material,
    plan,
    timeframe,
    trustedFormToken,
    consent: true,
    authorized: true,
  };
}
export function pingPayload(lead: Lead, settings: Settings) {
  return {
    tagId: settings.tagId,
    service: MATERIALS[lead.material],
    postalCode: lead.zip,
    buyTimeframe: lead.timeframe,
    ownHome: "Yes",
    partnerSourceId: settings.sourceId,
    publisherSubId: lead.requestId,
    RoofingPlan: PLANS[lead.plan],
  };
}
export function postPayload(lead: Lead, settings: Settings, pingToken: string) {
  return {
    ...pingPayload(lead, settings),
    pingToken,
    homePhoneConsentLanguage: settings.consentText,
    trustedFormToken: lead.trustedFormToken,
    firstName: lead.firstName,
    lastName: lead.lastName,
    address: lead.address,
    city: lead.city,
    state: lead.state,
    phone: lead.phone,
    email: lead.email,
  };
}
