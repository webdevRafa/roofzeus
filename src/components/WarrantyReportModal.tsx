import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Printer,
  ShieldCheck,
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

type ReportMode = "internal" | "external";

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

const UI = {
  modal:
    "relative flex w-full max-w-4xl min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-xl max-h-[min(92vh,900px)] print:max-h-none print:overflow-visible print:max-w-none print:rounded-none print:shadow-none print:border-0",
  topBar:
    "flex flex-col gap-3 border-b border-[var(--color-border)] px-4 py-3 print:hidden sm:flex-row sm:items-center sm:justify-between",
  iconBadge:
    "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[rgb(var(--pill-success-rgb)/0.28)] bg-[rgb(var(--pill-success-rgb)/0.12)] text-[rgb(var(--pill-success-rgb))]",
  muted: "text-[var(--color-muted)]",
  title: "text-sm font-semibold text-[var(--color-text)]",
  subtitle: "text-xs text-[var(--color-muted)]",
  sectionTitle: "text-sm font-semibold text-[var(--color-text)]",
  panel:
    "rounded-xl border border-[var(--color-border)] bg-[var(--color-card-hover)] p-3",
  panelLg:
    "rounded-xl border border-[var(--color-border)] bg-[var(--color-card-hover)] p-4",
  softBox:
    "rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2",
  actionBtn:
    "inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card-hover)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface)] transition",
  primaryBtn:
    "inline-flex items-center gap-2 rounded-lg bg-[var(--btn-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--btn-text)] hover:bg-[var(--btn-hover-bg)] transition",
  iconBtn:
    "rounded-md p-2 text-[var(--color-muted)] hover:bg-[var(--color-card-hover)] hover:text-[var(--color-text)] transition",
  toggleWrap:
    "inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-card-hover)] p-1",
  toggleActive:
    "rounded-md bg-[var(--btn-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--btn-text)] transition",
  toggleInactive:
    "rounded-md px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-surface)]",
  pillNeutral:
    "inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-card-hover)] px-2 py-1 text-xs font-semibold text-[var(--color-text)]",
  linkBtn:
    "print:hidden inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1 text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface)] transition",
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
    <div className={UI.panel}>
      <div className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
        {title}
      </div>

      <div className="mt-2 space-y-1 text-sm text-[var(--color-text)]">
        {name ? (
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-[var(--color-muted)]" />
            <span className="break-words">{name}</span>
          </div>
        ) : null}

        {phone ? (
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-[var(--color-muted)]" />
            <span className="break-words">{phone}</span>
          </div>
        ) : null}

        {email ? (
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-[var(--color-muted)]" />
            <span className="break-words">{email}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function WarrantyReportModal({
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
  const [mode, setMode] = useState<ReportMode>("internal");

  const address = job.address?.fullLine || job.id;

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

  if (!open) return null;

  return createPortal(
    <div className="paystub-print fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 print:bg-transparent print:p-0">
      <button
        type="button"
        className="absolute inset-0 print:hidden"
        aria-label="Close"
        onClick={onClose}
      />

      <div className={UI.modal}>
        {/* Top bar */}
        <div className={UI.topBar}>
          <div className="flex items-center gap-2">
            <span className={UI.iconBadge}>
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <div className={UI.title}>Warranty / 3rd party packet</div>
              <div className={UI.subtitle}>
                Choose internal or external, then print / save PDF
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className={UI.toggleWrap}>
              <button
                type="button"
                onClick={() => setMode("internal")}
                className={
                  mode === "internal" ? UI.toggleActive : UI.toggleInactive
                }
                title="Internal packet (includes financials)"
              >
                Internal
              </button>
              <button
                type="button"
                onClick={() => setMode("external")}
                className={
                  mode === "external" ? UI.toggleActive : UI.toggleInactive
                }
                title="External packet (no financials)"
              >
                External
              </button>
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className={UI.primaryBtn}
            >
              <Printer className="h-4 w-4" />
              Print / Save PDF
            </button>

            <button
              type="button"
              onClick={onClose}
              className={UI.iconBtn}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-y-auto  p-5 print:overflow-visible print:max-h-none print:p-6">
          {/* Title */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
                Job
              </div>
              <div className="mt-1 text-xl font-semibold text-[var(--color-text)]">
                {address}
              </div>
              <div className="mt-1 text-xs text-[var(--color-muted)]">
                Job ID:{" "}
                <span className="font-medium text-[var(--color-text)]">
                  {job.id}
                </span>
              </div>
              <div className="mt-1 text-xs text-[var(--color-muted)]">
                Packet type:{" "}
                <span className="font-semibold text-[var(--color-text)]">
                  {mode === "internal"
                    ? "Internal (financials included)"
                    : "External (no financials)"}
                </span>
              </div>
            </div>

            <div className="text-right text-xs text-[var(--color-muted)]">
              <div>
                Created:{" "}
                <span className="text-[var(--color-text)]">{createdLabel}</span>
              </div>
              <div>
                Updated:{" "}
                <span className="text-[var(--color-text)]">{updatedLabel}</span>
              </div>
              <div className="mt-1">
                Status:{" "}
                <span className="font-medium text-[var(--color-text)]">
                  {job.status || "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="my-5 h-px w-full bg-[var(--color-border)]" />

          {mode === "internal" ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className={UI.panel}>
                  <div className="text-xs text-[var(--color-muted)]">
                    Earnings
                  </div>
                  <div className="mt-1 text-lg font-semibold text-[var(--color-text)]">
                    {fmtCents(totals.earnings)}
                  </div>
                </div>

                <div className={UI.panel}>
                  <div className="text-xs text-[var(--color-muted)]">
                    Expenses
                  </div>
                  <div className="mt-1 text-lg font-semibold text-[var(--color-text)]">
                    {fmtCents(totals.expenses)}
                  </div>
                </div>

                <div className={UI.panel}>
                  <div className="text-xs text-[var(--color-muted)]">
                    Profit
                  </div>
                  <div className="mt-1 text-lg font-semibold text-[var(--color-text)]">
                    {fmtCents(totals.net)}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <div className={UI.panelLg}>
                  <div className="flex items-center justify-between gap-3">
                    <div className={UI.sectionTitle}>Warranty snapshot</div>
                    {warranty?.status ? (
                      <span
                        className={
                          "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold " +
                          pillForWarrantyStatus(warranty.status)
                        }
                      >
                        <BadgeCheck className="h-3.5 w-3.5" />
                        {warranty.status}
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--color-muted)]">
                        {hasWarrantyData ? "—" : "No warranty data"}
                      </span>
                    )}
                  </div>

                  {hasWarrantyData ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="text-sm text-[var(--color-text)]">
                        <div className="text-xs text-[var(--color-muted)]">
                          Type
                        </div>
                        <div className="mt-0.5 font-medium">
                          {labelForWarrantyKind(warranty?.kind)}
                        </div>
                      </div>

                      <div className="text-sm text-[var(--color-text)]">
                        <div className="text-xs text-[var(--color-muted)]">
                          Manufacturer / Program
                        </div>
                        <div className="mt-0.5 font-medium break-words">
                          {[warranty?.manufacturer, warranty?.programName]
                            .filter(Boolean)
                            .join(" — ") || "—"}
                        </div>
                      </div>

                      <div className="text-sm text-[var(--color-text)]">
                        <div className="text-xs text-[var(--color-muted)]">
                          Install date
                        </div>
                        <div className="mt-0.5 font-medium">
                          {fmtMaybeShortDate(warranty?.installDate)}
                        </div>
                      </div>

                      <div className="text-sm text-[var(--color-text)]">
                        <div className="text-xs text-[var(--color-muted)]">
                          Expires
                        </div>
                        <div className="mt-0.5 font-medium">
                          {fmtMaybeShortDate(warranty?.expiresAt)}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 flex items-center gap-2 text-sm text-[var(--color-muted)]">
                      <AlertCircle className="h-4 w-4" />
                      No warranty metadata saved yet.
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className={UI.panelLg}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className={UI.sectionTitle}>
                    Warranty / 3rd-party details
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {warranty?.status ? (
                      <span
                        className={
                          "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold " +
                          pillForWarrantyStatus(warranty.status)
                        }
                      >
                        <BadgeCheck className="h-3.5 w-3.5" />
                        {warranty.status}
                      </span>
                    ) : null}

                    {warranty?.kind ? (
                      <span className={UI.pillNeutral}>
                        {labelForWarrantyKind(warranty.kind)}
                      </span>
                    ) : null}
                  </div>
                </div>

                {hasWarrantyData ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className={UI.panel}>
                      <div className="text-xs text-[var(--color-muted)]">
                        Manufacturer / Program
                      </div>
                      <div className="mt-1 text-sm font-semibold text-[var(--color-text)] break-words">
                        {[warranty?.manufacturer, warranty?.programName]
                          .filter(Boolean)
                          .join(" — ") || "—"}
                      </div>
                      {typeof warranty?.coverageYears === "number" ? (
                        <div className="mt-1 text-xs text-[var(--color-muted)]">
                          Coverage:{" "}
                          <span className="font-medium text-[var(--color-text)]">
                            {warranty.coverageYears} yrs
                          </span>
                        </div>
                      ) : null}
                    </div>

                    <div className={UI.panel}>
                      <div className="text-xs text-[var(--color-muted)]">
                        Dates
                      </div>
                      <div className="mt-1 space-y-1 text-sm text-[var(--color-text)]">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[var(--color-muted)]">
                            Install
                          </span>
                          <span className="font-medium">
                            {fmtMaybeShortDate(warranty?.installDate)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[var(--color-muted)]">
                            Repair
                          </span>
                          <span className="font-medium">
                            {fmtMaybeShortDate(warranty?.repairDate)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[var(--color-muted)]">
                            Expires
                          </span>
                          <span className="font-medium">
                            {fmtMaybeShortDate(warranty?.expiresAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className={UI.panel}>
                      <div className="text-xs text-[var(--color-muted)]">
                        Registration
                      </div>
                      <div className="mt-1 space-y-1 text-sm text-[var(--color-text)]">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[var(--color-muted)]">
                            Submitted
                          </span>
                          <span className="font-medium">
                            {fmtMaybeShortDate((warranty as any)?.submittedAt)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[var(--color-muted)]">
                            Registered
                          </span>
                          <span className="font-medium">
                            {fmtMaybeShortDate((warranty as any)?.registeredAt)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[var(--color-muted)]">ID</span>
                          <span className="font-medium break-words">
                            {warranty?.registrationId || "—"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className={UI.panel}>
                      <div className="text-xs text-[var(--color-muted)]">
                        Claim
                      </div>
                      <div className="mt-1 space-y-1 text-sm text-[var(--color-text)]">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[var(--color-muted)]">
                            Claim ID
                          </span>
                          <span className="font-medium break-words">
                            {warranty?.claimId || "—"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[var(--color-muted)]">
                            Claim #
                          </span>
                          <span className="font-medium break-words">
                            {warranty?.claimNumber || "—"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[var(--color-muted)]">
                            Status
                          </span>
                          <span className="font-medium">
                            {warranty?.claimStatus || "—"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[var(--color-muted)]">
                            Opened
                          </span>
                          <span className="font-medium">
                            {fmtMaybeShortDate(
                              (warranty as any)?.claimOpenedAt
                            )}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[var(--color-muted)]">
                            Closed
                          </span>
                          <span className="font-medium">
                            {fmtMaybeShortDate(
                              (warranty as any)?.claimClosedAt
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className={`${UI.panel} sm:col-span-2`}>
                      <div className="text-xs text-[var(--color-muted)]">
                        Portal / submission link
                      </div>

                      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-medium text-[var(--color-text)] break-words">
                          {warranty?.portalUrl || "—"}
                        </div>

                        {warranty?.portalUrl &&
                        isValidHttpUrl(warranty.portalUrl) ? (
                          <a
                            href={warranty.portalUrl}
                            target="_blank"
                            rel="noreferrer"
                            className={UI.linkBtn}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Open
                          </a>
                        ) : null}
                      </div>

                      {(warranty as any)?.submittedBy?.name ? (
                        <div className="mt-1 text-xs text-[var(--color-muted)]">
                          Submitted by:{" "}
                          <span className="font-medium text-[var(--color-text)]">
                            {(warranty as any).submittedBy.name}
                          </span>
                        </div>
                      ) : null}
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
                      <div className={`${UI.panel} sm:col-span-2`}>
                        <div className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
                          Insurance
                        </div>

                        <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                          <div>
                            <div className="text-xs text-[var(--color-muted)]">
                              Carrier
                            </div>
                            <div className="font-medium text-[var(--color-text)] break-words">
                              {warranty?.insuranceCarrier || "—"}
                            </div>
                          </div>

                          <div>
                            <div className="text-xs text-[var(--color-muted)]">
                              Policy #
                            </div>
                            <div className="font-medium text-[var(--color-text)] break-words">
                              {warranty?.policyNumber || "—"}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {warranty?.attachments &&
                    warranty.attachments.length > 0 ? (
                      <div className={`${UI.panel} sm:col-span-2`}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
                            Attachments
                          </div>
                          <div className="text-xs text-[var(--color-muted)]">
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
                                className="flex items-start justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2"
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-[var(--color-muted)]" />
                                    <div className="text-sm font-semibold text-[var(--color-text)] break-words">
                                      {label}
                                    </div>
                                  </div>

                                  <div className="mt-1 text-xs text-[var(--color-muted)] break-words">
                                    {a.kind
                                      ? kindLabelForAttachmentKind(a.kind)
                                      : "Attachment"}
                                    {a.createdAt
                                      ? ` • ${fmtMaybeDate(a.createdAt)}`
                                      : ""}
                                  </div>

                                  <div className="mt-1 text-xs text-[var(--color-muted)] break-words">
                                    {a.url}
                                  </div>
                                </div>

                                {isValidHttpUrl(a.url) ? (
                                  <a
                                    href={a.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={UI.linkBtn}
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
                  <div className="mt-2 flex items-center gap-2 text-sm text-[var(--color-muted)]">
                    <AlertCircle className="h-4 w-4" />
                    No warranty metadata saved yet.
                  </div>
                )}
              </div>
            </>
          )}

          {/* Notes */}
          {mode === "internal" ? (
            <div className="mt-6">
              <div className={UI.sectionTitle}>Notes</div>
              <div className="mt-2 space-y-2">
                {(job.notes ?? []).length === 0 ? (
                  <div className="text-sm text-[var(--color-muted)]">
                    No notes.
                  </div>
                ) : (
                  (job.notes ?? []).map((n) => (
                    <div key={n.id} className={UI.panel}>
                      <div className="whitespace-pre-wrap break-words text-sm text-[var(--color-text)]">
                        {n.text || ""}
                      </div>
                      {n.createdAt ? (
                        <div className="mt-1 text-xs text-[var(--color-muted)]">
                          {fmtMaybeDate(n.createdAt)}
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="mt-6">
              <div className={UI.sectionTitle}>Warranty notes</div>
              <div className="mt-2">
                {warranty?.notes ? (
                  <div className={UI.panel}>
                    <div className="whitespace-pre-wrap break-words text-sm text-[var(--color-text)]">
                      {warranty.notes}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-[var(--color-muted)]">
                    No warranty notes.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Photos */}
          <div className="mt-6">
            <div className={UI.sectionTitle}>Photos</div>

            {photos.length === 0 ? (
              <div className="mt-2 text-sm text-[var(--color-muted)]">
                No photos.
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-3 print:grid-cols-3 sm:grid-cols-3">
                {photos.slice(0, 12).map((p) => {
                  const src = safePhotoUrl(p);
                  if (!src) return null;
                  return (
                    <div
                      key={p.id}
                      className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card-hover)]"
                    >
                      <img
                        src={src}
                        alt={p.caption || "Job photo"}
                        className="h-36 w-full object-cover print:h-32"
                      />
                      <div className="px-2 py-2 text-xs text-[var(--color-text)]">
                        {p.caption || "—"}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {photos.length > 12 ? (
              <div className="mt-2 text-xs text-[var(--color-muted)]">
                Showing 12 of {photos.length} photos.
              </div>
            ) : null}
          </div>

          <div className="mt-8 text-xs text-[var(--color-muted)]">
            {mode === "internal"
              ? "Internal packet (includes financial snapshot) for tracking warranty / third-party impact."
              : "External packet (no financials) for manufacturer / builder / insurance documentation."}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
