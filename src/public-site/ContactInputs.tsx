import { useEffect, useRef, useState } from "react";
import {
  normalizeEmail,
  normalizePhone,
} from "../../functions/src/contact-validation";

type ContactProps = { value: string; onChange: (value: string) => void };
const phoneError =
  "Enter a valid 10-digit U.S. phone number, such as (210) 555-0123.";
const emailError = "Enter a valid email address, such as name@example.com.";

function formatPhone(digits: string) {
  if (!digits) return "";
  if (digits.length < 3) return `(${digits}`;
  if (digits.length === 3) return `(${digits})`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
function caretForDigits(display: string, count: number) {
  if (count === 0) return display.startsWith("(") ? 1 : 0;
  for (let index = 0; index < display.length; index++) {
    if (/\d/.test(display[index]) && --count === 0) return index + 1;
  }
  return display.length;
}

export function PhoneField({ value, onChange }: ContactProps) {
  const input = useRef<HTMLInputElement>(null);
  const [touched, setTouched] = useState(false);
  const [editError, setEditError] = useState("");
  const valid = normalizePhone(value) !== null;
  // Rejected keystrokes/pastes do not change the retained phone number.
  // Validate that value, not an attempted edit that was never accepted.
  const error = valid ? "" : editError || (touched ? phoneError : "");
  const display = formatPhone(value);
  useEffect(() => {
    input.current?.setCustomValidity(valid ? "" : editError || phoneError);
  }, [valid, editError]);
  function update(digits: string, digitPosition: number) {
    setEditError("");
    onChange(digits);
    // Set the caret after React has applied the controlled, formatted value.
    requestAnimationFrame(() => {
      if (document.activeElement === input.current) {
        const position = caretForDigits(formatPhone(digits), digitPosition);
        input.current?.setSelectionRange(position, position);
      }
    });
  }
  return (
    <div className="rz-field">
      <label htmlFor="modernize-phone">Phone number</label>
      <input
        id="modernize-phone"
        ref={input}
        name="phone"
        data-tf-element-role="consent-grantor-phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="(210) 555-0123"
        required
        value={display}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          error
            ? "modernize-phone-help modernize-phone-error"
            : "modernize-phone-help"
        }
        onBlur={() => setTouched(true)}
        onInvalid={() => setTouched(true)}
        onChange={(event) => {
          const raw = event.currentTarget.value;
          if (raw.startsWith("+") && raw.length > 1 && !raw.startsWith("+1")) {
            setEditError(
              "Enter a U.S. phone number. Only the +1 country code is supported.",
            );
            return;
          }
          if (raw && !/^\+?[0-9(). -]*$/.test(raw)) {
            setEditError(
              "Use numbers only. Letters and phone extensions aren’t supported.",
            );
            return;
          }
          let digits = raw.replace(/\D/g, "");
          let position = raw
            .slice(0, event.currentTarget.selectionStart ?? raw.length)
            .replace(/\D/g, "").length;
          if (digits.length === 11 && digits.startsWith("1")) {
            digits = digits.slice(1);
            position = Math.max(0, position - 1);
          }
          if (digits.length > 10) {
            setEditError(
              "Enter 10 digits, with an optional +1 country code. Extensions aren’t supported.",
            );
            return;
          }
          update(digits, position);
        }}
        onKeyDown={(event) => {
          if (
            !["Backspace", "Delete"].includes(event.key) ||
            event.altKey ||
            event.ctrlKey ||
            event.metaKey
          )
            return;
          const el = event.currentTarget;
          let start = display
            .slice(0, el.selectionStart ?? 0)
            .replace(/\D/g, "").length;
          let end = display
            .slice(0, el.selectionEnd ?? 0)
            .replace(/\D/g, "").length;
          if (start === end) {
            if (event.key === "Backspace") start = Math.max(0, start - 1);
            else end = Math.min(value.length, end + 1);
          }
          event.preventDefault();
          update(value.slice(0, start) + value.slice(end), start);
        }}
      />
      <span id="modernize-phone-help" className="rz-field-help">
        U.S. number, including area code.
      </span>
      {error && (
        <span id="modernize-phone-error" className="rz-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export function EmailField({ value, onChange }: ContactProps) {
  const input = useRef<HTMLInputElement>(null);
  const [touched, setTouched] = useState(false);
  const valid = normalizeEmail(value) !== null;
  const error = touched && !valid;
  useEffect(() => {
    input.current?.setCustomValidity(valid ? "" : emailError);
  }, [valid]);
  return (
    <div className="rz-field">
      <label htmlFor="modernize-email">Email address</label>
      <input
        id="modernize-email"
        ref={input}
        name="email"
        data-tf-element-role="consent-grantor-email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        required
        maxLength={180}
        placeholder="name@example.com"
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "modernize-email-error" : undefined}
        onChange={(event) => onChange(event.target.value)}
        onInvalid={() => setTouched(true)}
        onBlur={() => {
          setTouched(true);
          onChange(value.trim().toLowerCase());
        }}
      />
      {error && (
        <span id="modernize-email-error" className="rz-error" role="alert">
          {emailError}
        </span>
      )}
    </div>
  );
}
