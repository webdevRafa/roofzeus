import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Save, X } from "lucide-react";
import type { Job } from "../types/types";

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
export default function WarrantyEditModal({
  open,
  onClose,
  onOpenReport,
  job,
  warrantyType,
  warranty,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onOpenReport?: () => void;
  job: Job;
  warrantyType: WarrantyTypeKey;
  warranty?: WarrantyDraft | null;
  onSave: (nextWarranty: WarrantyDraft) => Promise<void>;
}) {
  const existing = useMemo<WarrantyDraft>(() => {
    return (
      warranty ?? {
        kind: warrantyType,
        status: "draft",
        manufacturer: "",
        programName: "",
        coverageYears: undefined,
        portalUrl: "",
        registrationId: "",
        claimId: "",
        claimNumber: "",
        claimStatus: undefined,
        insuranceCarrier: "",
        policyNumber: "",
        notes: "",
        installDate: null,
        repairDate: null,
        expiresAt: null,
        homeowner: { name: "", phone: "", email: "" },
        adjuster: { name: "", phone: "", email: "" },
        thirdPartyAdmin: { name: "", phone: "", email: "" },
        attachments: [],
      }
    );
  }, [warranty, warrantyType]);

  const [draft, setDraft] = useState<WarrantyDraft>(existing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(existing);
  }, [open, existing]);

  if (!open) return null;

  const hasAnything =
    Boolean(draft.notes?.trim()) ||
    Boolean(draft.manufacturer?.trim()) ||
    Boolean(draft.programName?.trim()) ||
    Boolean(draft.portalUrl?.trim()) ||
    Boolean(draft.registrationId?.trim()) ||
    Boolean(draft.claimId?.trim()) ||
    Boolean(draft.claimNumber?.trim()) ||
    Boolean(draft.insuranceCarrier?.trim()) ||
    Boolean(draft.policyNumber?.trim()) ||
    Boolean(draft.homeowner?.name?.trim()) ||
    Boolean(draft.adjuster?.name?.trim()) ||
    Boolean(draft.thirdPartyAdmin?.name?.trim());

  async function handleSave(openReport = false) {
    setSaving(true);
    try {
      await onSave({
        ...draft,
        kind: warrantyType,
      });

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
                Warranty
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

              <div>
                <label className={UI.label}>Manufacturer</label>
                <input
                  className={UI.input}
                  value={draft.manufacturer ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, manufacturer: e.target.value }))
                  }
                  placeholder="GAF, OC, CertainTeed…"
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
                  placeholder="Golden Pledge, Platinum…"
                />
              </div>

              <div>
                <label className={UI.label}>Coverage (years)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min={0}
                  step={1}
                  className={UI.input}
                  value={
                    typeof draft.coverageYears === "number"
                      ? draft.coverageYears
                      : ""
                  }
                  onKeyDown={(e) => {
                    if (["e", "E", "+", "-", "."].includes(e.key)) {
                      e.preventDefault();
                    }
                  }}
                  onChange={(e) => {
                    const val = e.target.value;

                    // allow clearing the field
                    if (val === "") {
                      setDraft((d) => ({ ...d, coverageYears: undefined }));
                      return;
                    }

                    // only allow digits
                    if (!/^\d+$/.test(val)) return;

                    setDraft((d) => ({
                      ...d,
                      coverageYears: Number(val),
                    }));
                  }}
                  placeholder="10"
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
                <label className={UI.label}>Registration ID</label>
                <input
                  className={UI.input}
                  value={draft.registrationId ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, registrationId: e.target.value }))
                  }
                />
              </div>

              <div>
                <label className={UI.label}>Claim ID</label>
                <input
                  className={UI.input}
                  value={draft.claimId ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, claimId: e.target.value }))
                  }
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
