import PropertyTextField from "./PropertyTextField";
import { useState } from "react";
import { ArrowRight, House, MapPin } from "lucide-react";
import { AddressSearch, ZipStart } from "./Widgets";
import { states, type Address } from "./location";

export default function LocationStart({
  onStart,
  demo = false,
  buttonLabel,
  onZipChange,
}: {
  onStart: (zip: string, address?: Address) => void;
  demo?: boolean;
  buttonLabel?: string;
  onZipChange?: (zip: string) => void;
}) {
  const [mode, setMode] = useState("zip");
  const [address, setAddress] = useState<Address>({
    address: "",
    city: "",
    state: "",
    zip: "",
  });
  const update = (key: keyof Address, value: string) => {
    if (key === "zip") onZipChange?.(value);
    setAddress((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="rz-location-start">
      <div
        className="rz-location-choice"
        role="group"
        aria-label="Start with ZIP code or full address"
      >
        <button
          type="button"
          aria-pressed={mode === "zip"}
          onClick={() => setMode("zip")}
        >
          <MapPin size={16} aria-hidden="true" /> ZIP code
        </button>
        <button
          type="button"
          aria-pressed={mode === "address"}
          onClick={() => {
            setMode("address");
            onZipChange?.(address.zip);
          }}
        >
          <House size={16} aria-hidden="true" /> Full address
        </button>
      </div>
      {mode === "zip" && (
        <ZipStart
          demo={demo}
          buttonLabel={buttonLabel}
          onZipChange={onZipChange}
          onStart={(zip) => onStart(zip)}
        />
      )}
      {mode === "address" && (
        <form
          className="rz-address-start"
          onSubmit={(event) => {
            event.preventDefault();
            onStart(address.zip, {
              ...address,
              address: address.address.trim(),
              city: address.city.trim(),
            });
          }}
        >
          {!demo && (
            <AddressSearch
              onSelect={(selected) => {
                setAddress(selected);
                onZipChange?.(selected.zip);
              }}
            />
          )}
          <PropertyTextField
            name="address"
            value={address.address}
            onChange={(value) => update("address", value)}
          />
          <PropertyTextField
            name="city"
            value={address.city}
            onChange={(value) => update("city", value)}
          />
          <div className="rz-fields">
            <label className="rz-field">
              State
              <select
                required
                autoComplete="address-level1"
                value={address.state}
                onChange={(event) => update("state", event.target.value)}
              >
                <option value="">Select state</option>
                {states.map((state) => (
                  <option key={state}>{state}</option>
                ))}
              </select>
            </label>
            <label className="rz-field">
              ZIP code
              <input
                required
                autoComplete="postal-code"
                inputMode="numeric"
                placeholder="ZIP code"
                pattern="[0-9]{5}"
                maxLength={5}
                title="Enter a 5-digit U.S. ZIP code"
                value={address.zip}
                onChange={(event) =>
                  update("zip", event.target.value.replace(/\D/g, ""))
                }
              />
            </label>
          </div>
          <button className="rz-button rz-estimate-next" type="submit">
            {buttonLabel || (demo ? "Start demo" : "Get my estimate")}{" "}
            <ArrowRight size={18} />
          </button>
        </form>
      )}
    </div>
  );
}
