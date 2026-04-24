import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Save, X } from "lucide-react";
import type { Job, ContactInfo } from "../types/types";

type WarrantyKind = NonNullable<Job["warranty"]>["kind"];
type WarrantyStatus = NonNullable<Job["warranty"]>["status"];

type WarrantyDraft = NonNullable<Job["warranty"]>;

type WarrantyTypeKey = Exclude<WarrantyKind, "none">;

function labelForWarrantyType(type: WarrantyTypeKey) {
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

function toDateInputValue(d: any): string {
  // supports Date | Timestamp | string | null
  if (!d) return "";
  const asDate =
    d?.toDate?.() instanceof Date ? d.toDate() : d instanceof Date ? d : null;
  if (asDate) {
    const yyyy = asDate.getFullYear();
    const mm = String(asDate.getMonth() + 1).padStart(2, "0");
    const dd = String(asDate.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  if (typeof d === "string") return d.slice(0, 10);
  return "";
}

function fromDateInputValue(v: string): Date | null {
  if (!v) return null;
  const [y, m, d] = v.split("-").map((n) => Number(n));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function cleanPhoneInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, 10);
}

function warrantyTypeLabel(type: WarrantyTypeKey): string {
  switch (type) {
    case "manufacturer":
      return "Manufacturer Warranty";
    case "workmanship":
      return "Workmanship Warranty";
    case "thirdParty":
      return "3rd Party Warranty";
    case "insurance":
      return "Insurance Warranty";
    default:
      return "Warranty";
  }
}

const UI = {
  input:
    "w-full border border-[rgb(var(--color-border-rgb)/0.42)] bg-[rgb(var(--color-background-rgb)/0.34)] px-3 py-2.5 text-sm text-[rgb(var(--color-text-rgb)/0.96)] placeholder:text-[rgb(var(--color-text-rgb)/0.38)] outline-none transition " +
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.04),inset_0_0_0_1px_rgba(0,0,0,0.18)] " +
    "hover:border-[rgb(var(--color-border-rgb)/0.56)] " +
    "focus:border-[rgb(var(--color-primary-rgb)/0.55)] focus:bg-[rgb(var(--color-background-rgb)/0.24)] focus:ring-0",

  select:
    "w-full border border-[rgb(var(--color-border-rgb)/0.42)] bg-[rgb(var(--color-background-rgb)/0.34)] px-3 py-2.5 text-sm text-[rgb(var(--color-text-rgb)/0.96)] outline-none transition " +
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.04),inset_0_0_0_1px_rgba(0,0,0,0.18)] " +
    "hover:border-[rgb(var(--color-border-rgb)/0.56)] " +
    "focus:border-[rgb(var(--color-primary-rgb)/0.55)] focus:bg-[rgb(var(--color-background-rgb)/0.24)] focus:ring-0",

  option: "bg-[var(--color-card)] text-[var(--color-text)]",

  textarea:
    "w-full border border-[rgb(var(--color-border-rgb)/0.42)] bg-[rgb(var(--color-background-rgb)/0.34)] px-3 py-3 text-sm leading-6 text-[rgb(var(--color-text-rgb)/0.96)] placeholder:text-[rgb(var(--color-text-rgb)/0.38)] outline-none resize-none transition " +
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.04),inset_0_0_0_1px_rgba(0,0,0,0.18)] " +
    "hover:border-[rgb(var(--color-border-rgb)/0.56)] " +
    "focus:border-[rgb(var(--color-primary-rgb)/0.55)] focus:bg-[rgb(var(--color-background-rgb)/0.24)] focus:ring-0",

  label:
    "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgb(var(--color-text-rgb)/0.58)]",

  btnPrimary:
    "inline-flex items-center justify-center gap-2 border border-[rgb(var(--color-primary-rgb)/0.42)] bg-[rgb(var(--color-primary-rgb)/0.14)] px-3 py-2 text-xs font-semibold tracking-wide text-[rgb(var(--color-text-rgb)/0.96)] transition " +
    "hover:bg-[rgb(var(--color-primary-rgb)/0.22)] hover:border-[rgb(var(--color-primary-rgb)/0.56)] " +
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] disabled:opacity-60 disabled:cursor-not-allowed",

  btnGhost:
    "inline-flex items-center justify-center gap-2 border border-[rgb(var(--color-border-rgb)/0.32)] bg-[rgb(var(--color-background-rgb)/0.18)] px-3 py-2 text-xs font-semibold tracking-wide text-[rgb(var(--color-text-rgb)/0.84)] transition " +
    "hover:bg-[rgb(var(--color-background-rgb)/0.28)] hover:border-[rgb(var(--color-border-rgb)/0.5)]",

  iconBtn:
    "border border-transparent p-2 text-[rgb(var(--color-text-rgb)/0.58)] transition hover:border-[rgb(var(--color-border-rgb)/0.3)] hover:bg-[rgb(var(--color-background-rgb)/0.24)] hover:text-[rgb(var(--color-text-rgb)/0.9)]",
};

type WarrantySelectablePhoto = {
  id: string;
  thumbUrl?: string;
  fullUrl?: string;
  url?: string;
  caption?: string;
};

export default function WarrantyEditModal({
  open,
  onClose,
  onOpenReport,
  job,
  warrantyType,
  warranty,
  availablePhotos,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onOpenReport?: () => void;
  job: Job;
  warrantyType: WarrantyTypeKey;
  warranty?: WarrantyDraft | null;
  availablePhotos: WarrantySelectablePhoto[];
  onSave: (
    nextWarranty: WarrantyDraft,
    nextHomeowner: ContactInfo
  ) => Promise<void>;
}) {
  const existing = useMemo<WarrantyDraft>(() => {
    return (
      warranty ?? {
        kind: warrantyType,
        status: "draft",

        manufacturer: "",
        programName: "",
        productLine: "",
        warrantyNumber: "",
        coverageYears: undefined,

        portalUrl: "",
        registrationId: "",
        transferEligible: false,

        claimId: "",
        claimNumber: "",
        claimStatus: undefined,

        insuranceCarrier: "",
        policyNumber: "",
        serviceRequestNumber: "",
        authorizationNumber: "",

        causeOfLoss: "",
        coveredScope: "",
        exclusionsSummary: "",

        notes: "",

        deductibleCents: undefined,

        installDate: null,
        repairDate: null,
        expiresAt: null,
        submittedAt: null,
        registeredAt: null,
        transferDeadline: null,
        lossDate: null,
        reportedAt: null,
        claimOpenedAt: null,
        claimClosedAt: null,

        homeowner: {
          name: job.homeowner?.name ?? "",
          phone: job.homeowner?.phone ?? "",
          email: job.homeowner?.email ?? "",
        },
        adjuster: { name: "", phone: "", email: "" },
        thirdPartyAdmin: { name: "", phone: "", email: "" },

        attachments: [],
        warrantyPhotoIds: [],
      }
    );
  }, [warranty, warrantyType]);

  const [draft, setDraft] = useState<WarrantyDraft>(existing);
  const [saving, setSaving] = useState(false);

  const existingHomeowner = useMemo<ContactInfo>(
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

  const [homeownerDraft, setHomeownerDraft] =
    useState<ContactInfo>(existingHomeowner);

  useEffect(() => {
    if (!open) return;
    setDraft(existing);
    setHomeownerDraft(existingHomeowner);
  }, [open, existing, existingHomeowner]);

  function safePhotoUrl(photo: WarrantySelectablePhoto) {
    return photo.thumbUrl || photo.fullUrl || photo.url || "";
  }

  function toggleWarrantyPhoto(photoId: string) {
    setDraft((prev) => {
      const current = Array.isArray((prev as any).warrantyPhotoIds)
        ? (prev as any).warrantyPhotoIds
        : [];

      const nextIds = current.includes(photoId)
        ? current.filter((id: string) => id !== photoId)
        : [...current, photoId];

      return {
        ...prev,
        warrantyPhotoIds: nextIds,
      };
    });
  }

  const selectedWarrantyPhotoIds = Array.isArray(
    (draft as any).warrantyPhotoIds
  )
    ? (draft as any).warrantyPhotoIds
    : [];

  if (!open) return null;

  const hasAnything =
    Boolean(draft.notes?.trim()) ||
    Boolean(draft.manufacturer?.trim()) ||
    Boolean(draft.programName?.trim()) ||
    Boolean((draft as any).productLine?.trim()) ||
    Boolean((draft as any).warrantyNumber?.trim()) ||
    Boolean(draft.portalUrl?.trim()) ||
    Boolean(draft.registrationId?.trim()) ||
    Boolean(draft.claimId?.trim()) ||
    Boolean(draft.claimNumber?.trim()) ||
    Boolean(draft.insuranceCarrier?.trim()) ||
    Boolean(draft.policyNumber?.trim()) ||
    Boolean((draft as any).serviceRequestNumber?.trim()) ||
    Boolean((draft as any).authorizationNumber?.trim()) ||
    Boolean((draft as any).causeOfLoss?.trim()) ||
    Boolean((draft as any).coveredScope?.trim()) ||
    Boolean((draft as any).exclusionsSummary?.trim()) ||
    typeof draft.coverageYears === "number" ||
    typeof (draft as any).deductibleCents === "number" ||
    Boolean(draft.adjuster?.name?.trim()) ||
    Boolean(draft.thirdPartyAdmin?.name?.trim());

  const isManufacturer = warrantyType === "manufacturer";
  const isWorkmanship = warrantyType === "workmanship";
  const isThirdParty = warrantyType === "thirdParty";
  const isInsurance = warrantyType === "insurance";

  async function handleSave(openReport = false) {
    setSaving(true);
    try {
      await onSave(
        {
          ...draft,
          kind: warrantyType,
          thirdPartyAdmin: draft.thirdPartyAdmin
            ? {
                ...draft.thirdPartyAdmin,
                phone: cleanPhoneInput(draft.thirdPartyAdmin.phone ?? ""),
              }
            : undefined,
          adjuster: draft.adjuster
            ? {
                ...draft.adjuster,
                phone: cleanPhoneInput(draft.adjuster.phone ?? ""),
              }
            : undefined,
        },
        {
          name: homeownerDraft.name?.trim() || "",
          phone: cleanPhoneInput(homeownerDraft.phone ?? ""),
          email: homeownerDraft.email?.trim() || "",
        }
      );

      onClose();

      if (openReport && onOpenReport) {
        setTimeout(() => {
          onOpenReport();
        }, 0);
      }
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[120] overflow-y-auto bg-[var(--color-background)]/60 backdrop-blur-md p-3 pt-[calc(72px+12px)] sm:p-4 sm:pt-[calc(72px+16px)] print:hidden">
      <button
        type="button"
        className="fixed inset-0 z-0"
        aria-label="Close"
        onClick={onClose}
      />

      <div className="relative z-10 flex min-h-full items-start justify-center">
        <div className="relative w-full max-w-3xl overflow-hidden border border-[rgb(var(--color-border-rgb)/0.34)] bg-[var(--color-card)] shadow-[0_30px_80px_rgba(0,0,0,0.55)] max-h-[calc(100dvh-72px-24px)] sm:max-h-[calc(100dvh-72px-32px)] flex flex-col">
          {/* top bar */}
          <div className="flex items-center justify-between border-b border-[rgb(var(--color-border-rgb)/0.26)] bg-[rgb(var(--color-background-rgb)/0.18)] px-5 py-4">
            <div className="min-w-0">
              <div className="text-[15px] font-semibold tracking-[0.02em] text-[rgb(var(--color-text-rgb)/0.98)]">
                {warrantyTypeLabel(warrantyType)}
              </div>

              <div className="mt-1 truncate text-[13px] font-medium text-[rgb(var(--color-text-rgb)/0.82)]">
                {typeof job.address === "string"
                  ? job.address
                  : job.address?.fullLine ||
                    [
                      job.address?.line1,
                      job.address?.city,
                      job.address?.state,
                      job.address?.zip,
                    ]
                      .filter(Boolean)
                      .join(", ") ||
                    "Job address"}
              </div>

              <div className="mt-1 text-[12px] text-[rgb(var(--color-text-rgb)/0.56)]">
                Manage warranty details and preview the homeowner-facing packet
                for this job.
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

          {/* content */}
          <div className="modal-scroll min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(to_bottom,rgba(255,255,255,0.01),rgba(255,255,255,0))] p-5">
            {!hasAnything ? (
              <div className="mb-4 flex items-center gap-2  p-2 text-sm text-[var(--color-muted)]">
                <AlertCircle className="h-4 w-4 shrink-0" />
                No warranty data saved yet.
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={UI.label}>Type</label>
                <div
                  className={`${UI.input} flex min-h-[44px] items-center font-medium`}
                >
                  {labelForWarrantyType(warrantyType)}
                </div>
              </div>

              <div>
                <label className={UI.label}>Status</label>
                <select
                  className={UI.select}
                  value={draft.status ?? "draft"}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      status: e.target.value as WarrantyStatus,
                    }))
                  }
                >
                  <option className={UI.option} value="notStarted">
                    Not started
                  </option>
                  <option className={UI.option} value="draft">
                    Draft
                  </option>
                  <option className={UI.option} value="submitted">
                    Submitted
                  </option>
                  <option className={UI.option} value="registered">
                    Registered
                  </option>
                  <option className={UI.option} value="active">
                    Active
                  </option>
                  <option className={UI.option} value="claimOpened">
                    Claim opened
                  </option>
                  <option className={UI.option} value="closed">
                    Closed
                  </option>
                  <option className={UI.option} value="expired">
                    Expired
                  </option>
                </select>
              </div>
            </div>

            {isManufacturer && (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={UI.label}>Manufacturer</label>
                  <input
                    className={UI.input}
                    value={draft.manufacturer ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, manufacturer: e.target.value }))
                    }
                    placeholder="GAF, Owens Corning, CertainTeed…"
                  />
                </div>

                <div>
                  <label className={UI.label}>Program</label>
                  <input
                    className={UI.input}
                    value={draft.programName ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, programName: e.target.value }))
                    }
                    placeholder="Golden Pledge, Platinum, SureStart…"
                  />
                </div>

                <div>
                  <label className={UI.label}>Product / system</label>
                  <input
                    className={UI.input}
                    value={(draft as any).productLine ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        productLine: e.target.value,
                      }))
                    }
                    placeholder="Timberline HDZ, Duration, Landmark…"
                  />
                </div>

                <div>
                  <label className={UI.label}>Warranty #</label>
                  <input
                    className={UI.input}
                    value={(draft as any).warrantyNumber ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        warrantyNumber: e.target.value,
                      }))
                    }
                    placeholder="Certificate / warranty number"
                  />
                </div>

                <div>
                  <label className={UI.label}>Coverage (years)</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    className={UI.input}
                    value={
                      typeof draft.coverageYears === "number"
                        ? draft.coverageYears
                        : ""
                    }
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        coverageYears:
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                      }))
                    }
                  />
                </div>

                <div>
                  <label className={UI.label}>Registration ID</label>
                  <input
                    className={UI.input}
                    value={draft.registrationId ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        registrationId: e.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <label className={UI.label}>Portal URL</label>
                  <input
                    className={UI.input}
                    value={draft.portalUrl ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, portalUrl: e.target.value }))
                    }
                    placeholder="https://…"
                  />
                </div>

                <div>
                  <label className={UI.label}>Install date</label>
                  <input
                    type="date"
                    className={UI.input}
                    value={toDateInputValue(draft.installDate)}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        installDate: fromDateInputValue(e.target.value),
                      }))
                    }
                  />
                </div>

                <div>
                  <label className={UI.label}>Submitted</label>
                  <input
                    type="date"
                    className={UI.input}
                    value={toDateInputValue((draft as any).submittedAt)}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        submittedAt: fromDateInputValue(e.target.value),
                      }))
                    }
                  />
                </div>

                <div>
                  <label className={UI.label}>Registered</label>
                  <input
                    type="date"
                    className={UI.input}
                    value={toDateInputValue((draft as any).registeredAt)}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        registeredAt: fromDateInputValue(e.target.value),
                      }))
                    }
                  />
                </div>

                <div>
                  <label className={UI.label}>Expires</label>
                  <input
                    type="date"
                    className={UI.input}
                    value={toDateInputValue(draft.expiresAt)}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        expiresAt: fromDateInputValue(e.target.value),
                      }))
                    }
                  />
                </div>

                <div className="sm:col-span-2 flex items-center gap-3 border border-[rgb(var(--color-border-rgb)/0.26)] bg-[rgb(var(--color-background-rgb)/0.14)] px-3 py-3">
                  <input
                    type="checkbox"
                    checked={Boolean((draft as any).transferEligible)}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        transferEligible: e.target.checked,
                      }))
                    }
                  />
                  <span className="text-sm text-[rgb(var(--color-text-rgb)/0.9)]">
                    Transfer eligible
                  </span>
                </div>

                {(draft as any).transferEligible ? (
                  <div>
                    <label className={UI.label}>Transfer deadline</label>
                    <input
                      type="date"
                      className={UI.input}
                      value={toDateInputValue((draft as any).transferDeadline)}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          transferDeadline: fromDateInputValue(e.target.value),
                        }))
                      }
                    />
                  </div>
                ) : null}
              </div>
            )}

            {isWorkmanship && (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={UI.label}>Coverage (years)</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    className={UI.input}
                    value={
                      typeof draft.coverageYears === "number"
                        ? draft.coverageYears
                        : ""
                    }
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        coverageYears:
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                      }))
                    }
                  />
                </div>

                <div>
                  <label className={UI.label}>Service request #</label>
                  <input
                    className={UI.input}
                    value={(draft as any).serviceRequestNumber ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        serviceRequestNumber: e.target.value,
                      }))
                    }
                    placeholder="Internal service / callback reference"
                  />
                </div>

                <div>
                  <label className={UI.label}>Install date</label>
                  <input
                    type="date"
                    className={UI.input}
                    value={toDateInputValue(draft.installDate)}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        installDate: fromDateInputValue(e.target.value),
                      }))
                    }
                  />
                </div>

                <div>
                  <label className={UI.label}>Expires</label>
                  <input
                    type="date"
                    className={UI.input}
                    value={toDateInputValue(draft.expiresAt)}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        expiresAt: fromDateInputValue(e.target.value),
                      }))
                    }
                  />
                </div>

                <div>
                  <label className={UI.label}>Repair date</label>
                  <input
                    type="date"
                    className={UI.input}
                    value={toDateInputValue(draft.repairDate)}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        repairDate: fromDateInputValue(e.target.value),
                      }))
                    }
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className={UI.label}>Covered scope</label>
                  <textarea
                    className={`${UI.textarea} min-h-[110px]`}
                    value={(draft as any).coveredScope ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        coveredScope: e.target.value,
                      }))
                    }
                    placeholder="What workmanship items are covered?"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className={UI.label}>
                    Exclusions / reporting notes
                  </label>
                  <textarea
                    className={`${UI.textarea} min-h-[110px]`}
                    value={(draft as any).exclusionsSummary ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        exclusionsSummary: e.target.value,
                      }))
                    }
                    placeholder="Abuse, improper maintenance, modification by others, notice deadlines, etc."
                  />
                </div>
              </div>
            )}

            {isThirdParty && (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={UI.label}>Administrator / program</label>
                  <input
                    className={UI.input}
                    value={draft.programName ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, programName: e.target.value }))
                    }
                    placeholder="2-10, internal admin program, etc."
                  />
                </div>

                <div>
                  <label className={UI.label}>Portal URL</label>
                  <input
                    className={UI.input}
                    value={draft.portalUrl ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, portalUrl: e.target.value }))
                    }
                    placeholder="https://…"
                  />
                </div>

                <div>
                  <label className={UI.label}>Service request #</label>
                  <input
                    className={UI.input}
                    value={(draft as any).serviceRequestNumber ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        serviceRequestNumber: e.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <label className={UI.label}>Authorization #</label>
                  <input
                    className={UI.input}
                    value={(draft as any).authorizationNumber ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        authorizationNumber: e.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <label className={UI.label}>Claim #</label>
                  <input
                    className={UI.input}
                    value={draft.claimNumber ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, claimNumber: e.target.value }))
                    }
                  />
                </div>

                <div>
                  <label className={UI.label}>Claim status</label>
                  <select
                    className={UI.select}
                    value={draft.claimStatus ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        claimStatus: (e.target.value || undefined) as
                          | "open"
                          | "pending"
                          | "approved"
                          | "denied"
                          | "closed"
                          | undefined,
                      }))
                    }
                  >
                    <option className={UI.option} value="">
                      —
                    </option>
                    <option className={UI.option} value="open">
                      Open
                    </option>
                    <option className={UI.option} value="pending">
                      Pending
                    </option>
                    <option className={UI.option} value="approved">
                      Approved
                    </option>
                    <option className={UI.option} value="denied">
                      Denied
                    </option>
                    <option className={UI.option} value="closed">
                      Closed
                    </option>
                  </select>
                </div>

                <div>
                  <label className={UI.label}>Submitted</label>
                  <input
                    type="date"
                    className={UI.input}
                    value={toDateInputValue((draft as any).submittedAt)}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        submittedAt: fromDateInputValue(e.target.value),
                      }))
                    }
                  />
                </div>

                <div>
                  <label className={UI.label}>Claim opened</label>
                  <input
                    type="date"
                    className={UI.input}
                    value={toDateInputValue((draft as any).claimOpenedAt)}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        claimOpenedAt: fromDateInputValue(e.target.value),
                      }))
                    }
                  />
                </div>

                <div>
                  <label className={UI.label}>Admin contact name</label>
                  <input
                    className={UI.input}
                    value={draft.thirdPartyAdmin?.name ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        thirdPartyAdmin: {
                          ...(d.thirdPartyAdmin ?? {}),
                          name: e.target.value,
                        },
                      }))
                    }
                  />
                </div>

                <div>
                  <label className={UI.label}>Admin phone</label>
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="(210) 555-1234"
                    className={UI.input}
                    value={formatPhoneInput(draft.thirdPartyAdmin?.phone ?? "")}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        thirdPartyAdmin: {
                          ...(d.thirdPartyAdmin ?? {}),
                          phone: cleanPhoneInput(e.target.value),
                        },
                      }))
                    }
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className={UI.label}>Admin email</label>
                  <input
                    className={UI.input}
                    value={draft.thirdPartyAdmin?.email ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        thirdPartyAdmin: {
                          ...(d.thirdPartyAdmin ?? {}),
                          email: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
              </div>
            )}

            {isInsurance && (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={UI.label}>Insurance carrier</label>
                  <input
                    className={UI.input}
                    value={draft.insuranceCarrier ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        insuranceCarrier: e.target.value,
                      }))
                    }
                    placeholder="State Farm, Travelers, Allstate…"
                  />
                </div>

                <div>
                  <label className={UI.label}>Policy #</label>
                  <input
                    className={UI.input}
                    value={draft.policyNumber ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, policyNumber: e.target.value }))
                    }
                  />
                </div>

                <div>
                  <label className={UI.label}>Claim #</label>
                  <input
                    className={UI.input}
                    value={draft.claimNumber ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, claimNumber: e.target.value }))
                    }
                  />
                </div>

                <div>
                  <label className={UI.label}>Claim status</label>
                  <select
                    className={UI.select}
                    value={draft.claimStatus ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        claimStatus: (e.target.value || undefined) as
                          | "open"
                          | "pending"
                          | "approved"
                          | "denied"
                          | "closed"
                          | undefined,
                      }))
                    }
                  >
                    <option className={UI.option} value="">
                      —
                    </option>
                    <option className={UI.option} value="open">
                      Open
                    </option>
                    <option className={UI.option} value="pending">
                      Pending
                    </option>
                    <option className={UI.option} value="approved">
                      Approved
                    </option>
                    <option className={UI.option} value="denied">
                      Denied
                    </option>
                    <option className={UI.option} value="closed">
                      Closed
                    </option>
                  </select>
                </div>

                <div>
                  <label className={UI.label}>Loss date</label>
                  <input
                    type="date"
                    className={UI.input}
                    value={toDateInputValue((draft as any).lossDate)}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        lossDate: fromDateInputValue(e.target.value),
                      }))
                    }
                  />
                </div>

                <div>
                  <label className={UI.label}>Reported date</label>
                  <input
                    type="date"
                    className={UI.input}
                    value={toDateInputValue((draft as any).reportedAt)}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        reportedAt: fromDateInputValue(e.target.value),
                      }))
                    }
                  />
                </div>

                <div>
                  <label className={UI.label}>Deductible ($)</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    className={UI.input}
                    value={
                      typeof (draft as any).deductibleCents === "number"
                        ? Math.round((draft as any).deductibleCents / 100)
                        : ""
                    }
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        deductibleCents:
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value) * 100,
                      }))
                    }
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className={UI.label}>Cause of loss</label>
                  <textarea
                    className={`${UI.textarea} min-h-[110px]`}
                    value={(draft as any).causeOfLoss ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        causeOfLoss: e.target.value,
                      }))
                    }
                    placeholder="Wind, hail, tree impact, water intrusion, etc."
                  />
                </div>

                <div>
                  <label className={UI.label}>Adjuster name</label>
                  <input
                    className={UI.input}
                    value={draft.adjuster?.name ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        adjuster: {
                          ...(d.adjuster ?? {}),
                          name: e.target.value,
                        },
                      }))
                    }
                  />
                </div>

                <div>
                  <label className={UI.label}>Adjuster phone</label>
                  <input
                    className={UI.input}
                    value={draft.adjuster?.phone ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        adjuster: {
                          ...(d.adjuster ?? {}),
                          phone: e.target.value,
                        },
                      }))
                    }
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className={UI.label}>Adjuster email</label>
                  <input
                    className={UI.input}
                    value={draft.adjuster?.email ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        adjuster: {
                          ...(d.adjuster ?? {}),
                          email: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
              </div>
            )}

            <div className="mt-5 border border-[rgb(var(--color-border-rgb)/0.22)] bg-[rgb(var(--color-background-rgb)/0.12)] px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold tracking-[0.01em] text-[rgb(var(--color-text-rgb)/0.96)]">
                    Homeowner
                  </div>
                  <div className="mt-1 text-[12px] text-[rgb(var(--color-text-rgb)/0.52)]">
                    This homeowner contact is shared across the entire job and
                    is used for all warranty packets.
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div>
                  <label className={UI.label}>Homeowner name</label>
                  <input
                    className={UI.input}
                    value={homeownerDraft.name ?? ""}
                    onChange={(e) =>
                      setHomeownerDraft((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <label className={UI.label}>Homeowner phone</label>
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="(210) 555-1234"
                    className={UI.input}
                    value={formatPhoneInput(homeownerDraft.phone ?? "")}
                    onChange={(e) =>
                      setHomeownerDraft((prev) => ({
                        ...prev,
                        phone: cleanPhoneInput(e.target.value),
                      }))
                    }
                  />
                </div>

                <div>
                  <label className={UI.label}>Homeowner email</label>
                  <input
                    className={UI.input}
                    value={homeownerDraft.email ?? ""}
                    onChange={(e) =>
                      setHomeownerDraft((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            {/* supporting photos */}
            <div className="mt-5 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold tracking-[0.01em] text-[rgb(var(--color-text-rgb)/0.96)]">
                    Supporting photos
                  </div>
                  <div className="mt-1 text-[12px] text-[rgb(var(--color-text-rgb)/0.52)]">
                    Select only the job photos that should appear in this
                    warranty packet.
                  </div>
                </div>

                {selectedWarrantyPhotoIds.length > 0 ? (
                  <div className="rounded-full border border-[rgb(var(--color-primary-rgb)/0.30)] bg-[rgb(var(--color-primary-rgb)/0.10)] px-3 py-1 text-[11px] font-semibold text-[rgb(var(--color-text-rgb)/0.92)]">
                    {selectedWarrantyPhotoIds.length} selected
                  </div>
                ) : null}
              </div>

              {availablePhotos.length === 0 ? (
                <div className="mt-3 rounded-xl border border-[rgb(var(--color-border-rgb)/0.22)] bg-[rgb(var(--color-background-rgb)/0.14)] px-3 py-3 text-sm text-[rgb(var(--color-text-rgb)/0.62)]">
                  No job photos have been uploaded yet for this job.
                </div>
              ) : (
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {availablePhotos.map((photo) => {
                    const src = safePhotoUrl(photo);
                    const selected = selectedWarrantyPhotoIds.includes(
                      photo.id
                    );

                    return (
                      <button
                        key={photo.id}
                        type="button"
                        onClick={() => toggleWarrantyPhoto(photo.id)}
                        className={[
                          "overflow-hidden rounded-xl border text-left transition",
                          selected
                            ? "border-[rgb(var(--color-primary-rgb)/0.52)] bg-[rgb(var(--color-primary-rgb)/0.12)]"
                            : "border-[rgb(var(--color-border-rgb)/0.24)] bg-[rgb(var(--color-background-rgb)/0.14)] hover:bg-[rgb(var(--color-background-rgb)/0.24)]",
                        ].join(" ")}
                      >
                        <div className="aspect-[4/3] w-full overflow-hidden bg-[rgb(var(--color-background-rgb)/0.18)]">
                          {src ? (
                            <img
                              src={src}
                              alt={photo.caption || "Job photo"}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs text-[rgb(var(--color-text-rgb)/0.45)]">
                              No image
                            </div>
                          )}
                        </div>

                        <div className="flex items-start justify-between gap-2 px-3 py-2.5">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-[rgb(var(--color-text-rgb)/0.92)]">
                              {photo.caption?.trim() || "Untitled photo"}
                            </div>
                            <div className="mt-0.5 text-[11px] text-[rgb(var(--color-text-rgb)/0.52)]">
                              {photo.id.slice(0, 8)}
                            </div>
                          </div>

                          <div
                            className={[
                              "shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide",
                              selected
                                ? "bg-[rgb(var(--color-primary-rgb)/0.18)] text-[rgb(var(--color-text-rgb)/0.96)]"
                                : "bg-[rgb(var(--color-background-rgb)/0.22)] text-[rgb(var(--color-text-rgb)/0.56)]",
                            ].join(" ")}
                          >
                            {selected ? "Included" : "Select"}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* warranty notes */}
            <div className="mt-5 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold tracking-[0.01em] text-[rgb(var(--color-text-rgb)/0.96)]">
                    Warranty notes
                  </div>
                  <div className="mt-1 text-[12px] text-[rgb(var(--color-text-rgb)/0.52)]">
                    These notes appear on the warranty packet preview.
                  </div>
                </div>

                <button
                  type="button"
                  className={UI.btnGhost}
                  onClick={() => setDraft(existing)}
                >
                  Reset
                </button>
              </div>

              <textarea
                className={`${UI.textarea} mt-3 min-h-[140px] whitespace-pre-wrap`}
                value={draft.notes ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, notes: e.target.value }))
                }
                placeholder="Write the warranty summary you want included in the warranty packet…"
              />
            </div>
          </div>

          {/* footer */}
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[rgb(var(--color-border-rgb)/0.26)] bg-[rgb(var(--color-background-rgb)/0.16)] px-5 py-4">
            <button type="button" className={UI.btnGhost} onClick={onClose}>
              Cancel
            </button>

            <button
              type="button"
              className={UI.btnGhost}
              onClick={() => void handleSave(true)}
              disabled={saving}
              title="Save warranty data and preview the warranty packet"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save & preview packet"}
            </button>

            <button
              type="button"
              className={UI.btnPrimary}
              onClick={() => void handleSave(false)}
              disabled={saving}
              title="Save warranty data"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
