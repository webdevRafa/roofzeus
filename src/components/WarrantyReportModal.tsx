import { Fragment, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Printer,
  X,
  ExternalLink,
  FileText,
  User,
  Phone,
  Mail,
  AlertCircle,
} from "lucide-react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { useOrg } from "../contexts/OrgContext";
import type {
  Job,
  WarrantyMeta,
  WarrantyAttachment,
  Org,
} from "../types/types";

type JobPhoto = {
  id: string;
  jobId: string;
  createdAt?: any;
  fullUrl?: string;
  thumbUrl?: string;
  url?: string;
  caption?: string;
};
type OrgBranding = Pick<Org, "name" | "legalName" | "logoUrl" | "address">;

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

function formatOrgAddress(orgBranding: OrgBranding | null) {
  const addr = orgBranding?.address;
  if (!addr) return "";

  const line1 = (addr.line1 || "").trim();
  const city = (addr.city || "").trim();
  const state = (addr.state || "").trim().toUpperCase();
  const zip = (addr.zip || addr.postalCode || "").trim();

  const locality = [city, state].filter(Boolean).join(", ");
  return [line1, locality, zip].filter(Boolean).join(" ");
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
  hideTitle = false,
}: {
  title: string;
  name?: string;
  phone?: string;
  email?: string;
  hideTitle?: boolean;
}) {
  const hasAny = Boolean(name || phone || email);
  if (!hasAny) return null;

  return (
    <div className="border border-[rgb(var(--color-border-rgb)/0.22)] bg-[rgb(var(--color-background-rgb)/0.10)] px-4 py-4 print:border-0 print:bg-transparent print:px-0 print:py-1">
      {!hideTitle ? <div className={UI.sectionLabel}>{title}</div> : null}

      <div className="space-y-1.5 text-[12px] leading-5 text-[rgb(var(--color-text-rgb)/0.9)] print:text-[#111827]">
        {name ? (
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-[rgb(var(--color-text-rgb)/0.52)] print:text-[#6b7280]" />
            <span className="break-words font-normal">{name}</span>
          </div>
        ) : null}

        {phone ? (
          <div className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 text-[rgb(var(--color-text-rgb)/0.52)] print:text-[#6b7280]" />
            <span className="break-words font-normal">{phone}</span>
          </div>
        ) : null}

        {email ? (
          <div className="flex items-center gap-2">
            <Mail className="h-3.5 w-3.5 text-[rgb(var(--color-text-rgb)/0.52)] print:text-[#6b7280]" />
            <span className="break-words font-normal">{email}</span>
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
  homeowner,
  hasWarrantyData,
  packetPhotos,
  orgBranding,
}: {
  job: Job;
  address: string;
  createdLabel: string;
  updatedLabel: string;
  warranty: Job["warranty"];
  homeowner: {
    name?: string;
    phone?: string;
    email?: string;
  };
  hasWarrantyData: boolean;
  packetPhotos: JobPhoto[];
  orgBranding: OrgBranding | null;
}) {
  const kind = warranty?.kind;
  const orgAddress = formatOrgAddress(orgBranding);

  const fmtMoney = (cents?: number) =>
    typeof cents === "number"
      ? (cents / 100).toLocaleString(undefined, {
          style: "currency",
          currency: "USD",
        })
      : "—";

  function InfoCard({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) {
    return (
      <div className="border border-[rgb(var(--color-border-rgb)/0.22)] bg-[rgb(var(--color-background-rgb)/0.10)] px-4 py-4 print:border-0 print:bg-transparent print:px-0 print:py-2">
        {title ? (
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-[rgb(var(--color-text-rgb)/0.58)] print:text-[#6b7280]">
            {title}
          </div>
        ) : null}
        <div className={title ? "mt-2" : ""}>{children}</div>
      </div>
    );
  }

  function Row({
    label,
    value,
    noBorder = false,
  }: {
    label: string;
    value?: React.ReactNode;
    noBorder?: boolean;
  }) {
    return (
      <div
        className={[
          "grid grid-cols-[108px_minmax(0,1fr)] items-start gap-2.5 py-1.5",
          !noBorder
            ? "border-b border-[rgb(var(--color-border-rgb)/0.10)] print:border-[#edf2f7]"
            : "",
        ].join(" ")}
      >
        <span className="text-[12px] leading-5 text-[rgb(var(--color-text-rgb)/0.62)] print:text-[#4b5563]">
          {label}
        </span>

        <span className="min-w-0 text-left text-[12px] font-normal leading-5 break-words text-[rgb(var(--color-text-rgb)/0.92)] print:text-[#111827] print:font-normal">
          {value || "—"}
        </span>
      </div>
    );
  }

  function SummaryMiniRow({
    label,
    value,
    noBorder = false,
  }: {
    label: string;
    value?: React.ReactNode;
    noBorder?: boolean;
  }) {
    return (
      <div
        className={[
          "grid grid-cols-[82px_minmax(0,1fr)] items-start gap-3 py-1.5",
          !noBorder
            ? "border-b border-[rgb(var(--color-border-rgb)/0.10)] print:border-[#edf2f7]"
            : "",
        ].join(" ")}
      >
        <div className="text-[9.5px] font-medium uppercase tracking-[0.16em] text-[rgb(var(--color-text-rgb)/0.50)] print:text-[#6b7280]">
          {label}
        </div>
        <div className="min-w-0 text-[12px] font-normal leading-5 text-[rgb(var(--color-text-rgb)/0.92)] print:text-[#111827] print:font-normal">
          {value || "—"}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--color-card)] print:bg-white print:text-black">
      <div className="px-5 py-5 print:px-4 print:py-1">
        {/* ===== Print-first document header ===== */}
        <div className="bg-[rgb(var(--color-background-rgb)/0.14)] p-4 print:bg-white print:p-3 mt-0">
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

                  <h1 className="mt-1 text-[12px] font-semibold tracking-[-0.02em] text-[rgb(var(--color-text-rgb)/0.98)] print:text-black">
                    Warranty Packet
                  </h1>

                  {orgAddress ? (
                    <div className="mt-1 max-w-[420px] text-[11px] leading-5 text-[rgb(var(--color-text-rgb)/0.58)] print:text-[#6b7280]">
                      {orgAddress}
                    </div>
                  ) : null}
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
            </div>
          </div>

          <div className="pt-4">
            <div className="text-[14px] font-medium leading-tight text-[rgb(var(--color-text-rgb)/0.98)] print:text-[#111827]">
              {address}
            </div>
            <div className="mt-2 text-[12px] text-[rgb(var(--color-text-rgb)/0.62)] print:text-[#4b5563]">
              Reference ID:{" "}
              <span className="font-normal text-[rgb(var(--color-text-rgb)/0.82)] print:text-[#374151]">
                {job.id}
              </span>
            </div>
          </div>
        </div>

        {/* ===== Main warranty section ===== */}
        <div className="mt-2 border border-[rgb(var(--color-border-rgb)/0.26)] bg-[rgb(var(--color-background-rgb)/0.14)] px-5 py-3 print:border-0 print:bg-white print:px-0 print:py-0">
          <div className="border-b border-[rgb(var(--color-border-rgb)/0.18)] pb-4 print:border-[#e5e7eb]">
            <div className="text-[14px] font-semibold tracking-[-0.01em] text-[rgb(var(--color-text-rgb)/0.98)] print:text-black">
              Warranty Details
            </div>
          </div>

          {hasWarrantyData ? (
            <>
              {/* Top summary */}
              <div className="mt-3">
                <SummaryMiniRow
                  label="Type"
                  value={labelForWarrantyKind(warranty?.kind)}
                />

                <SummaryMiniRow
                  label="Status"
                  value={warranty?.status || "—"}
                />

                <SummaryMiniRow
                  label="Coverage term"
                  value={
                    typeof warranty?.coverageYears === "number"
                      ? `${warranty?.coverageYears} years`
                      : "—"
                  }
                  noBorder
                />
              </div>

              {/* Manufacturer packet */}
              {kind === "manufacturer" && (
                <>
                  <div className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2">
                    <InfoCard title="Manufacturer / program">
                      <div className="space-y-3">
                        <Row
                          label="Manufacturer"
                          value={warranty?.manufacturer}
                        />
                        <Row label="Program" value={warranty?.programName} />
                        <Row
                          label="Product / system"
                          value={(warranty as any)?.productLine}
                        />
                        <Row
                          label="Warranty #"
                          value={(warranty as any)?.warrantyNumber}
                          noBorder
                        />
                      </div>
                    </InfoCard>

                    <InfoCard title="Dates">
                      <div className="space-y-3">
                        <Row
                          label="Install"
                          value={fmtMaybeShortDate(warranty?.installDate)}
                        />
                        <Row
                          label="Submitted"
                          value={fmtMaybeShortDate(
                            (warranty as any)?.submittedAt
                          )}
                        />
                        <Row
                          label="Registered"
                          value={fmtMaybeShortDate(
                            (warranty as any)?.registeredAt
                          )}
                        />
                        <Row
                          label="Expires"
                          value={fmtMaybeShortDate(warranty?.expiresAt)}
                          noBorder
                        />
                      </div>
                    </InfoCard>

                    <InfoCard title="Registration / transfer">
                      <div className="space-y-3">
                        <Row
                          label="Registration ID"
                          value={warranty?.registrationId}
                        />
                        <Row
                          label="Transfer eligible"
                          value={
                            typeof (warranty as any)?.transferEligible ===
                            "boolean"
                              ? (warranty as any).transferEligible
                                ? "Yes"
                                : "No"
                              : "—"
                          }
                        />
                        <Row
                          label="Transfer deadline"
                          value={fmtMaybeShortDate(
                            (warranty as any)?.transferDeadline
                          )}
                          noBorder
                        />
                      </div>
                    </InfoCard>

                    <InfoCard title="Portal / submission link">
                      <div className="text-[12px]  break-words text-[rgb(var(--color-text-rgb)/0.96)] print:text-black">
                        {warranty?.portalUrl || "—"}
                      </div>

                      {warranty?.portalUrl &&
                      isValidHttpUrl(warranty.portalUrl) ? (
                        <a
                          href={warranty.portalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={`${UI.linkBtn} mt-3 print:hidden`}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Open
                        </a>
                      ) : null}
                    </InfoCard>
                  </div>
                </>
              )}

              {/* Workmanship packet */}
              {kind === "workmanship" && (
                <>
                  {/* SCREEN / MODAL VERSION */}
                  <div className="mt-5 grid gap-3 sm:grid-cols-2 print:hidden">
                    <InfoCard title="Service details">
                      <div className="space-y-3">
                        <Row
                          label="Service request #"
                          value={(warranty as any)?.serviceRequestNumber}
                        />
                        <Row
                          label="Install"
                          value={fmtMaybeShortDate(warranty?.installDate)}
                        />
                        <Row
                          label="Repair"
                          value={fmtMaybeShortDate(warranty?.repairDate)}
                        />
                        <Row
                          label="Expires"
                          value={fmtMaybeShortDate(warranty?.expiresAt)}
                          noBorder
                        />
                      </div>
                    </InfoCard>

                    <InfoCard title="">
                      <div className="space-y-4">
                        <div>
                          <div className={UI.sectionLabel}>Covered scope</div>
                          <div className="text-[14px] leading-7 whitespace-pre-wrap text-[rgb(var(--color-text-rgb)/0.9)] print:text-black">
                            {(warranty as any)?.coveredScope || "—"}
                          </div>
                        </div>

                        <div>
                          <div className={UI.sectionLabel}>
                            Exclusions / reporting notes
                          </div>
                          <div className="text-[14px] leading-7 whitespace-pre-wrap text-[rgb(var(--color-text-rgb)/0.9)] print:text-black">
                            {(warranty as any)?.exclusionsSummary || "—"}
                          </div>
                        </div>
                      </div>
                    </InfoCard>
                  </div>

                  {/* PRINT-ONLY VERSION */}
                  <div className="hidden print:block mt-6">
                    <div className="grid grid-cols-[1fr_1.12fr] gap-10">
                      {/* Left column */}
                      <div>
                        <div className="pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#4b5563] border-b border-[#e5e7eb]">
                          Service details
                        </div>

                        <div className="pt-3 space-y-0">
                          <div className="grid grid-cols-[118px_1fr] items-start gap-4 py-2 border-b border-[#eef2f7]">
                            <div className="text-[11px] font-medium text-[#64748b]">
                              Service request #
                            </div>
                            <div className="text-[13px] font-semibold text-black">
                              {(warranty as any)?.serviceRequestNumber || "—"}
                            </div>
                          </div>

                          <div className="grid grid-cols-[118px_1fr] items-start gap-4 py-2 border-b border-[#eef2f7]">
                            <div className="text-[11px] font-medium text-[#64748b]">
                              Install
                            </div>
                            <div className="text-[13px] font-semibold text-black">
                              {fmtMaybeShortDate(warranty?.installDate)}
                            </div>
                          </div>

                          <div className="grid grid-cols-[118px_1fr] items-start gap-4 py-2 border-b border-[#eef2f7]">
                            <div className="text-[11px] font-medium text-[#64748b]">
                              Repair
                            </div>
                            <div className="text-[13px] font-semibold text-black">
                              {fmtMaybeShortDate(warranty?.repairDate)}
                            </div>
                          </div>

                          <div className="grid grid-cols-[118px_1fr] items-start gap-4 py-2 border-b border-[#e5e7eb]">
                            <div className="text-[11px] font-medium text-[#64748b]">
                              Expires
                            </div>
                            <div className="text-[13px] font-semibold text-black">
                              {fmtMaybeShortDate(warranty?.expiresAt)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right column */}
                      <div className="pt-[1px]">
                        <div className="space-y-5">
                          <div>
                            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6b7280]">
                              Covered scope
                            </div>
                            <div className="mt-2 whitespace-pre-wrap text-[13px] leading-[1.7] text-black">
                              {(warranty as any)?.coveredScope || "—"}
                            </div>
                          </div>

                          <div className="border-t border-[#edf2f7] pt-4">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6b7280]">
                              Exclusions / reporting notes
                            </div>
                            <div className="mt-2 whitespace-pre-wrap text-[13px] leading-[1.7] text-black">
                              {(warranty as any)?.exclusionsSummary || "—"}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Third-party packet */}
              {kind === "thirdParty" && (
                <>
                  <div className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2">
                    <InfoCard title="Administrator / program">
                      <div className="space-y-3">
                        <Row label="Program" value={warranty?.programName} />
                        <Row
                          label="Service request #"
                          value={(warranty as any)?.serviceRequestNumber}
                        />
                        <Row
                          label="Authorization #"
                          value={(warranty as any)?.authorizationNumber}
                        />
                        <Row
                          label="Claim #"
                          value={warranty?.claimNumber}
                          noBorder
                        />
                      </div>
                    </InfoCard>

                    {/* Include submission date for third‑party warranties.  
                        Users can enter a submission date when filling out a third‑party packet, 
                        but previously it wasn’t displayed in the report.  
                        Adding it here keeps the report in sync with the edit fields. */}
                    <InfoCard title="Claim tracking">
                      <div className="space-y-3">
                        <Row
                          label="Claim status"
                          value={warranty?.claimStatus}
                        />
                        {/* Submission date: when the 3rd‑party claim or program was submitted. */}
                        <Row
                          label="Submitted"
                          value={fmtMaybeShortDate(
                            (warranty as any)?.submittedAt
                          )}
                        />
                        <Row
                          label="Opened"
                          value={fmtMaybeShortDate(
                            (warranty as any)?.claimOpenedAt
                          )}
                        />
                        <Row
                          label="Closed"
                          value={fmtMaybeShortDate(
                            (warranty as any)?.claimClosedAt
                          )}
                          noBorder
                        />
                      </div>
                    </InfoCard>

                    <InfoCard title="Portal / submission link">
                      <div className="text-[12px]  break-words text-[rgb(var(--color-text-rgb)/0.96)] print:text-black">
                        {warranty?.portalUrl || "—"}
                      </div>

                      {warranty?.portalUrl &&
                      isValidHttpUrl(warranty.portalUrl) ? (
                        <a
                          href={warranty.portalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={`${UI.linkBtn} mt-3 print:hidden`}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Open
                        </a>
                      ) : null}
                    </InfoCard>

                    <InfoCard title="3rd party administrator">
                      <div className="space-y-3">
                        <Row
                          label="Name"
                          value={warranty?.thirdPartyAdmin?.name}
                        />
                        <Row
                          label="Phone"
                          value={warranty?.thirdPartyAdmin?.phone}
                        />
                        <Row
                          label="Email"
                          value={warranty?.thirdPartyAdmin?.email}
                          noBorder
                        />
                      </div>
                    </InfoCard>
                  </div>
                </>
              )}

              {/* Insurance packet */}
              {kind === "insurance" && (
                <>
                  <div className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2">
                    <InfoCard title="Carrier / policy">
                      <div className="space-y-3">
                        <Row
                          label="Carrier"
                          value={warranty?.insuranceCarrier}
                        />
                        <Row label="Policy #" value={warranty?.policyNumber} />
                        <Row
                          label="Loss date"
                          value={fmtMaybeShortDate((warranty as any)?.lossDate)}
                        />
                        <Row
                          label="Reported"
                          value={fmtMaybeShortDate(
                            (warranty as any)?.reportedAt
                          )}
                          noBorder
                        />
                      </div>
                    </InfoCard>

                    <InfoCard title="Claim / deductible">
                      <div className="space-y-3">
                        <Row label="Claim ID" value={warranty?.claimId} />
                        <Row label="Claim #" value={warranty?.claimNumber} />
                        <Row
                          label="Claim status"
                          value={warranty?.claimStatus}
                        />
                        <Row
                          label="Deductible"
                          value={fmtMoney((warranty as any)?.deductibleCents)}
                          noBorder
                        />
                      </div>
                    </InfoCard>

                    <InfoCard title="Cause of loss">
                      <div className="text-[14px] leading-7 whitespace-pre-wrap text-[rgb(var(--color-text-rgb)/0.9)] print:text-black">
                        {(warranty as any)?.causeOfLoss || "—"}
                      </div>
                    </InfoCard>

                    <InfoCard title="Adjuster">
                      <div className="space-y-3">
                        <Row label="Name" value={warranty?.adjuster?.name} />
                        <Row label="Phone" value={warranty?.adjuster?.phone} />
                        <Row
                          label="Email"
                          value={warranty?.adjuster?.email}
                          noBorder
                        />
                      </div>
                    </InfoCard>
                  </div>
                </>
              )}

              {/* Shared homeowner block */}
              {(homeowner.name || homeowner.phone || homeowner.email) && (
                <div className="mt-4 border-t border-[rgb(var(--color-border-rgb)/0.14)] pt-3 print:border-[#e5e7eb]">
                  <div className="text-[12px] font-medium tracking-[-0.01em] text-[rgb(var(--color-text-rgb)/0.96)] print:text-[#111827]">
                    Homeowner
                  </div>

                  <div className="mt-3">
                    <ContactBlock
                      title="Homeowner"
                      hideTitle
                      name={homeowner.name}
                      phone={homeowner.phone}
                      email={homeowner.email}
                    />
                  </div>
                </div>
              )}

              {/* Notes */}
              {warranty?.notes ? (
                <div className="mt-4 border-t border-[rgb(var(--color-border-rgb)/0.14)] pt-3 print:border-[#e5e7eb]">
                  <div className="text-[12px] font-medium tracking-[-0.01em] text-[rgb(var(--color-text-rgb)/0.96)] print:text-[#111827]">
                    Warranty Notes
                  </div>
                  <div className="mt-2 max-w-[72ch] whitespace-pre-wrap text-[12px] leading-6 text-[rgb(var(--color-text-rgb)/0.9)] print:text-[#111827]">
                    {warranty.notes}
                  </div>
                </div>
              ) : null}

              {/* Attachments */}
              {warranty?.attachments && warranty.attachments.length > 0 ? (
                <div className="mt-5 border border-[rgb(var(--color-border-rgb)/0.22)] bg-[rgb(var(--color-background-rgb)/0.10)] px-4 py-4 print:border-[#e5e7eb] print:border-t-0 print:border-x-0 print:border-b print:bg-transparent print:px-0 print:py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[15px] font-semibold text-[rgb(var(--color-text-rgb)/0.96)] print:text-black">
                      Attachments
                    </div>
                    <div className="text-[12px] text-[rgb(var(--color-text-rgb)/0.62)] print:text-[#4b5563]">
                      {warranty.attachments.length} file(s)
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    {warranty.attachments.map((a) => {
                      const label =
                        a.label ||
                        kindLabelForAttachmentKind(a.kind) ||
                        "Attachment";

                      return (
                        <div
                          key={a.id}
                          className="flex items-start justify-between gap-3 border border-[rgb(var(--color-border-rgb)/0.16)] bg-[rgb(var(--color-background-rgb)/0.08)] px-3 py-3 print:border-[#f3f4f6] print:border-t-0 print:border-x-0 print:border-b print:bg-transparent print:px-0"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-[rgb(var(--color-text-rgb)/0.56)] print:text-[#6b7280]" />
                              <div className="text-[14px] font-semibold break-words text-[rgb(var(--color-text-rgb)/0.96)] print:text-black">
                                {label}
                              </div>
                            </div>

                            <div className="mt-1 text-[12px] text-[rgb(var(--color-text-rgb)/0.62)] break-words print:text-[#4b5563]">
                              {a.kind
                                ? kindLabelForAttachmentKind(a.kind)
                                : "Attachment"}
                              {a.createdAt
                                ? ` • ${fmtMaybeDate(a.createdAt)}`
                                : ""}
                            </div>

                            <div className="mt-1 text-[12px] break-words text-[rgb(var(--color-text-rgb)/0.62)] print:text-[#4b5563]">
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
            </>
          ) : (
            <div className="mt-4 flex items-center gap-2 border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-background-rgb)/0.10)] px-4 py-3 text-sm text-[rgb(var(--color-text-rgb)/0.62)] print:border-[#d1d5db] print:bg-white print:text-[#4b5563]">
              <AlertCircle className="h-4 w-4" />
              No warranty metadata saved yet.
            </div>
          )}
        </div>

        {/* Photos */}
        {packetPhotos.length > 0 ? (
          <div className="mt-4 border-t border-[rgb(var(--color-border-rgb)/0.14)] pt-3 print:border-[#e5e7eb]">
            <div className="border-b border-[rgb(var(--color-border-rgb)/0.12)] pb-3 print:border-[#e5e7eb]">
              <div className="text-[15px] font-semibold tracking-[-0.01em] text-[rgb(var(--color-text-rgb)/0.96)] print:text-black">
                Supporting Photos
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {packetPhotos.map((p) => {
                const src = safePhotoUrl(p);
                return (
                  <div
                    key={p.id}
                    className="break-inside-avoid border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-background-rgb)/0.08)] p-2 print:border-[#f3f4f6] print:bg-white"
                  >
                    {src ? (
                      <img
                        src={src}
                        alt={p.caption || "Job photo"}
                        className="h-32 w-full object-cover print:h-36"
                      />
                    ) : (
                      <div className="flex h-32 w-full items-center justify-center bg-[rgb(var(--color-background-rgb)/0.12)] text-[rgb(var(--color-text-rgb)/0.42)] print:bg-[#f3f4f6] print:text-[#6b7280]">
                        No image
                      </div>
                    )}

                    <div className="mt-2 text-[12px] font-medium text-[rgb(var(--color-text-rgb)/0.78)] print:text-black">
                      {p.caption || "No caption"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          // ✅ MODAL-ONLY EMPTY STATE (hidden in print)
          <div className="mt-6 border-t border-[rgb(var(--color-border-rgb)/0.14)] pt-5 print:hidden">
            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-[13px] text-yellow-200">
              No supporting photos will be included in this packet.
              <span className="block mt-1 text-[12px] text-yellow-300/80">
                You can add photos by editing this warranty.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
export default function WarrantyReportModal({
  open,
  onClose,
  job,
  photos,
  selectedWarranty,
}: {
  open: boolean;
  onClose: () => void;
  job: Job;
  photos: JobPhoto[];
  selectedWarranty?: NonNullable<Job["warranty"]> | null;
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

  const warranty = selectedWarranty ?? undefined;

  const homeowner = useMemo(
    () => ({
      name: job.homeowner?.name ?? warranty?.homeowner?.name ?? "",
      phone: job.homeowner?.phone ?? warranty?.homeowner?.phone ?? "",
      email: job.homeowner?.email ?? warranty?.homeowner?.email ?? "",
    }),
    [
      job.homeowner?.name,
      job.homeowner?.phone,
      job.homeowner?.email,
      warranty?.homeowner?.name,
      warranty?.homeowner?.phone,
      warranty?.homeowner?.email,
    ]
  );

  const hasWarrantyData = useMemo(() => {
    if (!warranty) return false;

    const hasMeaningful =
      (warranty.kind && warranty.kind !== "none") ||
      Boolean(
        warranty.status ||
          warranty.manufacturer ||
          warranty.programName ||
          (warranty as any).productLine ||
          (warranty as any).warrantyNumber ||
          warranty.coverageYears ||
          warranty.portalUrl ||
          warranty.registrationId ||
          (warranty as any).transferEligible ||
          (warranty as any).transferDeadline ||
          warranty.claimId ||
          warranty.claimNumber ||
          warranty.claimStatus ||
          (warranty as any).claimOpenedAt ||
          (warranty as any).claimClosedAt ||
          (warranty as any).serviceRequestNumber ||
          (warranty as any).authorizationNumber ||
          warranty.insuranceCarrier ||
          warranty.policyNumber ||
          (warranty as any).lossDate ||
          (warranty as any).reportedAt ||
          (warranty as any).causeOfLoss ||
          typeof (warranty as any).deductibleCents === "number" ||
          (warranty as any).coveredScope ||
          (warranty as any).exclusionsSummary ||
          warranty.notes ||
          warranty.installDate ||
          warranty.repairDate ||
          warranty.expiresAt ||
          (warranty as any).submittedAt ||
          (warranty as any).registeredAt ||
          (warranty.attachments && warranty.attachments.length > 0) ||
          ((warranty as any).warrantyPhotoIds &&
            Array.isArray((warranty as any).warrantyPhotoIds) &&
            (warranty as any).warrantyPhotoIds.length > 0) ||
          warranty.adjuster?.name ||
          warranty.adjuster?.phone ||
          warranty.adjuster?.email ||
          warranty.thirdPartyAdmin?.name ||
          warranty.thirdPartyAdmin?.phone ||
          warranty.thirdPartyAdmin?.email
      );

    return Boolean(hasMeaningful);
  }, [warranty]);

  const packetPhotos = useMemo(() => {
    const selectedIds =
      Array.isArray((warranty as any)?.warrantyPhotoIds) &&
      (warranty as any).warrantyPhotoIds.length > 0
        ? ((warranty as any).warrantyPhotoIds as string[])
        : [];

    if (!selectedIds.length) return [];

    const photoMap = new Map(photos.map((photo) => [photo.id, photo] as const));

    return selectedIds
      .map((id) => photoMap.get(id))
      .filter((photo): photo is JobPhoto => Boolean(photo))
      .slice(0, 8);
  }, [photos, warranty]);

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
          address: data.address ?? null,
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
            <div className="report-scroll min-h-0 flex-1 overflow-y-auto">
              <WarrantyReportDocument
                job={job}
                address={address}
                createdLabel={createdLabel}
                updatedLabel={updatedLabel}
                warranty={warranty}
                homeowner={homeowner}
                hasWarrantyData={hasWarrantyData}
                packetPhotos={packetPhotos}
                orgBranding={orgBranding}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Print document: keep mounted, but off-screen during normal view */}
      <div className="warranty-report-print fixed left-[-100000px] top-0 w-[1024px] overflow-visible bg-white text-black print:static print:left-auto print:top-auto print:w-auto print:overflow-visible">
        <div className="warranty-report-print-inner bg-white text-black">
          <WarrantyReportDocument
            job={job}
            address={address}
            createdLabel={createdLabel}
            updatedLabel={updatedLabel}
            warranty={warranty}
            homeowner={homeowner}
            hasWarrantyData={hasWarrantyData}
            packetPhotos={packetPhotos}
            orgBranding={orgBranding}
          />
        </div>
      </div>
    </Fragment>,
    document.body
  );
}
