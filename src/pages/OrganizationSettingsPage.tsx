import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import {
  Building2,
  Save,
  Plus,
  Trash2,
  Package2,
  BadgeDollarSign,
  Image as ImageIcon,
} from "lucide-react";

import { db } from "../firebase/firebaseConfig";
import { useOrg } from "../contexts/OrgContext";
import BrandLogoModal from "../components/BrandLogoModal";
import type { Org, OrgMaterialOption } from "../types/types";

function dollarsToCents(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

function centsToDollars(value?: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return (value / 100).toFixed(2);
}

function makeMaterialRow(): OrgMaterialOption {
  return {
    id: crypto.randomUUID(),
    label: "",
    unitLabel: "",
    isActive: true,
    sortOrder: 0,
  };
}

export default function OrganizationSettingsPage() {
  const { orgId } = useOrg();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [brandModalOpen, setBrandModalOpen] = useState(false);

  const [orgDoc, setOrgDoc] = useState<Org | null>(null);

  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [defaultState, setDefaultState] = useState("");
  const [defaultJobFee, setDefaultJobFee] = useState("");
  const [commonMaterials, setCommonMaterials] = useState<OrgMaterialOption[]>(
    []
  );
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) {
      setOrgDoc(null);
      setLoading(false);
      return;
    }

    const ref = doc(db, "organizations", orgId);

    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = snap.data() as Omit<Org, "id"> | undefined;
        const next: Org | null = data ? { id: snap.id, ...data } : null;

        setOrgDoc(next);
        setName(next?.name ?? "");
        setLegalName(next?.legalName ?? "");
        setPhone(next?.phone ?? "");
        setEmail(next?.email ?? "");
        setDefaultState((next?.defaultState ?? "").toUpperCase());
        setDefaultJobFee(centsToDollars(next?.defaultJobFeeCents));
        setCommonMaterials(
          [...(next?.commonMaterials ?? [])].sort(
            (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
          )
        );
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return () => unsub();
  }, [orgId]);

  useEffect(() => {
    if (!saveMessage) return;
    const id = window.setTimeout(() => setSaveMessage(null), 2500);
    return () => window.clearTimeout(id);
  }, [saveMessage]);

  const canSave = useMemo(() => {
    return Boolean(orgId) && name.trim().length > 0 && !saving;
  }, [orgId, name, saving]);

  function updateMaterialRow(id: string, patch: Partial<OrgMaterialOption>) {
    setCommonMaterials((rows) =>
      rows.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  }

  function addMaterialRow() {
    setCommonMaterials((rows) => [
      ...rows,
      { ...makeMaterialRow(), sortOrder: rows.length },
    ]);
  }

  function removeMaterialRow(id: string) {
    setCommonMaterials((rows) =>
      rows
        .filter((row) => row.id !== id)
        .map((row, idx) => ({ ...row, sortOrder: idx }))
    );
  }

  async function saveSettings() {
    if (!orgId) return;
    if (!name.trim()) return;

    setSaving(true);

    try {
      const cleanedMaterials = commonMaterials
        .map((row, idx) => ({
          id: row.id || crypto.randomUUID(),
          label: row.label.trim(),
          unitLabel: (row.unitLabel ?? "").trim(),
          isActive: row.isActive !== false,
          sortOrder: idx,
        }))
        .filter((row) => row.label.length > 0);

      await setDoc(
        doc(db, "organizations", orgId),
        {
          name: name.trim(),
          legalName: legalName.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          defaultState: defaultState.trim().toUpperCase() || null,
          defaultJobFeeCents: dollarsToCents(defaultJobFee),
          commonMaterials: cleanedMaterials,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setSaveMessage("Organization settings saved.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 text-[var(--color-text)]">
        Loading organization settings…
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-200">
        No organization selected.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className=" p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-[var(--color-text)]/80" />
              <h1 className="text-xl font-semibold text-[var(--color-text)]">
                Organization Settings
              </h1>
            </div>
            <p className="mt-2 text-sm text-[var(--color-text)]/65">
              Manage company branding, defaults, and shared material options for
              this organization.
            </p>
          </div>

          <button
            type="button"
            onClick={saveSettings}
            disabled={!canSave}
            className="inline-flex items-center justify-start md:justify-center gap-2 rounded-xl bg-[var(--btn-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--btn-text)] transition hover:bg-[var(--btn-hover-bg)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>

        {saveMessage ? (
          <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            {saveMessage}
          </div>
        ) : null}
      </div>

      <section className=" border border-[var(--color-border)] bg-[var(--color-card)] p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-2">
          <Building2 className="h-4 w-4 text-[var(--color-text)]/70" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text)]/80">
            Company Profile
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <div className="mb-1 text-xs text-[var(--color-text)]/65">
              Organization name
            </div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </label>

          <label className="block">
            <div className="mb-1 text-xs text-[var(--color-text)]/65">
              Legal name
            </div>
            <input
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </label>

          <label className="block">
            <div className="mb-1 text-xs text-[var(--color-text)]/65">
              Company phone
            </div>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </label>

          <label className="block">
            <div className="mb-1 text-xs text-[var(--color-text)]/65">
              Company email
            </div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </label>

          <label className="block">
            <div className="mb-1 text-xs text-[var(--color-text)]/65">
              Default state
            </div>
            <input
              value={defaultState}
              onChange={(e) => setDefaultState(e.target.value.toUpperCase())}
              maxLength={2}
              placeholder="TX"
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm uppercase text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-[var(--color-text)]/70" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text)]/80">
            Branding
          </h2>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {orgDoc?.logoUrl ? (
            <div className="h-20 w-20 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white/95 p-2">
              <img
                src={orgDoc.logoUrl}
                alt={`${orgDoc.name} logo`}
                className="h-full w-full object-contain"
              />
            </div>
          ) : (
            <div className="grid h-20 w-20 place-items-center rounded-2xl border border-dashed border-[var(--color-border)] text-xs text-[var(--color-text)]/45">
              No logo
            </div>
          )}

          <div className="space-y-2">
            <div className="text-sm text-[var(--color-text)]/70">
              Upload or replace the organization logo used across reports and
              documents.
            </div>
            <button
              type="button"
              onClick={() => setBrandModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] transition hover:bg-[var(--color-card-hover)]"
            >
              <ImageIcon className="h-4 w-4" />
              {orgDoc?.logoUrl ? "Change logo" : "Upload logo"}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-2">
          <BadgeDollarSign className="h-4 w-4 text-[var(--color-text)]/70" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text)]/80">
            Job Defaults
          </h2>
        </div>

        <label className="block max-w-sm">
          <div className="mb-1 text-xs text-[var(--color-text)]/65">
            Fixed additional fee per job
          </div>
          <input
            value={defaultJobFee}
            onChange={(e) => setDefaultJobFee(e.target.value)}
            placeholder="35.00"
            inputMode="decimal"
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
          <div className="mt-2 text-xs text-[var(--color-text)]/50">
            Stored in cents on the org doc. This is not wired into job pricing
            yet — this page sets the source of truth first.
          </div>
        </label>
      </section>

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Package2 className="h-4 w-4 text-[var(--color-text)]/70" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text)]/80">
              Common Materials
            </h2>
          </div>

          <button
            type="button"
            onClick={addMaterialRow}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] transition hover:bg-[var(--color-card-hover)]"
          >
            <Plus className="h-4 w-4" />
            Add material
          </button>
        </div>

        <div className="space-y-3">
          {commonMaterials.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--color-border)] px-4 py-5 text-sm text-[var(--color-text)]/55">
              No custom common materials yet. Add items like Synthetic
              Underlayment, Ridge Cap, Drip Edge, Dumpster, or Ice & Water
              Shield.
            </div>
          ) : (
            commonMaterials.map((row) => (
              <div
                key={row.id}
                className="grid gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/55 p-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_auto_auto]"
              >
                <label className="block">
                  <div className="mb-1 text-xs text-[var(--color-text)]/60">
                    Label
                  </div>
                  <input
                    value={row.label}
                    onChange={(e) =>
                      updateMaterialRow(row.id, { label: e.target.value })
                    }
                    placeholder="Synthetic Underlayment"
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 text-sm text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                  />
                </label>

                <label className="block">
                  <div className="mb-1 text-xs text-[var(--color-text)]/60">
                    Unit label
                  </div>
                  <input
                    value={row.unitLabel ?? ""}
                    onChange={(e) =>
                      updateMaterialRow(row.id, { unitLabel: e.target.value })
                    }
                    placeholder="roll"
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 text-sm text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                  />
                </label>

                <label className="flex items-end gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={row.isActive !== false}
                    onChange={(e) =>
                      updateMaterialRow(row.id, { isActive: e.target.checked })
                    }
                  />
                  <span className="text-sm text-[var(--color-text)]/80">
                    Active
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => removeMaterialRow(row.id)}
                  className="inline-flex items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-200 transition hover:bg-red-500/15"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      {brandModalOpen && orgId && (
        <BrandLogoModal
          orgId={orgId}
          currentLogoUrl={orgDoc?.logoUrl ?? undefined}
          onClose={() => setBrandModalOpen(false)}
        />
      )}
    </div>
  );
}
