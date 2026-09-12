import { useEffect, useId, useRef, useState } from "react";
import {
  isCompletePropertyAddress,
  PROPERTY_ADDRESS_ERROR,
} from "../../functions/src/property-validation";

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
  const id = useId();
  const [touched, setTouched] = useState(false);
  const street = name === "address";
  const minimum = street ? 5 : 2;
  const maximum = street ? 180 : 80;
  const valid =
    value.trim().length >= minimum &&
    value.trim().length <= maximum &&
    // Reject control characters, matching the gateway's text validation.
    // eslint-disable-next-line no-control-regex
    !/[\u0000-\u001f\u007f]/.test(value) &&
    (!street || isCompletePropertyAddress(value));
  const message = street
    ? PROPERTY_ADDRESS_ERROR
    : `Enter a city with at least ${minimum} characters, excluding surrounding spaces.`;
  useEffect(() => {
    input.current?.setCustomValidity(valid ? "" : message);
  }, [valid, message]);
  return (
    <div className="rz-field">
      <label htmlFor={`${id}-input`}>
        {street ? "Street address" : "City"}
      </label>
      <input
        id={`${id}-input`}
        ref={input}
        name={name}
        autoComplete={street ? "street-address" : "address-level2"}
        placeholder={street ? "123 Main Street" : "City"}
        data-tf-element-role={street ? "consent-grantor-address" : undefined}
        required
        minLength={minimum}
        maxLength={maximum}
        value={value}
        aria-invalid={touched && !valid ? true : undefined}
        aria-describedby={touched && !valid ? id : undefined}
        onInvalid={() => setTouched(true)}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => {
          setTouched(true);
          onChange(value.trim());
        }}
      />
      {touched && !valid && (
        <span id={id} className="rz-error" role="alert">
          {message}
        </span>
      )}
    </div>
  );
}
