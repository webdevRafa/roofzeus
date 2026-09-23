import { useEffect, useRef, useState } from "react";
import { ArrowRight, MapPin, LoaderCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { loadScript, lookupZip } from "./integrations";
import type { Address } from "./location";

export function ZipStart({
  compact = false,
  onStart,
  demo = false,
  buttonLabel,
  onZipChange,
}: {
  compact?: boolean;
  demo?: boolean;
  buttonLabel?: string;
  onZipChange?: (zip: string) => void;
  onStart?: (zip: string) => void;
}) {
  const [zip, setZip] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  useEffect(() => {
    if (demo) return;
    try {
      const saved = localStorage.getItem("roofzeus.zip") || "";
      setZip(saved);
      onZipChange?.(saved);
    } catch {
      /* Storage is optional. */
    }
  }, [demo, onZipChange]);
  return (
    <form
      className={`rz-zip-start ${compact ? "compact" : ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (!/^\d{5}$/.test(zip)) {
          setError("Enter a 5-digit U.S. ZIP code.");
          return;
        }
        try {
          if (!demo) localStorage.setItem("roofzeus.zip", zip);
        } catch {
          /* Storage is optional. */
        }
        if (onStart) onStart(zip);
        else navigate(`/?zip=${zip}&estimate=1`);
      }}
    >
      <label htmlFor={compact ? "zip-bottom" : "zip-start"}>ZIP code</label>
      <div className="rz-zip-controls">
        <div>
          <MapPin size={20} aria-hidden="true" />
          <input
            id={compact ? "zip-bottom" : "zip-start"}
            autoComplete="postal-code"
            inputMode="numeric"
            placeholder="Enter ZIP code"
            maxLength={5}
            value={zip}
            aria-describedby={error ? "zip-error" : undefined}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, "");
              setZip(value);
              onZipChange?.(value);
              setError("");
            }}
          />
        </div>
        <button className="rz-button" type="submit">
          {buttonLabel || (demo ? "Start demo" : "Get my estimate")}{" "}
          <ArrowRight size={18} />
        </button>
      </div>
      {error && (
        <p id="zip-error" role="alert" className="rz-error">
          {error}
        </p>
      )}
    </form>
  );
}
export function LocationInsight() {
  const [location, setLocation] = useState<{
    city: string;
    state: string;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let zip = "";
    try {
      zip = localStorage.getItem("roofzeus.zip") || "";
    } catch {
      /* Optional. */
    }
    if (zip)
      lookupZip(zip, controller.signal)
        .then(setLocation)
        .catch(() => {});
    return () => controller.abort();
  }, []);
  return location ? (
    <p className="rz-location-message">
      <MapPin size={16} /> Planning in {location.city}, {location.state}? We’ll
      check availability after reviewing your request.{" "}
      <a href="/find-a-roofer">Change location</a>
    </p>
  ) : null;
}
type Place = {
  formattedAddress?: string;
  addressComponents?: {
    longText: string;
    shortText: string;
    types: string[];
  }[];
  fetchFields: (options: { fields: string[] }) => Promise<unknown>;
};
type GoogleGlobal = {
  maps: {
    importLibrary: (name: string) => Promise<{
      PlaceAutocompleteElement: new (options: object) => HTMLElement;
    }>;
  };
};
export function AddressSearch({
  onSelect,
}: {
  onSelect: (address: Address) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const handler = useRef(onSelect);
  const [failed, setFailed] = useState(false);
  handler.current = onSelect;
  useEffect(() => {
    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!key) return;
    let active = true;
    let widget: HTMLElement | undefined;
    loadScript(
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&v=weekly&callback=__roofzeusMapsReady`,
      "__roofzeusMapsReady",
    )
      .then(async () => {
        const google = (window as unknown as { google: GoogleGlobal }).google;
        const { PlaceAutocompleteElement } =
          await google.maps.importLibrary("places");
        if (!active) return;
        widget = new PlaceAutocompleteElement({ includedRegionCodes: ["us"] });
        widget.setAttribute("placeholder", "Search your property address");
        widget.setAttribute(
          "aria-label",
          "Search your property address with Google",
        );
        widget.addEventListener("gmp-select", async (event) => {
          try {
            const place = (
              event as Event & { placePrediction: { toPlace: () => Place } }
            ).placePrediction.toPlace();
            await place.fetchFields({ fields: ["addressComponents"] });
            if (!active) return;
            const component = (type: string, short = false) => {
              const c = place.addressComponents?.find((c) =>
                c.types.includes(type),
              );
              return (short ? c?.shortText : c?.longText) || "";
            };
            handler.current({
              address:
                `${component("street_number")} ${component("route")}`.trim(),
              city:
                component("locality") ||
                component("sublocality") ||
                component("postal_town"),
              state: component("administrative_area_level_1", true),
              zip: component("postal_code"),
            });
            if (!component("street_number")) {
              // A route prediction is useful context, but is not a property.
              // Wait for the controlled address field to receive the selection.
              requestAnimationFrame(() => {
                if (!active) return;
                const addressInput = ref.current
                  ?.closest("form")
                  ?.querySelector<HTMLInputElement>('input[name="address"]');
                addressInput?.focus();
                addressInput?.reportValidity();
              });
            }
          } catch {
            setFailed(true);
          }
        });
        widget.addEventListener("gmp-error", () => setFailed(true));
        ref.current?.append(widget);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      widget?.remove();
    };
  }, []);
  if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY) return null;
  return (
    <div className="rz-address-search">
      <div ref={ref} />
      {failed ? (
        <p>
          Address search is unavailable. Please enter the property details
          below.
        </p>
      ) : (
        <p>
          Search with Google, or enter your address below. You can edit every
          field.
        </p>
      )}
    </div>
  );
}
type TurnstileApi = {
  render: (element: HTMLElement, options: object) => string;
  remove: (id: string) => void;
};
export function BotCheck({
  onToken,
  resetKey = 0,
}: {
  onToken: (token: string) => void;
  resetKey?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const callback = useRef(onToken);
  callback.current = onToken;
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const sitekey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
    if (!sitekey) return;
    let active = true;
    let id: string | undefined;
    let api: TurnstileApi | undefined;
    loadScript(
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
    )
      .then(() => {
        if (!active || !ref.current) return;
        api = (window as unknown as { turnstile: TurnstileApi }).turnstile;
        id = api.render(ref.current, {
          sitekey,
          action: "roofing-intake",
          theme: "light",
          size: "flexible",
          callback: (token: string) => callback.current(token),
          "expired-callback": () => callback.current(""),
          "error-callback": () => {
            callback.current("");
            setFailed(true);
          },
        });
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      if (id) api?.remove(id);
    };
  }, [resetKey]);
  return (
    <div className="rz-bot-check">
      <div ref={ref} />
      {failed && (
        <p role="alert">
          Security verification could not load. Please check your connection and
          reload this page.
        </p>
      )}
    </div>
  );
}
export function Busy() {
  return <LoaderCircle className="rz-spin" size={18} aria-label="Working" />;
}
