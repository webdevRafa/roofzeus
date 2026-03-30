import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Save, X } from "lucide-react";
import type { Job } from "../types/types";

type WarrantyKind = NonNullable<Job["warranty"]>["kind"];
type WarrantyStatus = NonNullable<Job["warranty"]>["status"];

type WarrantyDraft = NonNullable<Job["warranty"]>;

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
    "w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card-hover)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)] outline-none shadow-sm transition focus:ring-2 focus:ring-[var(--color-accent)]",
  select:
    "w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card-hover)] px-3 py-2 text-sm text-[var(--color-text)] outline-none shadow-sm transition focus:ring-2 focus:ring-[var(--color-accent)]",
  option: "bg-[var(--color-card)] text-[var(--color-text)]",
  textarea:
    "w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card-hover)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)] outline-none shadow-sm transition focus:ring-2 focus:ring-[var(--color-accent)] resize-none",
  label: "mb-1 block text-xs text-[var(--color-muted)]",
  btnPrimary:
    "inline-flex items-center justify-center gap-2 rounded-md bg-[var(--btn-bg)] hover:bg-[var(--btn-hover-bg)] transition px-3 py-2 text-xs font-semibold text-[var(--btn-text)] shadow-sm disabled:opacity-60 disabled:cursor-not-allowed",
  btnGhost:
    "inline-flex items-center justify-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-card-hover)] hover:bg-[var(--color-surface)] transition px-3 py-2 text-xs font-semibold text-[var(--color-text)]",
  iconBtn:
    "rounded-md p-2 text-[var(--color-muted)] hover:bg-[var(--color-card-hover)] hover:text-[var(--color-text)] transition",
};

export default function WarrantyEditModal({
  open,
  onClose,
  onOpenReport,
  job,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onOpenReport?: () => void;
  job: Job;
  onSave: (nextWarranty: WarrantyDraft) => Promise<void>;
}) {
  const existing = useMemo<WarrantyDraft>(() => {
    return (
      job.warranty ?? {
        kind: "none",
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
  }, [job.warranty]);

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
      await onSave(draft);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 print:hidden">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Close"
        onClick={onClose}
      />

      <div className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-xl">
        {/* top bar */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-[var(--color-text)]">
              Warranty
            </div>
            <div className="text-xs text-[var(--color-muted)]">
              Manage warranty details and prepare the printable packet for this
              job.
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
        <div className="max-h-[calc(100vh-10rem)] overflow-y-auto p-4">
          {!hasAnything ? (
            <div className="mb-4 flex items-center gap-2  p-2 text-sm text-[var(--color-muted)]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              No warranty data saved yet.
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={UI.label}>Type</label>
              <select
                className={UI.select}
                value={draft.kind ?? "none"}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    kind: e.target.value as WarrantyKind,
                  }))
                }
              >
                <option className={UI.option} value="none">
                  None
                </option>
                <option className={UI.option} value="workmanship">
                  Workmanship
                </option>
                <option className={UI.option} value="manufacturer">
                  Manufacturer
                </option>
                <option className={UI.option} value="thirdParty">
                  3rd party
                </option>
                <option className={UI.option} value="insurance">
                  Insurance
                </option>
              </select>
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
                className={UI.input}
                value={
                  typeof draft.coverageYears === "number"
                    ? draft.coverageYears
                    : ""
                }
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    coverageYears: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  }))
                }
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
          <div className="mt-5">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-[var(--color-text)]">
                Warranty notes
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
              className={`${UI.textarea} mt-2 min-h-[120px] whitespace-pre-wrap`}
              value={draft.notes ?? ""}
              onChange={(e) =>
                setDraft((d) => ({ ...d, notes: e.target.value }))
              }
              placeholder="Write the warranty summary you want included in the External report…"
            />
            <div className="mt-2 text-xs text-[var(--color-muted)]">
              These notes show on the{" "}
              <span className="font-semibold text-[var(--color-text)]">
                External
              </span>{" "}
              report tab (no job financials).
            </div>
          </div>
        </div>

        {/* footer */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--color-border)] px-4 py-3">
          <button type="button" className={UI.btnGhost} onClick={onClose}>
            Cancel
          </button>

          <button
            type="button"
            className={UI.btnGhost}
            onClick={() => void handleSave(true)}
            disabled={saving}
            title="Save warranty data and open the report"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save & open report"}
          </button>

          <button
            type="button"
            className={UI.btnPrimary}
            onClick={() => void handleSave(false)}
            disabled={saving}
            title="Save warranty data"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save warranty"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
