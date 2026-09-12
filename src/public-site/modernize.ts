import { useEffect, useState } from "react";

export const modernizeMode = import.meta.env.VITE_LEAD_DELIVERY !== "manual";
export const roofMaterials = {
  asphalt: "Asphalt shingles",
  composite: "Composite shingles",
  metal: "Metal",
  tile: "Tile",
  slate: "Natural slate",
  cedar: "Cedar shake",
  tar: "Tar / torch-down",
};
export type ModernizeConfig = {
  enabled: boolean;
  mode: "api" | "hosted";
  environment: string;
  version: string;
  consentText: string;
  consentVersion: string;
  trustedFormScriptUrl: string;
  materials: string[];
  affiliateUrl: string;
};
export const closedConfig: ModernizeConfig = {
  enabled: false,
  mode: "api",
  environment: "disabled",
  version: "",
  consentText: "",
  consentVersion: "",
  trustedFormScriptUrl: "",
  materials: Object.keys(roofMaterials),
  affiliateUrl: "",
};
const gateway = (import.meta.env.VITE_MODERNIZE_GATEWAY_URL || "").replace(
  /\/$/,
  "",
);
export function useModernizeConfig(demo = false) {
  const [config, setConfig] = useState(closedConfig);
  const [loading, setLoading] = useState(
    Boolean(!demo && gateway && modernizeMode),
  );
  useEffect(() => {
    if (demo || !gateway || !modernizeMode) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    fetch(`${gateway}/config`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw Error();
        const value = await response.json();
        if (
          !value ||
          !["api", "hosted"].includes(value.mode) ||
          typeof value.version !== "string" ||
          !Array.isArray(value.materials)
        )
          throw Error();
        setConfig({
          ...closedConfig,
          ...value,
          enabled:
            value.enabled === true &&
            (value.mode === "hosted" ||
              Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY)),
        });
      })
      .catch(() => setConfig(closedConfig))
      .finally(() => {
        clearTimeout(timeout);
        setLoading(false);
      });
    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [demo]);
  return {
    config: demo ? closedConfig : config,
    loading: demo ? false : loading,
  };
}
export type ModernizeResult = {
  reference: string;
  status: "processing" | "accepted" | "no_match" | "not_sent" | "unknown";
  environment: string;
};
export class SubmissionError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
export async function submitModernize(
  payload: unknown,
): Promise<ModernizeResult> {
  if (!gateway)
    throw new SubmissionError("Estimate matching is not open yet.", 503);
  const response = await fetch(`${gateway}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(55000),
  });
  const data = await response.json();
  if (!response.ok)
    throw new SubmissionError(
      data.error || "We could not confirm your request.",
      response.status,
    );
  if (
    !/^RZM-[A-F0-9]{16}$/.test(data.reference) ||
    !["processing", "accepted", "no_match", "not_sent", "unknown"].includes(
      data.status,
    )
  )
    throw new SubmissionError("We could not confirm your request.", 503);
  return data;
}
