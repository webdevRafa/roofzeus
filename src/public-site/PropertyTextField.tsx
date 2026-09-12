import { useEffect, useRef } from "react";

/** Match the server's trimmed address/city limits, including autofilled values. */
export default function PropertyTextField({
  name,
  value,
  onChange,
}: {
  name: "address" | "city";
  value: string;
  onChange: (value: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const street = name === "address";
  const minimum = street ? 5 : 2;
  const maximum = street ? 180 : 80;
  const valid =
    value.trim().length >= minimum &&
    value.trim().length <= maximum &&
    // Reject control characters, matching the gateway's text validation.
    // eslint-disable-next-line no-control-regex
    !/[\u0000-\u001f]/.test(value);
  useEffect(() => {
    input.current?.setCustomValidity(
      valid
        ? ""
        : `Enter a ${street ? "street address" : "city"} with at least ${minimum} characters, excluding surrounding spaces.`,
    );
  }, [valid, street, minimum]);
  return (
    <label className="rz-field">
      {street ? "Street address" : "City"}
      <input
        ref={input}
        name={name}
        autoComplete={street ? "street-address" : "address-level2"}
        placeholder={street ? "123 Main Street" : "City"}
        data-tf-element-role={street ? "consent-grantor-address" : undefined}
        required
        minLength={minimum}
        maxLength={maximum}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => onChange(value.trim())}
      />
    </label>
  );
}
