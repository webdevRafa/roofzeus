import {
  isCompletePropertyAddress,
  PROPERTY_ADDRESS_ERROR,
} from "./property-validation";

export const CONSENT_VERSION = "2026-09-12.2";
export const HOMEOWNER_CONSENT =
  "I agree that RoofZeus may contact me by phone or email about roofing estimates for this property. My information will not be sent to a contractor until I agree to that introduction. I do not have to purchase anything.";
export const PARTNER_CONSENT =
  "I agree that RoofZeus may contact me about joining its contractor network. Registration does not guarantee leads or approve my business for referrals.";
const STATES = new Set(
  "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(
    " ",
  ),
);
export class IntakeError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}
export function validateIntake(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new IntakeError("Invalid request.");
  const data = input as Record<string, unknown>;
  const text = (key: string, max: number, min = 0) => {
    if (data[key] !== undefined && typeof data[key] !== "string")
      throw new IntakeError(`Check the ${key} field.`);
    const value = ((data[key] as string) || "").trim();
    const hasControlCharacter = [...value].some(
      (char) => char.charCodeAt(0) < 32 && !["\t", "\n", "\r"].includes(char),
    );
    if (value.length < min || value.length > max || hasControlCharacter)
      throw new IntakeError(`Check the ${key} field.`);
    return value;
  };
  const choice = (key: string, values: string[]) => {
    const value = text(key, 80, 1);
    if (!values.includes(value))
      throw new IntakeError(`Choose a valid ${key}.`);
    return value;
  };
  if (text("website", 200))
    throw new IntakeError("Unable to accept this request.");
  const kind = choice("kind", ["homeowner", "contractor"]);
  const requestId = text("requestId", 36, 36);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      requestId,
    )
  )
    throw new IntakeError(
      "Invalid request identifier. Please reload the page.",
    );
  if (data.consent !== true || data.consentVersion !== CONSENT_VERSION)
    throw new IntakeError(
      "Please review and accept the current contact permission.",
    );
  const email = text("email", 180, 5).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new IntakeError("Enter a valid email address.");
  const phone = text("phone", 25).replace(/\D/g, "");
  if (phone && !/^(1)?[2-9]\d{9}$/.test(phone))
    throw new IntakeError("Enter a valid U.S. phone number.");
  const common = {
    kind,
    requestId,
    name: text("name", 100, 2),
    email,
    phone,
    notes: text("notes", 2000),
    consentVersion: CONSENT_VERSION,
    sourcePath: kind === "homeowner" ? "/" : "/for-contractors",
  };
  if (kind === "contractor") {
    if (!phone) throw new IntakeError("Enter a business phone number.");
    const territoryZips = [
      ...new Set(
        text("territoryZips", 350, 5)
          .split(/[,\s]+/)
          .filter(Boolean),
      ),
    ];
    if (
      territoryZips.length > 30 ||
      territoryZips.some((zip) => !/^\d{5}$/.test(zip))
    )
      throw new IntakeError("Enter up to 30 valid five-digit ZIP codes.");
    return {
      ...common,
      kind: "contractor" as const,
      businessName: text("businessName", 150, 2),
      territoryZips,
      consentText: PARTNER_CONSENT,
    };
  }
  const zip = text("zip", 5, 5);
  if (!/^\d{5}$/.test(zip))
    throw new IntakeError("Enter a five-digit U.S. ZIP code.");
  const state = text("state", 2, 2);
  if (!STATES.has(state)) throw new IntakeError("Select a valid U.S. state.");
  if (data.authorized !== true)
    throw new IntakeError(
      "Confirm that you are authorized to request work for this property.",
    );
  const contactMethod = choice("contactMethod", ["email", "phone"]);
  const address = text("address", 180, 5);
  if (!isCompletePropertyAddress(address))
    throw new IntakeError(PROPERTY_ADDRESS_ERROR);
  if (contactMethod === "phone" && !phone)
    throw new IntakeError("A phone number is required for phone contact.");
  return {
    ...common,
    kind: "homeowner" as const,
    address,
    city: text("city", 80, 2),
    state,
    zip,
    service: choice("service", [
      "roof-repair",
      "roof-replacement",
      "storm-damage",
      "roof-inspection",
      "not-sure",
      "commercial",
    ]),
    urgency: choice("urgency", [
      "Active leak / urgent",
      "As soon as possible",
      "Within a month",
      "Just planning ahead",
    ]),
    propertyType: choice("propertyType", [
      "Single-family home",
      "Townhome / duplex",
      "Multi-family",
      "Commercial building",
    ]),
    roofMaterial: choice("roofMaterial", [
      "Not sure",
      "Asphalt shingle",
      "Metal",
      "Tile",
      "Flat / low-slope",
      "Other",
    ]),
    authorized: true,
    contactMethod,
    consentText: HOMEOWNER_CONSENT,
  };
}
