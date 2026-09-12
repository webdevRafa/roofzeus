// Pure validation shared by the public form and its server endpoint.
// These checks validate syntax, not ownership, reachability, or mailbox existence.
export function normalizePhone(value: string): string | null {
  const input = value.trim();
  if (input.startsWith("+") && !input.startsWith("+1")) return null;
  if (!/^\+?[0-9(). -]+$/.test(input)) return null;
  let digits = input.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(digits) ? digits : null;
}

export function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  if (email.length > 180) return null;
  const parts = email.split("@");
  if (parts.length !== 2) return null;
  const [local, domain] = parts;
  if (
    !local ||
    local.length > 64 ||
    local.startsWith(".") ||
    local.endsWith(".") ||
    local.includes("..")
  )
    return null;
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)) return null;
  const labels = domain.split(".");
  if (
    labels.length < 2 ||
    labels.some(
      (label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label),
    )
  )
    return null;
  if (!/^(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/.test(labels[labels.length - 1]))
    return null;
  return email;
}
