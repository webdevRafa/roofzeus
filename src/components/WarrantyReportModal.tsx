import { Fragment, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Printer,
  X,
  ExternalLink,
  FileText,
  User,
  Phone,
  Mail,
  BadgeCheck,
  AlertCircle,
} from "lucide-react";
import type { Job, WarrantyMeta, WarrantyAttachment } from "../types/types";

type JobPhoto = {
  id: string;
  jobId: string;
  createdAt?: any;
  fullUrl?: string;
  thumbUrl?: string;
  url?: string;
  caption?: string;
};

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

function safePhotoUrl(p: JobPhoto) {
  return p.thumbUrl || p.fullUrl || p.url || "";
}

function isValidHttpUrl(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
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

  btnPrimary:
    "inline-flex items-center justify-center gap-2 border border-[rgb(var(--color-primary-rgb)/0.42)] bg-[rgb(var(--color-primary-rgb)/0.14)] px-3 py-2 text-xs font-semibold tracking-wide text-[rgb(var(--color-text-rgb)/0.96)] transition " +
    "hover:bg-[rgb(var(--color-primary-rgb)/0.22)] hover:border-[rgb(var(--color-primary-rgb)/0.56)] " +
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",

  iconBtn:
    "border border-transparent p-2 text-[rgb(var(--color-text-rgb)/0.58)] transition hover:border-[rgb(var(--color-border-rgb)/0.3)] hover:bg-[rgb(var(--color-background-rgb)/0.24)] hover:text-[rgb(var(--color-text-rgb)/0.9)]",

  statusPillBase:
    "inline-flex items-center gap-1 border px-2 py-1 text-xs font-semibold",

  linkBtn:
    "inline-flex items-center gap-1 border border-[rgb(var(--color-border-rgb)/0.22)] bg-[rgb(var(--color-background-rgb)/0.18)] px-2 py-1 text-xs font-semibold text-[rgb(var(--color-text-rgb)/0.88)] transition hover:bg-[rgb(var(--color-background-rgb)/0.28)]",
};

function pillForWarrantyStatus(status?: WarrantyMeta["status"]) {
  switch (status) {
    case "registered":
    case "active":
      return "border-[rgb(var(--pill-success-rgb)/0.28)] bg-[rgb(var(--pill-success-rgb)/0.12)] text-[rgb(var(--pill-success-rgb))]";
    case "submitted":
    case "claimOpened":
      return "border-[rgb(var(--pill-warning-rgb)/0.28)] bg-[rgb(var(--pill-warning-rgb)/0.12)] text-[rgb(var(--pill-warning-rgb))]";
    case "expired":
    case "closed":
      return "border-[rgb(var(--color-border-rgb)/0.22)] bg-[rgb(var(--color-surface-rgb)/0.55)] text-[rgb(var(--color-text-rgb)/0.68)]";
    case "draft":
    case "notStarted":
    default:
      return "border-[rgb(var(--color-border-rgb)/0.22)] bg-[rgb(var(--color-surface-rgb)/0.55)] text-[rgb(var(--color-text-rgb)/0.68)]";
  }
}

function labelForWarrantyKind(kind?: WarrantyMeta["kind"]) {
  switch (kind) {
    case "manufacturer":
      return "Manufacturer";
    case "workmanship":
      return "Workmanship";
    case "thirdParty":
      return "3rd Party";
    case "insurance":
      return "Insurance";
    case "none":
      return "None";
    default:
      return "—";
  }
}

function kindLabelForAttachmentKind(kind?: WarrantyAttachment["kind"]) {
  switch (kind) {
    case "invoice":
      return "Invoice";
    case "receipt":
      return "Receipt";
    case "warrantyCertificate":
      return "Warranty certificate";
    case "registrationConfirmation":
      return "Registration confirmation";
    case "claimDocument":
      return "Claim document";
    case "beforePhoto":
      return "Before photo";
    case "afterPhoto":
      return "After photo";
    case "other":
    default:
      return "Attachment";
  }
}

function ContactBlock({
  title,
  name,
  phone,
  email,
}: {
  title: string;
  name?: string;
  phone?: string;
  email?: string;
}) {
  const hasAny = Boolean(name || phone || email);
  if (!hasAny) return null;

  return (
    <div className={UI.softPanel}>
      <div className={UI.sectionLabel}>{title}</div>

      <div className="space-y-2 text-sm text-[rgb(var(--color-text-rgb)/0.94)]">
        {name ? (
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-[rgb(var(--color-text-rgb)/0.52)]" />
            <span className="break-words">{name}</span>
          </div>
        ) : null}

        {phone ? (
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-[rgb(var(--color-text-rgb)/0.52)]" />
            <span className="break-words">{phone}</span>
          </div>
        ) : null}

        {email ? (
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-[rgb(var(--color-text-rgb)/0.52)]" />
            <span className="break-words">{email}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function WarrantyReportDocument({
  job,
  address,
  createdLabel,
  updatedLabel,
  warranty,
  hasWarrantyData,
  packetPhotos,
}: {
  job: Job;
  address: string;
  createdLabel: string;
  updatedLabel: string;
  warranty: Job["warranty"];
  hasWarrantyData: boolean;
  packetPhotos: JobPhoto[];
}) {
  return (
    <div className="bg-[var(--color-card)] print:bg-white">
      <div className="p-5 print:p-6">
        <div className={UI.panel}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className={UI.sectionLabel}>Job</div>
              <div className="text-lg font-semibold text-[rgb(var(--color-text-rgb)/0.96)] print:text-black">
                {address}
              </div>
              <div className="mt-2 space-y-1 text-xs text-[rgb(var(--color-text-rgb)/0.56)] print:text-gray-700">
                <div>
                  Job ID:{" "}
                  <span className="font-medium text-[rgb(var(--color-text-rgb)/0.9)] print:text-black">
                    {job.id}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-xs text-[rgb(var(--color-text-rgb)/0.56)] print:text-gray-700 sm:text-right">
              <div>
                Created:{" "}
                <span className="text-[rgb(var(--color-text-rgb)/0.9)] print:text-black">
                  {createdLabel}
                </span>
              </div>
              <div className="mt-1">
                Updated:{" "}
                <span className="text-[rgb(var(--color-text-rgb)/0.9)] print:text-black">
                  {updatedLabel}
                </span>
              </div>
              <div className="mt-1">
                Status:{" "}
                <span className="font-medium text-[rgb(var(--color-text-rgb)/0.9)] print:text-black">
                  {job.status || "—"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <div className={UI.panel}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className={UI.sectionTitle}>
                  Warranty / 3rd-party details
                </div>
                <div className={UI.muted}>
                  Printable packet without internal financials.
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {warranty?.status ? (
                  <span
                    className={`${UI.statusPillBase} ${pillForWarrantyStatus(
                      warranty.status
                    )}`}
                  >
                    <BadgeCheck className="h-3.5 w-3.5" />
                    {warranty.status}
                  </span>
                ) : null}
              </div>
            </div>

            {hasWarrantyData ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className={UI.softPanel}>
                  <div className={UI.sectionLabel}>Type</div>
                  <div className="text-sm font-semibold text-[rgb(var(--color-text-rgb)/0.94)] print:text-black">
                    {labelForWarrantyKind(warranty?.kind)}
                  </div>
                </div>

                <div className={UI.softPanel}>
                  <div className={UI.sectionLabel}>Manufacturer / Program</div>
                  <div className="text-sm font-semibold text-[rgb(var(--color-text-rgb)/0.94)] break-words print:text-black">
                    {[warranty?.manufacturer, warranty?.programName]
                      .filter(Boolean)
                      .join(" — ") || "—"}
                  </div>
                  {typeof warranty?.coverageYears === "number" ? (
                    <div className="mt-2 text-xs text-[rgb(var(--color-text-rgb)/0.56)]">
                      Coverage:{" "}
                      <span className="font-medium text-[rgb(var(--color-text-rgb)/0.9)] print:text-black">
                        {warranty.coverageYears} yrs
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className={UI.softPanel}>
                  <div className={UI.sectionLabel}>Dates</div>
                  <div className="space-y-2 text-sm text-[rgb(var(--color-text-rgb)/0.94)] print:text-black">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[rgb(var(--color-text-rgb)/0.56)]">
                        Install
                      </span>
                      <span className="font-medium">
                        {fmtMaybeShortDate(warranty?.installDate)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[rgb(var(--color-text-rgb)/0.56)]">
                        Repair
                      </span>
                      <span className="font-medium">
                        {fmtMaybeShortDate(warranty?.repairDate)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[rgb(var(--color-text-rgb)/0.56)]">
                        Expires
                      </span>
                      <span className="font-medium">
                        {fmtMaybeShortDate(warranty?.expiresAt)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className={UI.softPanel}>
                  <div className={UI.sectionLabel}>Registration</div>
                  <div className="space-y-2 text-sm text-[rgb(var(--color-text-rgb)/0.94)] print:text-black">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[rgb(var(--color-text-rgb)/0.56)]">
                        Submitted
                      </span>
                      <span className="font-medium">
                        {fmtMaybeShortDate((warranty as any)?.submittedAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[rgb(var(--color-text-rgb)/0.56)]">
                        Registered
                      </span>
                      <span className="font-medium">
                        {fmtMaybeShortDate((warranty as any)?.registeredAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[rgb(var(--color-text-rgb)/0.56)]">
                        ID
                      </span>
                      <span className="font-medium break-words">
                        {warranty?.registrationId || "—"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className={UI.softPanel}>
                  <div className={UI.sectionLabel}>Claim</div>
                  <div className="space-y-2 text-sm text-[rgb(var(--color-text-rgb)/0.94)] print:text-black">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[rgb(var(--color-text-rgb)/0.56)]">
                        Claim ID
                      </span>
                      <span className="font-medium break-words">
                        {warranty?.claimId || "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[rgb(var(--color-text-rgb)/0.56)]">
                        Claim #
                      </span>
                      <span className="font-medium break-words">
                        {warranty?.claimNumber || "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[rgb(var(--color-text-rgb)/0.56)]">
                        Status
                      </span>
                      <span className="font-medium">
                        {warranty?.claimStatus || "—"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className={`${UI.softPanel} sm:col-span-2`}>
                  <div className={UI.sectionLabel}>
                    Portal / submission link
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-medium text-[rgb(var(--color-text-rgb)/0.94)] break-words print:text-black">
                      {warranty?.portalUrl || "—"}
                    </div>

                    {warranty?.portalUrl &&
                    isValidHttpUrl(warranty.portalUrl) ? (
                      <a
                        href={warranty.portalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={`${UI.linkBtn} print:hidden`}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open
                      </a>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-3 sm:col-span-2 sm:grid-cols-3">
                  <ContactBlock
                    title="Homeowner"
                    name={warranty?.homeowner?.name}
                    phone={warranty?.homeowner?.phone}
                    email={warranty?.homeowner?.email}
                  />
                  <ContactBlock
                    title="Adjuster"
                    name={warranty?.adjuster?.name}
                    phone={warranty?.adjuster?.phone}
                    email={warranty?.adjuster?.email}
                  />
                  <ContactBlock
                    title="3rd party admin"
                    name={warranty?.thirdPartyAdmin?.name}
                    phone={warranty?.thirdPartyAdmin?.phone}
                    email={warranty?.thirdPartyAdmin?.email}
                  />
                </div>

                {warranty?.insuranceCarrier || warranty?.policyNumber ? (
                  <div className={`${UI.softPanel} sm:col-span-2`}>
                    <div className={UI.sectionLabel}>Insurance</div>

                    <div className="grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgb(var(--color-text-rgb)/0.58)]">
                          Carrier
                        </div>
                        <div className="mt-1 font-medium text-[rgb(var(--color-text-rgb)/0.94)] break-words print:text-black">
                          {warranty?.insuranceCarrier || "—"}
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgb(var(--color-text-rgb)/0.58)]">
                          Policy #
                        </div>
                        <div className="mt-1 font-medium text-[rgb(var(--color-text-rgb)/0.94)] break-words print:text-black">
                          {warranty?.policyNumber || "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {warranty?.notes ? (
                  <div className={`${UI.softPanel} sm:col-span-2`}>
                    <div className={UI.sectionLabel}>Warranty notes</div>
                    <div className="text-sm leading-6 text-[rgb(var(--color-text-rgb)/0.9)] whitespace-pre-wrap print:text-black">
                      {warranty.notes}
                    </div>
                  </div>
                ) : null}

                {warranty?.attachments && warranty.attachments.length > 0 ? (
                  <div className={`${UI.softPanel} sm:col-span-2`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className={UI.sectionLabel}>Attachments</div>
                      <div className="text-xs text-[rgb(var(--color-text-rgb)/0.56)]">
                        {warranty.attachments.length} file(s)
                      </div>
                    </div>

                    <div className="mt-2 space-y-2">
                      {warranty.attachments.map((a) => {
                        const label =
                          a.label ||
                          kindLabelForAttachmentKind(a.kind) ||
                          "Attachment";

                        return (
                          <div
                            key={a.id}
                            className="flex items-start justify-between gap-3 border border-[rgb(var(--color-border-rgb)/0.22)] bg-[rgb(var(--color-background-rgb)/0.18)] px-3 py-3"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-[rgb(var(--color-text-rgb)/0.52)]" />
                                <div className="text-sm font-semibold text-[rgb(var(--color-text-rgb)/0.94)] break-words print:text-black">
                                  {label}
                                </div>
                              </div>

                              <div className="mt-1 text-xs text-[rgb(var(--color-text-rgb)/0.56)] break-words">
                                {a.kind
                                  ? kindLabelForAttachmentKind(a.kind)
                                  : "Attachment"}
                                {a.createdAt
                                  ? ` • ${fmtMaybeDate(a.createdAt)}`
                                  : ""}
                              </div>

                              <div className="mt-1 text-xs text-[rgb(var(--color-text-rgb)/0.56)] break-words">
                                {a.url}
                              </div>
                            </div>

                            {isValidHttpUrl(a.url) ? (
                              <a
                                href={a.url}
                                target="_blank"
                                rel="noreferrer"
                                className={`${UI.linkBtn} print:hidden`}
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                Open
                              </a>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-2 text-sm text-[rgb(var(--color-text-rgb)/0.56)]">
                <AlertCircle className="h-4 w-4" />
                No warranty metadata saved yet.
              </div>
            )}
          </div>
        </div>

        <div className="mt-5">
          <div className={UI.panel}>
            <div className={UI.sectionTitle}>Supporting photos</div>

            {packetPhotos.length ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {packetPhotos.map((p) => {
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

export default function WarrantyReportModal({
  open,
  onClose,
  job,
  photos,
}: {
  open: boolean;
  onClose: () => void;
  job: Job;
  photos: JobPhoto[];
  totals: { earnings: number; expenses: number; net: number };
}) {
  const address = formatAddress(job);

  const createdLabel = useMemo(
    () => fmtMaybeDate(job.createdAt),
    [job.createdAt]
  );
  const updatedLabel = useMemo(
    () => fmtMaybeDate(job.updatedAt),
    [job.updatedAt]
  );

  const warranty = job.warranty;

  const hasWarrantyData = useMemo(() => {
    if (!warranty) return false;

    const hasMeaningful =
      (warranty.kind && warranty.kind !== "none") ||
      Boolean(
        warranty.manufacturer ||
          warranty.programName ||
          warranty.coverageYears ||
          warranty.status ||
          warranty.portalUrl ||
          warranty.registrationId ||
          warranty.claimId ||
          warranty.claimNumber ||
          warranty.claimStatus ||
          warranty.insuranceCarrier ||
          warranty.policyNumber ||
          warranty.notes ||
          warranty.installDate ||
          warranty.repairDate ||
          warranty.expiresAt ||
          (warranty.attachments && warranty.attachments.length > 0) ||
          warranty.homeowner?.name ||
          warranty.homeowner?.phone ||
          warranty.homeowner?.email ||
          warranty.adjuster?.name ||
          warranty.adjuster?.phone ||
          warranty.adjuster?.email ||
          warranty.thirdPartyAdmin?.name ||
          warranty.thirdPartyAdmin?.phone ||
          warranty.thirdPartyAdmin?.email
      );

    return Boolean(hasMeaningful);
  }, [warranty]);

  const packetPhotos = useMemo(() => photos.slice(0, 8), [photos]);

  if (!open) return null;

  return createPortal(
    <Fragment>
      {/* Screen modal */}
      <div className="fixed inset-0 z-[140] overflow-y-auto bg-black/55 p-3 pt-[calc(72px+12px)] sm:p-4 sm:pt-[calc(72px+16px)] print:hidden">
        <button
          type="button"
          className="fixed inset-0 z-0"
          aria-label="Close"
          onClick={onClose}
        />

        <div className="relative z-10 flex min-h-full items-start justify-center">
          <div className="relative flex w-full max-w-5xl min-h-0 flex-col overflow-hidden border border-[rgb(var(--color-border-rgb)/0.34)] bg-[var(--color-card)] shadow-[0_30px_80px_rgba(0,0,0,0.55)] max-h-[calc(100dvh-72px-24px)] sm:max-h-[calc(100dvh-72px-32px)]">
            {/* top bar */}
            <div className="border-b border-[rgb(var(--color-border-rgb)/0.26)] bg-[rgb(var(--color-background-rgb)/0.18)] px-4 py-4 sm:px-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className={UI.title}>Warranty packet</div>
                  <div className={UI.address}>{address}</div>
                  <div className={UI.subtitle}>
                    Homeowner-facing warranty and 3rd-party documentation.
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

            {/* screen content */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              <WarrantyReportDocument
                job={job}
                address={address}
                createdLabel={createdLabel}
                updatedLabel={updatedLabel}
                warranty={warranty}
                hasWarrantyData={hasWarrantyData}
                packetPhotos={packetPhotos}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Print document: keep mounted, but off-screen during normal view */}
      <div className="fixed left-[-100000px] top-0 w-[1024px] overflow-visible bg-white text-black print:static print:left-auto print:top-auto print:w-auto print:overflow-visible">
        <WarrantyReportDocument
          job={job}
          address={address}
          createdLabel={createdLabel}
          updatedLabel={updatedLabel}
          warranty={warranty}
          hasWarrantyData={hasWarrantyData}
          packetPhotos={packetPhotos}
        />
      </div>
    </Fragment>,
    document.body
  );
}
