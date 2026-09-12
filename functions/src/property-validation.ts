// Completeness only: this does not verify that an address exists or is deliverable.
export const PROPERTY_ADDRESS_ERROR =
  "Enter the house or building number followed by the street name, such as 123 Main Street. Use the property address, not a PO box.";

export function isCompletePropertyAddress(value: string): boolean {
  const address = value.trim();
  if (address.length < 5 || address.length > 180) return false;
  if (
    [...address].some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    return false;
  const [number, ...rest] = address.split(/\s+/);
  // Accommodate common suffixes, hyphenated numbers, fractions and grid addresses.
  // A numbered street ("5th Avenue") is not a house number.
  if (!/^(?:\d+[a-z]?(?:-\d+[a-z]?)?|[NSEW]\d+(?:[NSEW]\d+)+)$/i.test(number))
    return false;
  if (/^\d+(?:st|nd|rd|th)$/i.test(number)) return false;
  const street = rest.join(" ").replace(/^\d+\/\d+\s+/, "");
  if (!/\p{L}/u.test(street)) return false;
  return !/^(?:P\.?\s*O\.?\s*Box|Post Office Box|(?:RR|HC)\s+\d+\s+Box)\b/i.test(
    street,
  );
}
