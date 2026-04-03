import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Printer,
  X,
  AlertCircle,
  FileText,
  BadgeDollarSign,
  ClipboardList,
  Image as ImageIcon,
} from "lucide-react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { useOrg } from "../contexts/OrgContext";
import type { Job, Org } from "../types/types";

type JobPhoto = {
  id: string;
  jobId: string;
  createdAt?: any;
  fullUrl?: string;
  thumbUrl?: string;
  url?: string;
  caption?: string;
};
type OrgBranding = Pick<Org, "name" | "legalName" | "logoUrl">;

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

function fmtMaybeShortDate(v: unknown) {
  const d = toDateObj(v);
  return d ? d.toLocaleDateString() : "—";
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

const UI = {
  title:
    "text-[15px] font-semibold tracking-[0.02em] text-[rgb(var(--color-text-rgb)/0.98)]",
  address:
    "mt-1 truncate text-[13px] font-medium text-[rgb(var(--color-text-rgb)/0.82)]",
  subtitle: "mt-1 text-[12px] text-[rgb(var(--color-text-rgb)/0.56)]",

  sectionLabel:
    "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgb(var(--color-text-rgb)/0.58)]",
  sectionTitle:
    "text-sm font-semibold tracking-[0.01em] text-[rgb(var(--color-text-rgb)/0.96)]",
  muted: "text-[12px] text-[rgb(var(--color-text-rgb)/0.52)]",

  panel:
    "border border-[rgb(var(--color-border-rgb)/0.26)] bg-[rgb(var(--color-background-rgb)/0.14)] px-4 py-4",
  softPanel:
    "border border-[rgb(var(--color-border-rgb)/0.22)] bg-[rgb(var(--color-background-rgb)/0.12)] px-3 py-3",
  statPanel:
    "border border-[rgb(var(--color-border-rgb)/0.22)] bg-[rgb(var(--color-background-rgb)/0.18)] px-4 py-4",

  btnPrimary:
    "inline-flex items-center justify-center gap-2 border border-[rgb(var(--color-primary-rgb)/0.42)] bg-[rgb(var(--color-primary-rgb)/0.14)] px-3 py-2 text-xs font-semibold tracking-wide text-[rgb(var(--color-text-rgb)/0.96)] transition " +
    "hover:bg-[rgb(var(--color-primary-rgb)/0.22)] hover:border-[rgb(var(--color-primary-rgb)/0.56)] " +
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",

  iconBtn:
    "border border-transparent p-2 text-[rgb(var(--color-text-rgb)/0.58)] transition hover:border-[rgb(var(--color-border-rgb)/0.3)] hover:bg-[rgb(var(--color-background-rgb)/0.24)] hover:text-[rgb(var(--color-text-rgb)/0.9)]",
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
  const notes = job.notes ?? [];
  const summaryNotes = job.summaryNotes?.trim() ?? "";
  const warranty = job.warranty;
  const recentPhotos = photos.slice(0, 8);

  return (
    <div className="bg-[var(--color-card)] print:bg-white print:text-black">
      <div className="p-5 print:px-8 print:py-7">
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
                    <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[rgb(var(--color-text-rgb)/0.62)] print:text-[#6b7280]">
                      {orgBranding.legalName || orgBranding.name}
                    </div>
                  ) : null}

                  <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.02em] text-[rgb(var(--color-text-rgb)/0.98)] print:text-black">
                    Job Report
                  </h1>
                </div>
              </div>
            </div>

            <div className="grid gap-2 text-left text-[12px] text-[rgb(var(--color-text-rgb)/0.68)] print:min-w-[250px] print:text-[#374151] sm:text-right">
              <div>
                <span className="font-semibold print:text-black">Created:</span>{" "}
                {createdLabel}
              </div>
              <div>
                <span className="font-semibold print:text-black">Updated:</span>{" "}
                {updatedLabel}
              </div>
              <div>
                <span className="font-semibold print:text-black">
                  Punch scheduled:
                </span>{" "}
                {fmtMaybeShortDate(job.punchScheduledFor)}
              </div>
            </div>
          </div>

          <div className="pt-4">
            <div className="text-[22px] font-semibold leading-tight text-[rgb(var(--color-text-rgb)/0.98)] print:text-black">
              {address}
            </div>
            <div className="mt-2 text-[12px] text-[rgb(var(--color-text-rgb)/0.62)] print:text-[#4b5563]">
              Reference ID:{" "}
              <span className="font-medium text-[rgb(var(--color-text-rgb)/0.92)] print:text-black">
                {job.id}
              </span>
            </div>
            <div className="mt-1 text-[12px] text-[rgb(var(--color-text-rgb)/0.62)] print:text-[#4b5563]">
              Status:{" "}
              <span className="font-medium text-[rgb(var(--color-text-rgb)/0.92)] print:text-black">
                {job.status || "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Financials */}
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className={UI.statPanel}>
            <div className={UI.sectionLabel}>Earnings</div>
            <div className="text-lg font-semibold text-[rgb(var(--color-text-rgb)/0.96)] print:text-black">
              {fmtCents(totals.earnings)}
            </div>
          </div>

          <div className={UI.statPanel}>
            <div className={UI.sectionLabel}>Expenses</div>
            <div className="text-lg font-semibold text-[rgb(var(--color-text-rgb)/0.96)] print:text-black">
              {fmtCents(totals.expenses)}
            </div>
          </div>

          <div className={UI.statPanel}>
            <div className={UI.sectionLabel}>Profit</div>
            <div className="text-lg font-semibold text-[rgb(var(--color-text-rgb)/0.96)] print:text-black">
              {fmtCents(totals.net)}
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="mt-5">
          <div className={UI.panel}>
            <div className="flex items-center gap-2">
              <BadgeDollarSign className="h-4 w-4 text-[rgb(var(--color-text-rgb)/0.58)]" />
              <div className={UI.sectionTitle}>Pricing Snapshot</div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className={UI.softPanel}>
                <div className={UI.sectionLabel}>Sq ft</div>
                <div className="text-sm font-medium text-[rgb(var(--color-text-rgb)/0.94)] print:text-black">
                  {job.pricing?.sqft?.toLocaleString() ?? "—"}
                </div>
              </div>

              <div className={UI.softPanel}>
                <div className={UI.sectionLabel}>Rate / sq</div>
                <div className="text-sm font-medium text-[rgb(var(--color-text-rgb)/0.94)] print:text-black">
                  {typeof job.pricing?.ratePerSqFt === "number"
                    ? `$${job.pricing.ratePerSqFt}`
                    : "—"}
                </div>
              </div>

              <div className={UI.softPanel}>
                <div className={UI.sectionLabel}>Fee</div>
                <div className="text-sm font-medium text-[rgb(var(--color-text-rgb)/0.94)] print:text-black">
                  {typeof job.pricing?.feeCents === "number"
                    ? fmtCents(job.pricing.feeCents)
                    : "—"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Payouts + Materials */}
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className={UI.panel}>
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-[rgb(var(--color-text-rgb)/0.58)]" />
              <div className={UI.sectionTitle}>Payout Summary</div>
            </div>

            <div className="mt-3 text-xs text-[rgb(var(--color-text-rgb)/0.56)]">
              {payouts.length} payout{payouts.length === 1 ? "" : "s"}
            </div>

            <div className="mt-3 space-y-2">
              {payouts.length ? (
                payouts.slice(0, 8).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 border border-[rgb(var(--color-border-rgb)/0.22)] bg-[rgb(var(--color-background-rgb)/0.18)] px-3 py-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[rgb(var(--color-text-rgb)/0.94)] print:text-black">
                        {p.payeeNickname || "Unnamed payee"}
                      </div>
                      <div className="mt-1 text-xs text-[rgb(var(--color-text-rgb)/0.56)]">
                        {p.category || "—"}
                        {typeof p.sqft === "number" &&
                        typeof p.ratePerSqFt === "number"
                          ? ` • ${p.sqft} sq @ $${p.ratePerSqFt}/sq`
                          : ""}
                      </div>
                    </div>

                    <div className="text-sm font-semibold text-[rgb(var(--color-text-rgb)/0.94)] print:text-black">
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
              <FileText className="h-4 w-4 text-[rgb(var(--color-text-rgb)/0.58)]" />
              <div className={UI.sectionTitle}>Materials Summary</div>
            </div>

            <div className="mt-3 text-xs text-[rgb(var(--color-text-rgb)/0.56)]">
              {materials.length} material item
              {materials.length === 1 ? "" : "s"}
            </div>

            <div className="mt-3 space-y-2">
              {materials.length ? (
                materials.slice(0, 8).map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-3 border border-[rgb(var(--color-border-rgb)/0.22)] bg-[rgb(var(--color-background-rgb)/0.18)] px-3 py-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium capitalize text-[rgb(var(--color-text-rgb)/0.94)] print:text-black">
                        {m.category}
                      </div>
                      <div className="mt-1 text-xs text-[rgb(var(--color-text-rgb)/0.56)]">
                        {m.quantity} × {fmtCents(m.unitPriceCents)}
                        {m.vendor ? ` • ${m.vendor}` : ""}
                      </div>
                    </div>

                    <div className="text-sm font-semibold text-[rgb(var(--color-text-rgb)/0.94)] print:text-black">
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

        {/* Notes */}
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className={UI.panel}>
            <div className={UI.sectionTitle}>Summary Notes</div>
            <div className="mt-2 text-sm leading-6 text-[rgb(var(--color-text-rgb)/0.86)] whitespace-pre-wrap print:text-black">
              {summaryNotes || "No summary notes."}
            </div>
          </div>

          <div className={UI.panel}>
            <div className={UI.sectionTitle}>Latest Notes</div>
            <div className="mt-3 space-y-2">
              {notes.length ? (
                notes.slice(0, 6).map((n) => (
                  <div
                    key={n.id}
                    className="border border-[rgb(var(--color-border-rgb)/0.22)] bg-[rgb(var(--color-background-rgb)/0.18)] px-3 py-3"
                  >
                    <div className="text-xs text-[rgb(var(--color-text-rgb)/0.56)]">
                      {fmtMaybeDate(n.createdAt)}
                    </div>
                    <div className="mt-1 text-sm leading-6 text-[rgb(var(--color-text-rgb)/0.9)] whitespace-pre-wrap print:text-black">
                      {n.text}
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-2 text-sm text-[rgb(var(--color-text-rgb)/0.56)]">
                  <AlertCircle className="h-4 w-4" />
                  No notes added yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Warranty snapshot */}
        <div className="mt-5">
          <div className={UI.panel}>
            <div className={UI.sectionTitle}>Warranty Snapshot</div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className={UI.softPanel}>
                <div className={UI.sectionLabel}>Type</div>
                <div className="text-sm font-medium text-[rgb(var(--color-text-rgb)/0.94)] print:text-black">
                  {warranty?.kind || "—"}
                </div>
              </div>

              <div className={UI.softPanel}>
                <div className={UI.sectionLabel}>Status</div>
                <div className="text-sm font-medium text-[rgb(var(--color-text-rgb)/0.94)] print:text-black">
                  {warranty?.status || "—"}
                </div>
              </div>

              <div className={UI.softPanel}>
                <div className={UI.sectionLabel}>Manufacturer</div>
                <div className="text-sm font-medium text-[rgb(var(--color-text-rgb)/0.94)] print:text-black">
                  {warranty?.manufacturer || "—"}
                </div>
              </div>

              <div className={UI.softPanel}>
                <div className={UI.sectionLabel}>Program</div>
                <div className="text-sm font-medium text-[rgb(var(--color-text-rgb)/0.94)] print:text-black">
                  {warranty?.programName || "—"}
                </div>
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

            <div className="mt-3 text-xs text-[rgb(var(--color-text-rgb)/0.56)]">
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
                      className="border border-[rgb(var(--color-border-rgb)/0.22)] bg-[rgb(var(--color-background-rgb)/0.18)] p-2"
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

                      <div className="mt-2 text-xs text-[rgb(var(--color-text-rgb)/0.72)] print:text-black">
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
    <div className="job-report-print fixed inset-0 z-[145] overflow-y-auto bg-black/55 p-3 pt-[calc(72px+12px)] sm:p-4 sm:pt-[calc(72px+16px)] print:bg-transparent print:p-0">
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
                <div className={UI.title}>
                  {orgBranding?.legalName || orgBranding?.name
                    ? `${
                        orgBranding.legalName || orgBranding.name
                      } • Job report`
                    : "Job report"}
                </div>
                <div className={UI.address}>{address}</div>
                <div className={UI.subtitle}>
                  Internal job summary with financials, activity context, and
                  warranty snapshot.
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
          <div className="min-h-0 flex-1 overflow-y-auto">
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
