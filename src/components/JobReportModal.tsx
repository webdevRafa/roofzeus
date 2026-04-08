import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Printer, X, AlertCircle, Image as ImageIcon } from "lucide-react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { useOrg } from "../contexts/OrgContext";
import type { Job, Org, MaterialCategory } from "../types/types";

type JobPhoto = {
  id: string;
  jobId: string;
  createdAt?: any;
  fullUrl?: string;
  thumbUrl?: string;
  url?: string;
  caption?: string;
};
type OrgBranding = Pick<
  Org,
  "name" | "legalName" | "logoUrl" | "commonMaterials"
>;

function fmtCents(cents: number) {
  const dollars = (cents ?? 0) / 100;
  return dollars.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

type FsTimestampLike = { toDate: () => Date };
function isFsTimestamp(x: unknown): x is FsTimestampLike {
  return typeof (x as FsTimestampLike)?.toDate === "function";
}

function toDateObj(x: unknown): Date | null {
  if (!x) return null;
  if (isFsTimestamp(x)) return x.toDate();
  if (x instanceof Date) return x;
  if (typeof x === "string" || typeof x === "number") {
    const d = new Date(x);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function fmtMaybeDate(v: unknown) {
  const d = toDateObj(v);
  return d ? d.toLocaleString() : "—";
}

function formatAddress(job: Job) {
  if (typeof job.address === "string") return job.address;
  return (
    job.address?.fullLine ||
    [
      job.address?.line1,
      job.address?.city,
      job.address?.state,
      job.address?.zip,
    ]
      .filter(Boolean)
      .join(", ") ||
    job.id
  );
}

function safePhotoUrl(p: JobPhoto) {
  return p.thumbUrl || p.fullUrl || p.url || "";
}

const PRESET_MATERIAL_LABELS: Record<MaterialCategory, string> = {
  coilNails: "Coil Nails",
  tinCaps: "Tin Caps",
  np1Seal: "NP1 Seal",
  plasticJacks: "Plastic Jacks",
  counterFlashing: "Counter Flashing",
  jFlashing: "J / L Flashing",
  rainDiverter: "Rain Diverter",
};

function humanizeMaterialKey(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\bNp1\b/i, "NP1")
    .replace(/\bJl\b/i, "J / L")
    .trim();
}

function capitalizeFirstLetter(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function getMaterialDisplayName(
  category: string,
  orgBranding: OrgBranding | null
): string {
  const fromOrg = orgBranding?.commonMaterials
    ?.find((row) => row.key === category)
    ?.name?.trim();

  if (fromOrg) return capitalizeFirstLetter(fromOrg);

  if (category in PRESET_MATERIAL_LABELS) {
    return PRESET_MATERIAL_LABELS[category as MaterialCategory];
  }

  return capitalizeFirstLetter(humanizeMaterialKey(category));
}

const UI = {
  title:
    "text-[14px] font-semibold tracking-[0.02em] text-[rgb(var(--color-text-rgb)/0.98)]",
  address:
    "mt-1 truncate text-[13px] md:text-[18px] font-medium text-[rgb(var(--color-text-rgb)/0.82)]",
  subtitle: "mt-1 text-[12px] text-[rgb(var(--color-text-rgb)/0.56)]",

  sectionLabel:
    "mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[rgb(var(--color-text-rgb)/0.68)] print:text-[#6b7280]",
  sectionTitle:
    "text-[14px] font-semibold uppercase tracking-[0.12em] text-[rgb(var(--color-text-rgb)/0.94)] print:text-black",
  muted:
    "text-[12px] text-[rgb(var(--color-text-rgb)/0.60)] print:text-[#4b5563]",

  panel: "px-5 py-5 print:border-[#d1d5db] print:bg-white",
  softPanel:
    "border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-background-rgb)/0.08)] px-4 py-4 print:border-[#e5e7eb] print:bg-white",
  statPanel:
    "bg-[rgb(var(--color-background-rgb)/0.08)] px-5 py-4 print:border-[#d1d5db] print:bg-white",

  btnPrimary:
    "inline-flex items-center justify-center gap-2 border border-[rgb(var(--color-primary-rgb)/0.42)] bg-[rgb(var(--color-primary-rgb)/0.14)] px-3 py-2 text-xs font-semibold tracking-wide text-[rgb(var(--color-text-rgb)/0.96)] transition " +
    "hover:bg-[rgb(var(--color-primary-rgb)/0.22)] hover:border-[rgb(var(--color-primary-rgb)/0.56)] " +
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",

  iconBtn:
    "border border-transparent p-2 text-[rgb(var(--color-text-rgb)/0.58)] transition hover:border-[rgb(var(--color-border-rgb)/0.3)] hover:bg-[rgb(var(--color-background-rgb)/0.24)] hover:text-[rgb(var(--color-text-rgb)/0.9)]",
  materialRow:
    "flex items-start justify-between gap-3 bg-[rgb(var(--color-background-rgb)/0.08)] px-3 py-3 print:px-2.5 print:py-2",
  materialName:
    "text-[13px] font-medium leading-[1.2] text-[rgb(var(--color-text-rgb)/0.94)] print:text-[12px] print:font-semibold print:leading-[1.15] print:text-black",
  materialMeta:
    "mt-0.5 text-[11px] leading-[1.25] text-[rgb(var(--color-text-rgb)/0.62)] print:mt-[2px] print:text-[10px] print:leading-[1.15] print:text-[#4b5563]",
  materialAmount:
    "text-[13px] font-semibold text-[rgb(var(--color-text-rgb)/0.94)] print:text-[12px] print:leading-none print:text-black",
};
function JobReportDocument({
  job,
  address,
  createdLabel,
  updatedLabel,
  photos,
  totals,
  orgBranding,
}: {
  job: Job;
  address: string;
  createdLabel: string;
  updatedLabel: string;
  photos: JobPhoto[];
  totals: { earnings: number; expenses: number; net: number };
  orgBranding: OrgBranding | null;
}) {
  const payouts = job.expenses?.payouts ?? [];
  const materials = job.expenses?.materials ?? [];
  const summaryNotes = job.summaryNotes?.trim() ?? "";
  const recentPhotos = photos.slice(0, 8);

  return (
    <div className="bg-[var(--color-card)] print:bg-white print:text-black">
      <div className="p-5 print:px-8 print:py-2">
        {/* Header */}
        <div className={UI.panel}>
          <div className="flex flex-col gap-5 border-b border-[rgb(var(--color-border-rgb)/0.18)] pb-4 print:border-[#d1d5db] sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-4">
                {orgBranding?.logoUrl ? (
                  <img
                    src={orgBranding.logoUrl}
                    alt={
                      orgBranding.legalName ||
                      orgBranding.name ||
                      "Company logo"
                    }
                    className="h-14 w-14 shrink-0 object-contain print:h-16 print:w-16"
                  />
                ) : null}

                <div className="min-w-0">
                  {orgBranding?.legalName || orgBranding?.name ? (
                    <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[rgb(var(--color-text-rgb)/0.64)] print:text-[#6b7280]">
                      {orgBranding.legalName || orgBranding.name}
                    </div>
                  ) : null}

                  <h1 className="mt-1.5 text-[20px] font-semibold tracking-[-0.01em] text-[rgb(var(--color-text-rgb)/0.98)] print:text-black">
                    Job Report
                  </h1>
                </div>
              </div>
            </div>

            <div className="grid gap-1.5 text-left text-[12px] leading-5 text-[rgb(var(--color-text-rgb)/0.70)] print:min-w-[250px] print:text-[#374151] sm:text-right">
              <div>
                <span className="font-semibold print:text-black">Created:</span>{" "}
                {createdLabel}
              </div>
              <div>
                <span className="font-semibold print:text-black">Updated:</span>{" "}
                {updatedLabel}
              </div>
            </div>
          </div>

          <div className="pt-5">
            <div className="text-[15px] leading-[1.25] text-[rgb(var(--color-text-rgb)/0.98)] print:text-black">
              {address}
            </div>
            <div className="flex gap-2 mt-2">
              <div className="text-[14px]  text-[rgb(var(--color-text-rgb)/0.98)] print:text-black">
                {job.pricing?.sqft?.toLocaleString() ?? "—"}{" "}
                <span className="text-sm">SQ</span> @
              </div>
              <div className="text-[14px] text-[rgb(var(--color-text-rgb)/0.98)] print:text-black">
                {typeof job.pricing?.ratePerSqFt === "number"
                  ? `$${job.pricing.ratePerSqFt}`
                  : "—"}
                <span className="text-sm">/ SQ</span>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-[rgb(var(--color-text-rgb)/0.62)] print:text-black  ">
              <div>
                Job ID:{" "}
                <span className=" text-[rgb(var(--color-text-rgb)/0.92)] print:text-black">
                  {job.id}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Financials */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className={UI.statPanel}>
            <div className="text-[11px] uppercase tracking-[0.14em] text-[rgb(var(--color-text-rgb)/0.68)] print:text-[#6b7280]">
              Earnings
            </div>
            <div className="mt-1.5 text-[15px] leading-none text-[rgb(var(--color-text-rgb)/0.98)] print:text-black">
              {fmtCents(totals.earnings)}
            </div>
          </div>

          <div className={UI.statPanel}>
            <div className="text-[11px] uppercase tracking-[0.14em] text-[rgb(var(--color-text-rgb)/0.68)] print:text-[#6b7280]">
              Expenses
            </div>
            <div className="mt-1.5 text-[15px] leading-none text-[rgb(var(--color-text-rgb)/0.98)] print:text-black">
              {fmtCents(totals.expenses)}
            </div>
          </div>

          <div className={UI.statPanel}>
            <div className="text-[11px] uppercase tracking-[0.14em] text-[rgb(var(--color-text-rgb)/0.68)] print:text-[#6b7280]">
              Profit
            </div>
            <div className="mt-1.5 text-[15px] leading-none text-[rgb(var(--color-text-rgb)/0.98)] print:text-black">
              {fmtCents(totals.net)}
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="">
          <div className={UI.panel}>
            <div className="grid gap-0 border-t border-[rgb(var(--color-border-rgb)/0.18)] print:border-[#e5e7eb] sm:grid-cols-3">
              <div className="py-4 sm:pr-4 sm:border-r border-[rgb(var(--color-border-rgb)/0.14)] print:border-[#e5e7eb]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[rgb(var(--color-text-rgb)/0.68)] print:text-[#6b7280]">
                  Roof Size
                </div>
                <div className="mt-1.5 text-[14px] font-medium text-[rgb(var(--color-text-rgb)/0.98)] print:text-black">
                  {job.pricing?.sqft?.toLocaleString() ?? "—"}{" "}
                  <span className="text-sm">SQ</span>
                </div>
              </div>

              <div className="py-4 sm:px-4 sm:border-r border-[rgb(var(--color-border-rgb)/0.14)] print:border-[#e5e7eb]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[rgb(var(--color-text-rgb)/0.68)] print:text-[#6b7280]">
                  Rate
                </div>
                <div className="mt-1.5 text-[14px] font-medium text-[rgb(var(--color-text-rgb)/0.98)] print:text-black">
                  {typeof job.pricing?.ratePerSqFt === "number"
                    ? `$${job.pricing.ratePerSqFt}`
                    : "—"}{" "}
                  <span className="text-sm">/ SQ</span>
                </div>
              </div>

              <div className="py-4 sm:pl-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[rgb(var(--color-text-rgb)/0.68)] print:text-[#6b7280]">
                  Additional Fee
                </div>
                <div className="mt-1.5 text-[14px] font-medium text-[rgb(var(--color-text-rgb)/0.98)] print:text-black">
                  {typeof job.pricing?.feeCents === "number"
                    ? fmtCents(job.pricing.feeCents)
                    : "—"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Payouts + Materials */}
        <div className="grid w-full gap-5 lg:grid-cols-2 print:grid-cols-1">
          <div className={UI.panel}>
            <div className="flex items-center gap-2">
              <div className={UI.sectionTitle}>Payouts</div>
            </div>

            <div className="mt-0 text-[11px] text-[rgb(var(--color-text-rgb)/0.50)]">
              {payouts.length} payout{payouts.length === 1 ? "" : "s"}
            </div>

            <div className="mt-3 report-section-scroll space-y-2 print:space-y-1">
              {payouts.length ? (
                payouts.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 bg-[rgb(var(--color-background-rgb)/0.08)] px-3 py-2.5 print:px-2.5 print:py-2"
                  >
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium leading-[1.2] text-[rgb(var(--color-text-rgb)/0.94)] print:text-[12px] print:font-semibold print:leading-[1.15] print:text-black">
                        {p.payeeNickname || "Unnamed payee"}
                      </div>
                      <div className="mt-0.5 text-[11px] leading-[1.25] text-[rgb(var(--color-text-rgb)/0.62)] print:text-[10px] print:leading-[1.15] print:text-[#4b5563]">
                        {p.category === "felt" ? (
                          <span>Dry In</span>
                        ) : (
                          <span>Shingles</span>
                        )}
                        {typeof p.sqft === "number" &&
                        typeof p.ratePerSqFt === "number"
                          ? ` • ${p.sqft} sq @ $${p.ratePerSqFt}/sq`
                          : ""}
                      </div>
                    </div>

                    <div className="text-[13px] font-semibold text-[rgb(var(--color-text-rgb)/0.94)] print:text-[12px] print:leading-none print:text-black">
                      {fmtCents(p.amountCents)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-2 text-sm text-[rgb(var(--color-text-rgb)/0.56)]">
                  <AlertCircle className="h-4 w-4" />
                  No payouts added yet.
                </div>
              )}
            </div>
          </div>

          <div className={UI.panel}>
            <div className="flex items-center gap-2">
              <div className={UI.sectionTitle}>Materials</div>
            </div>

            <div className="mt-0 text-[11px] text-[rgb(var(--color-text-rgb)/0.50)]">
              {materials.length} material item
              {materials.length === 1 ? "" : "s"}
            </div>

            <div className="mt-3 report-section-scroll space-y-2 print:space-y-0.5">
              {materials.length ? (
                materials.map((m) => (
                  <div key={m.id} className={UI.materialRow}>
                    <div className="min-w-0">
                      <div className={UI.materialName}>
                        {getMaterialDisplayName(m.category, orgBranding)}
                        {m.vendor && (
                          <span className="ml-1 text-[11px] font-normal text-[rgb(var(--color-text-rgb)/0.55)] print:text-[10px] print:text-[#6b7280]">
                            • {m.vendor}
                          </span>
                        )}
                      </div>

                      <div className={UI.materialMeta}>
                        {m.quantity} × {fmtCents(m.unitPriceCents)}
                      </div>
                    </div>

                    <div className={UI.materialAmount}>
                      {fmtCents(m.amountCents)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-2 text-sm text-[rgb(var(--color-text-rgb)/0.56)]">
                  <AlertCircle className="h-4 w-4" />
                  No materials added yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Summary Notes */}
        <div className="mt-5">
          <div className={UI.panel}>
            <div className={UI.sectionTitle}>Summary Notes</div>
            <div className="mt-3 report-section-scroll">
              <div className="text-[13px] leading-[1.55] whitespace-pre-wrap text-[rgb(var(--color-text-rgb)/0.88)] print:text-black">
                {summaryNotes || "No summary notes."}
              </div>
            </div>
          </div>
        </div>

        {/* Photos */}
        <div className="mt-5">
          <div className={UI.panel}>
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-[rgb(var(--color-text-rgb)/0.58)]" />
              <div className={UI.sectionTitle}>Recent Photos</div>
            </div>

            <div className="mt-0 text-[11px] text-[rgb(var(--color-text-rgb)/0.50)]">
              {photos.length} photo{photos.length === 1 ? "" : "s"} attached to
              this job
            </div>

            {recentPhotos.length ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {recentPhotos.map((p) => {
                  const src = safePhotoUrl(p);
                  return (
                    <div
                      key={p.id}
                      className="border border-[rgb(var(--color-border-rgb)/0.16)] bg-[rgb(var(--color-background-rgb)/0.12)] p-2"
                    >
                      {src ? (
                        <img
                          src={src}
                          alt={p.caption || "Job photo"}
                          className="h-32 w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-32 w-full items-center justify-center bg-[rgb(var(--color-background-rgb)/0.18)] text-[rgb(var(--color-text-rgb)/0.42)]">
                          No image
                        </div>
                      )}

                      <div className="mt-1.5 text-[11px] leading-[1.35] text-[rgb(var(--color-text-rgb)/0.64)] print:text-[10px] print:leading-[1.3] print:text-[#4b5563]">
                        {p.caption || "No caption"}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-2 text-sm text-[rgb(var(--color-text-rgb)/0.56)]">
                <AlertCircle className="h-4 w-4" />
                No photos uploaded yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function JobReportModal({
  open,
  onClose,
  job,
  photos,
  totals,
}: {
  open: boolean;
  onClose: () => void;
  job: Job;
  photos: JobPhoto[];
  totals: { earnings: number; expenses: number; net: number };
}) {
  const address = formatAddress(job);
  const { orgId } = useOrg();
  const [orgBranding, setOrgBranding] = useState<OrgBranding | null>(null);

  const createdLabel = useMemo(
    () => fmtMaybeDate(job.createdAt),
    [job.createdAt]
  );
  const updatedLabel = useMemo(
    () => fmtMaybeDate(job.updatedAt),
    [job.updatedAt]
  );

  useEffect(() => {
    if (!orgId) {
      setOrgBranding(null);
      return;
    }

    const ref = doc(db, "organizations", orgId);

    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setOrgBranding(null);
          return;
        }

        const data = snap.data() as Partial<Org>;
        setOrgBranding({
          name: data.name ?? "",
          legalName: data.legalName ?? "",
          logoUrl: data.logoUrl ?? null,
          commonMaterials: data.commonMaterials ?? [],
        });
      },
      () => {
        setOrgBranding(null);
      }
    );

    return () => unsub();
  }, [orgId]);

  if (!open) return null;

  return createPortal(
    <div className="job-report-print fixed inset-0 z-[145] overflow-y-auto bg-[var(--color-background)]/40 backdrop-blur-md p-3 pt-[calc(72px+12px)] sm:p-4 sm:pt-[calc(72px+16px)] print:bg-transparent print:p-0">
      <button
        type="button"
        className="fixed inset-0 z-0 print:hidden"
        aria-label="Close"
        onClick={onClose}
      />

      <div className="relative z-10 flex min-h-full items-start justify-center">
        <div className="job-report-print-inner relative flex w-full max-w-5xl min-h-0 flex-col overflow-hidden border border-[rgb(var(--color-border-rgb)/0.34)] bg-[var(--color-card)] shadow-[0_30px_80px_rgba(0,0,0,0.55)] max-h-[calc(100dvh-72px-24px)] sm:max-h-[calc(100dvh-72px-32px)] print:max-h-none print:shadow-none print:border-0 print:max-w-none print:bg-white">
          {/* top bar */}
          <div className="border-b border-[rgb(var(--color-border-rgb)/0.26)] bg-[rgb(var(--color-background-rgb)/0.18)] px-4 py-4 print:hidden sm:px-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className={UI.address}>{address}</div>

                <div className="mt-1 text-[11px] text-[rgb(var(--color-text-rgb)/0.52)]">
                  Tip: Disable "Headers and footers" in print settings for a
                  cleaner report.
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className={UI.btnPrimary}
                  title="Print or save PDF"
                >
                  <Printer className="h-4 w-4" />
                  Print / Save PDF
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className={UI.iconBtn}
                  aria-label="Close"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* content */}
          <div className="report-scroll min-h-0 flex-1 overflow-y-auto">
            <JobReportDocument
              job={job}
              address={address}
              createdLabel={createdLabel}
              updatedLabel={updatedLabel}
              photos={photos}
              totals={totals}
              orgBranding={orgBranding}
            />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
