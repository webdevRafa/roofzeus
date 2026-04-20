import { createPortal } from "react-dom";
import { Plus, FileText, Pencil, X } from "lucide-react";
import type { Job } from "../types/types";

type WarrantyDraft = NonNullable<Job["warranty"]>;
type WarrantyTypeKey = Exclude<WarrantyDraft["kind"], "none">;
type WarrantyRecord = Partial<Record<WarrantyTypeKey, WarrantyDraft>>;

const WARRANTY_TYPES: WarrantyTypeKey[] = [
  "workmanship",
  "manufacturer",
  "thirdParty",
  "insurance",
];

function typeLabel(type: WarrantyTypeKey) {
  switch (type) {
    case "workmanship":
      return "Workmanship";
    case "manufacturer":
      return "Manufacturer";
    case "thirdParty":
      return "3rd party";
    case "insurance":
      return "Insurance";
    default:
      return type;
  }
}

function statusLabel(status?: WarrantyDraft["status"]) {
  if (!status) return "Draft";

  switch (status) {
    case "notStarted":
      return "Not started";
    case "draft":
      return "Draft";
    case "submitted":
      return "Submitted";
    case "registered":
      return "Registered";
    case "active":
      return "Active";
    case "claimOpened":
      return "Claim opened";
    case "closed":
      return "Closed";
    case "expired":
      return "Expired";
    default:
      return status;
  }
}

function addressLabel(job: Job) {
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
    "Job address"
  );
}

const UI = {
  shell:
    "relative w-full max-w-5xl overflow-hidden rounded-2xl border border-[rgb(var(--color-border-rgb)/0.34)] bg-[var(--color-card)] shadow-[0_30px_90px_rgba(0,0,0,0.55)]",
  panel:
    "rounded-2xl border border-[rgb(var(--color-border-rgb)/0.24)] bg-[rgb(var(--color-background-rgb)/0.16)]",
  title:
    "text-[15px] font-semibold tracking-[0.02em] text-[rgb(var(--color-text-rgb)/0.98)]",
  subtitle: "mt-1 text-[12px] text-[rgb(var(--color-text-rgb)/0.56)]",
  sectionLabel:
    "text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgb(var(--color-text-rgb)/0.56)]",
  ghostBtn:
    "inline-flex items-center justify-center gap-2 rounded-xl border border-[rgb(var(--color-border-rgb)/0.26)] bg-[rgb(var(--color-background-rgb)/0.16)] px-3 py-2 text-xs font-semibold text-[rgb(var(--color-text-rgb)/0.86)] transition hover:bg-[rgb(var(--color-background-rgb)/0.28)]",
  primaryBtn:
    "inline-flex items-center justify-center gap-2 rounded-xl border border-[rgb(var(--color-primary-rgb)/0.38)] bg-[rgb(var(--color-primary-rgb)/0.12)] px-3 py-2 text-xs font-semibold text-[rgb(var(--color-text-rgb)/0.96)] transition hover:bg-[rgb(var(--color-primary-rgb)/0.22)]",
  iconBtn:
    "inline-flex items-center justify-center rounded-xl border border-transparent p-2 text-[rgb(var(--color-text-rgb)/0.56)] transition hover:border-[rgb(var(--color-border-rgb)/0.28)] hover:bg-[rgb(var(--color-background-rgb)/0.24)] hover:text-[rgb(var(--color-text-rgb)/0.92)]",
};

export default function WarrantyCenterModal({
  open,
  onClose,
  job,
  warranties,
  onCreateType,
  onEditType,
  onPreviewType,
}: {
  open: boolean;
  onClose: () => void;
  job: Job;
  warranties: WarrantyRecord;
  onCreateType: (type: WarrantyTypeKey) => void;
  onEditType: (type: WarrantyTypeKey) => void;
  onPreviewType: (type: WarrantyTypeKey) => void;
}) {
  if (!open) return null;

  const runtimeJob = job as Job & {
    warranties?: Partial<Record<WarrantyTypeKey, WarrantyDraft>>;
    warranty?: WarrantyDraft | null;
  };

  const normalizedWarranties: WarrantyRecord = {
    ...(runtimeJob.warranties ?? {}),
    ...(warranties ?? {}),
  };

  const legacyWarranty = runtimeJob.warranty ?? undefined;

  if (
    legacyWarranty?.kind &&
    legacyWarranty.kind !== "none" &&
    !normalizedWarranties[legacyWarranty.kind as WarrantyTypeKey]
  ) {
    normalizedWarranties[legacyWarranty.kind as WarrantyTypeKey] =
      legacyWarranty;
  }

  const hasWarrantyRecord = (type: WarrantyTypeKey) => {
    const record = normalizedWarranties[type];
    if (!record || typeof record !== "object") return false;

    return (
      record.kind === type ||
      Boolean(
        record.status ||
          record.manufacturer ||
          record.programName ||
          record.coverageYears ||
          record.portalUrl ||
          record.registrationId ||
          record.claimId ||
          record.claimNumber ||
          record.claimStatus ||
          record.insuranceCarrier ||
          record.policyNumber ||
          record.notes ||
          record.installDate ||
          record.repairDate ||
          record.expiresAt ||
          (Array.isArray(record.attachments) &&
            record.attachments.length > 0) ||
          record.homeowner?.name ||
          record.homeowner?.phone ||
          record.homeowner?.email ||
          record.adjuster?.name ||
          record.adjuster?.phone ||
          record.adjuster?.email ||
          record.thirdPartyAdmin?.name ||
          record.thirdPartyAdmin?.phone ||
          record.thirdPartyAdmin?.email
      )
    );
  };

  const existingTypes = WARRANTY_TYPES.filter(hasWarrantyRecord);

  return createPortal(
    <div className="fixed inset-0 z-[120] overflow-y-auto bg-[var(--color-background)]/60 backdrop-blur-md p-3 pt-[calc(72px+12px)] sm:p-4 sm:pt-[calc(72px+16px)] print:hidden">
      <button
        type="button"
        className="fixed inset-0 z-0"
        aria-label="Close"
        onClick={onClose}
      />

      <div className="relative z-10 flex min-h-full items-start justify-center">
        <div className={UI.shell}>
          <div className="flex items-start justify-between gap-4 border-b border-[rgb(var(--color-border-rgb)/0.26)] bg-[rgb(var(--color-background-rgb)/0.18)] px-5 py-4">
            <div className="min-w-0">
              <div className={UI.title}>Warranty</div>
              <div className="mt-1 truncate text-[13px] font-medium text-[rgb(var(--color-text-rgb)/0.82)]">
                {addressLabel(job)}
              </div>
              <div className={UI.subtitle}>
                Create up to one warranty per type, then come back later to
                update or preview each packet.
              </div>
            </div>

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

          <div className="p-5">
            <div className="grid gap-5 lg:grid-cols-2">
              <section className={`${UI.panel} p-4`}>
                <div className="mb-4">
                  <div className={UI.sectionLabel}>Create new warranty</div>
                  <div className="mt-1 text-sm text-[rgb(var(--color-text-rgb)/0.88)]">
                    Each type can only be created once for this job.
                  </div>
                </div>

                <div className="space-y-3">
                  {WARRANTY_TYPES.map((type) => {
                    const exists = existingTypes.includes(type);

                    return (
                      <div
                        key={type}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-[rgb(var(--color-border-rgb)/0.20)] bg-[rgb(var(--color-background-rgb)/0.18)] px-4 py-4"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[rgb(var(--color-text-rgb)/0.96)]">
                            {typeLabel(type)}
                          </div>
                          <div className="mt-1 text-xs text-[rgb(var(--color-text-rgb)/0.56)]">
                            {exists
                              ? "Already created for this job."
                              : "Create this warranty record."}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => onCreateType(type)}
                          disabled={exists}
                          className={
                            exists
                              ? UI.ghostBtn + " opacity-45 cursor-not-allowed"
                              : UI.primaryBtn
                          }
                        >
                          <Plus className="h-4 w-4" />
                          Create
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className={`${UI.panel} p-4`}>
                <div className="mb-4">
                  <div className={UI.sectionLabel}>
                    Update existing warranty
                  </div>
                  <div className="mt-1 text-sm text-[rgb(var(--color-text-rgb)/0.88)]">
                    Edit saved warranty records or open their homeowner packet.
                  </div>
                </div>

                {existingTypes.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[rgb(var(--color-border-rgb)/0.24)] bg-[rgb(var(--color-background-rgb)/0.10)] px-4 py-8 text-sm text-[rgb(var(--color-text-rgb)/0.56)]">
                    No warranty records have been created yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {existingTypes.map((type) => {
                      const warranty = normalizedWarranties[type];

                      return (
                        <div
                          key={type}
                          className="rounded-2xl border border-[rgb(var(--color-border-rgb)/0.20)] bg-[rgb(var(--color-background-rgb)/0.18)] px-4 py-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-[rgb(var(--color-text-rgb)/0.96)]">
                                {typeLabel(type)}
                              </div>

                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <span className="inline-flex rounded-full border border-[rgb(var(--color-border-rgb)/0.22)] bg-[rgb(var(--color-background-rgb)/0.18)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.72)]">
                                  {statusLabel(warranty?.status)}
                                </span>

                                {(warranty?.manufacturer ||
                                  warranty?.programName) && (
                                  <span className="text-xs text-[rgb(var(--color-text-rgb)/0.56)]">
                                    {[
                                      warranty?.manufacturer,
                                      warranty?.programName,
                                    ]
                                      .filter(Boolean)
                                      .join(" — ")}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => onEditType(type)}
                                className={UI.ghostBtn}
                              >
                                <Pencil className="h-4 w-4" />
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() => onPreviewType(type)}
                                className={UI.primaryBtn}
                              >
                                <FileText className="h-4 w-4" />
                                Packet
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
