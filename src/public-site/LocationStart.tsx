import { useState } from "react";
import { ArrowRight, House, MapPin } from "lucide-react";
import { AddressSearch, ZipStart } from "./Widgets";
import { states, type Address } from "./location";

export default function LocationStart({
  onStart,
  demo = false,
}: {
  onStart: (zip: string, address?: Address) => void;
  demo?: boolean;
}) {
  const [mode, setMode] = useState("zip");
  const [address, setAddress] = useState<Address>({
    address: "",
    city: "",
    state: "",
    zip: "",
  });
  const update = (key: keyof Address, value: string) =>
    setAddress((current) => ({ ...current, [key]: value }));

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
          onClick={() => setMode("address")}
        >
          <House size={16} aria-hidden="true" /> Full address
        </button>
      </div>
      {mode === "zip" && (
        <ZipStart demo={demo} onStart={(zip) => onStart(zip)} />
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
          {!demo && <AddressSearch onSelect={setAddress} />}
          <label className="rz-field">
            Street address
            <input
              required
              autoComplete="street-address"
              placeholder="123 Main Street"
              minLength={5}
              maxLength={180}
              pattern=".*\S.*"
              value={address.address}
              onChange={(event) => update("address", event.target.value)}
            />
          </label>
          <label className="rz-field">
            City
            <input
              required
              autoComplete="address-level2"
              placeholder="City"
              minLength={2}
              maxLength={80}
              pattern=".*\S.*"
              value={address.city}
              onChange={(event) => update("city", event.target.value)}
            />
          </label>
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
            {demo ? "Start demo" : "Get my estimate"} <ArrowRight size={18} />
          </button>
        </form>
      )}
    </div>
  );
}
