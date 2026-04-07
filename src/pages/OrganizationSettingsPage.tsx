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
  RotateCcw,
} from "lucide-react";

import { db } from "../firebase/firebaseConfig";
import { useOrg } from "../contexts/OrgContext";
import BrandLogoModal from "../components/BrandLogoModal";
import type { Org, OrgMaterialOption, MaterialCategory } from "../types/types";

function dollarsToCents(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

function centsToDollars(value?: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return (value / 100).toFixed(2);
}

function makeCustomMaterialRow(): OrgMaterialOption {
  return {
    id: crypto.randomUUID(),
    name: "",
    unit: "",
    isActive: true,
    isPreset: false,
    sortOrder: 0,
  };
}
function makeMaterialKey(value: string): string {
  const cleaned = value
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[^a-z0-9]+(.)/g, (_, chr: string) => chr.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, "");

  return cleaned || `customMaterial${Date.now()}`;
}

const UNIT_OPTIONS = [
  "box",
  "bundle",
  "roll",
  "tube",
  "piece",
  "each",
  "bucket",
  "sheet",
] as const;

const UI = {
  section: "bg-[var(--color-background)] p-4 sm:p-5",
  input:
    "h-9 w-full rounded-lg border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.5)] px-3 text-sm text-[var(--color-text)] outline-none transition focus:ring-2 focus:ring-[var(--color-accent)]/35",
  inputBare:
    "h-9 w-full bg-transparent px-0 text-sm text-[var(--color-text)] outline-none placeholder:text-[rgb(var(--color-text-rgb)/0.4)]",
  select:
    "h-9 w-full rounded-lg border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.5)] px-3 text-sm text-[var(--color-text)] outline-none transition focus:ring-2 focus:ring-[var(--color-accent)]/35",
  checkboxWrap:
    "inline-flex h-9 items-center gap-2 rounded-lg border border-[rgb(var(--color-border-rgb)/0.16)] bg-[rgb(var(--color-surface-rgb)/0.42)] px-3 text-sm text-[var(--color-text)]/82",
  subtleText: "text-xs text-[rgb(var(--color-text-rgb)/0.56)]",
  row: "grid items-center gap-2 rounded-xl border border-[rgb(var(--color-border-rgb)/0.12)] bg-[rgb(var(--color-surface-rgb)/0.32)] px-3 py-2",
  chip: "inline-flex h-8 items-center rounded-full border border-[rgb(var(--color-border-rgb)/0.16)] bg-[rgb(var(--color-surface-rgb)/0.42)] px-3 text-[11px] font-medium text-[rgb(var(--color-text-rgb)/0.72)]",
};

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

  const PRESET_MATERIALS: Array<{
    key: MaterialCategory;
    name: string;
    unit: string;
  }> = [
    { key: "coilNails", name: "Coil Nails", unit: "box" },
    { key: "tinCaps", name: "Tin Caps", unit: "box" },
    { key: "np1Seal", name: "NP1 Seal", unit: "tube" },
    { key: "plasticJacks", name: "Plastic Jacks", unit: "each" },
    { key: "counterFlashing", name: "Counter Flashing", unit: "piece" },
    { key: "jFlashing", name: "J / L Flashing", unit: "piece" },
    { key: "rainDiverter", name: "Rain Diverter", unit: "piece" },
  ];

  function hydrateForm(next: Org | null) {
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
  }

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

        hydrateForm(next);
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

  const mergedMaterials = useMemo(() => {
    const saved = [...commonMaterials];

    const presetRows: OrgMaterialOption[] = PRESET_MATERIALS.map(
      (preset, idx) => {
        const existing = saved.find((row) => row.key === preset.key);

        return {
          id: existing?.id ?? `preset-${preset.key}`,
          key: preset.key,
          name: existing?.name?.trim() || preset.name,
          unit: existing?.unit?.trim() || preset.unit,
          isActive: existing?.isActive ?? true,
          isPreset: true,
          sortOrder: existing?.sortOrder ?? idx,
        };
      }
    );

    const customRows: OrgMaterialOption[] = saved
      .filter((row) => !PRESET_MATERIALS.some((p) => p.key === row.key))
      .map((row, idx) => ({
        ...row,
        isPreset: false,
        sortOrder: presetRows.length + idx,
      }));

    const rows = [...presetRows, ...customRows].map((row, idx) => ({
      ...row,
      sortOrder: idx,
    }));

    return {
      rows,
      allRowsForSave: rows,
      customCount: customRows.length,
    };
  }, [commonMaterials]);

  function updateMaterialRow(id: string, patch: Partial<OrgMaterialOption>) {
    setCommonMaterials((rows) =>
      rows.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  }

  function addMaterialRow() {
    setCommonMaterials((rows) => [
      ...rows,
      {
        ...makeCustomMaterialRow(),
        sortOrder: PRESET_MATERIALS.length + rows.length,
      },
    ]);
  }

  function removeMaterialRow(id: string) {
    setCommonMaterials((rows) =>
      rows
        .filter((row) => row.id !== id)
        .map((row, idx) => ({ ...row, sortOrder: idx }))
    );
  }
  function resetSettings() {
    hydrateForm(orgDoc);
    setSaveMessage(null);
  }

  async function saveSettings() {
    if (!orgId) return;
    if (!name.trim()) return;

    setSaving(true);

    try {
      const cleanedMaterials = mergedMaterials.allRowsForSave
        .map((row, idx) => {
          const key =
            typeof row.key === "string" && row.key.trim().length > 0
              ? row.key.trim()
              : row.isPreset
              ? null
              : makeMaterialKey(row.name);

          return {
            id: row.id || crypto.randomUUID(),
            ...(key ? { key } : {}),
            name: row.name.trim(),
            unit: (row.unit ?? "").trim(),
            isActive: row.isActive !== false,
            isPreset: row.isPreset === true,
            sortOrder: idx,
          };
        })
        .filter((row) => row.isPreset || row.name.length > 0);

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
    <div className="space-y-5">
      <div className="px-1 py-1">
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

          <div className="inline-flex items-center gap-2 rounded-full border border-[rgb(var(--color-border-rgb)/0.16)] bg-[rgb(var(--color-surface-rgb)/0.42)] px-3 py-2 text-xs text-[rgb(var(--color-text-rgb)/0.68)]">
            <Save className="h-3.5 w-3.5" />
            Organization settings
          </div>
        </div>

        {saveMessage ? (
          <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            {saveMessage}
          </div>
        ) : null}
      </div>

      <section className="  bg-[var(--color-background)] p-5 sm:p-6">
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

      <section className=" bg-[var(--color-background)] p-5 sm:p-6">
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

      <section className="bg-[var(--color-background)] p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-2">
          <BadgeDollarSign className="h-4 w-4 text-[var(--color-text)]/70" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text)]/80">
            Pricing Default
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

      <section className={UI.section}>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Package2 className="h-4 w-4 text-[rgb(var(--color-text-rgb)/0.7)]" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.82)]">
                Common Materials
              </h2>
            </div>
            <p className="mt-1 text-sm text-[rgb(var(--color-text-rgb)/0.6)]">
              Manage built-in material tracking and add your own recurring
              materials.
            </p>
          </div>

          <div className={UI.chip}>Shared org material settings</div>
        </div>

        <div className="bg-[var(--color-background)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-sm text-[rgb(var(--color-text-rgb)/0.58)]">
              Preset materials stay at the top. Custom materials are added into
              the same list below.
            </div>

            <div className="flex items-center gap-2">
              <span className={UI.chip}>
                {mergedMaterials.customCount} custom
              </span>

              <button
                type="button"
                onClick={addMaterialRow}
                className="inline-flex h-8 items-center gap-2 rounded-lg border border-[rgb(var(--color-border-rgb)/0.16)] bg-[rgb(var(--color-surface-rgb)/0.5)] px-3 text-sm text-[var(--color-text)] transition hover:bg-[var(--color-card-hover)]"
              >
                <Plus className="h-4 w-4" />
                Add custom
              </button>
            </div>
          </div>

          <div className="settings-scroll max-h-[420px] overflow-y-auto px-2 py-2">
            <div className="mb-2 hidden grid-cols-[minmax(0,1.2fr)_170px_92px_44px] gap-2 px-2 md:grid">
              <div className="text-[11px] font-medium uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.48)]">
                Material
              </div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.48)]">
                Unit
              </div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.48)]">
                Active
              </div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.48)]">
                Remove
              </div>
            </div>

            <div className="space-y-2">
              {mergedMaterials.rows.map((row) => (
                <div
                  key={row.id}
                  className={`${UI.row} md:grid-cols-[minmax(0,1.2fr)_170px_92px_44px]`}
                >
                  {row.isPreset ? (
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-[var(--color-text)]">
                        {row.name}
                      </div>
                    </div>
                  ) : (
                    <input
                      value={row.name}
                      onChange={(e) =>
                        updateMaterialRow(row.id, { name: e.target.value })
                      }
                      placeholder="Synthetic Underlayment"
                      className={UI.inputBare}
                    />
                  )}

                  <div>
                    {row.isPreset ? (
                      <select
                        value={row.unit ?? ""}
                        onChange={(e) =>
                          updateMaterialRow(row.id, { unit: e.target.value })
                        }
                        className={UI.select}
                      >
                        {UNIT_OPTIONS.map((unit) => (
                          <option
                            key={unit}
                            value={unit}
                            className="text-black"
                          >
                            {unit}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <>
                        <input
                          value={row.unit ?? ""}
                          onChange={(e) =>
                            updateMaterialRow(row.id, { unit: e.target.value })
                          }
                          placeholder="roll"
                          list={`unit-options-${row.id}`}
                          className={UI.inputBare}
                        />
                        <datalist id={`unit-options-${row.id}`}>
                          {UNIT_OPTIONS.map((unit) => (
                            <option key={unit} value={unit} />
                          ))}
                        </datalist>
                      </>
                    )}
                  </div>

                  <label className={UI.checkboxWrap}>
                    <input
                      type="checkbox"
                      checked={row.isActive !== false}
                      onChange={(e) =>
                        updateMaterialRow(row.id, {
                          isActive: e.target.checked,
                        })
                      }
                    />
                    <span className="text-sm">On</span>
                  </label>

                  {row.isPreset ? (
                    <div className="h-9" />
                  ) : (
                    <button
                      type="button"
                      onClick={() => removeMaterialRow(row.id)}
                      className="inline-flex h-9 w-11 items-center justify-center rounded-lg border border-red-500/18 bg-red-500/8 text-red-200 transition hover:bg-red-500/14"
                      aria-label={`Remove ${row.name || "custom material"}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="sticky bottom-4 z-20">
        <div className="mx-auto mt-4 flex w-full max-w-3xl items-center justify-between gap-3 rounded-2xl border border-[rgb(var(--color-border-rgb)/0.16)] bg-[rgb(var(--color-card-rgb)/0.92)] px-4 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur-xl">
          <div className="min-w-0">
            <div className="text-sm font-medium text-[var(--color-text)]">
              Save organization settings
            </div>
            <div className="text-xs text-[rgb(var(--color-text-rgb)/0.58)]">
              Changes to profile, defaults, branding, and materials save
              together.
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={resetSettings}
              disabled={saving}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[rgb(var(--color-border-rgb)/0.16)] bg-[rgb(var(--color-surface-rgb)/0.46)] px-4 text-sm font-medium text-[var(--color-text)] transition hover:bg-[var(--color-card-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>

            <button
              type="button"
              onClick={saveSettings}
              disabled={!canSave}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--btn-bg)] px-4 text-sm font-semibold text-[var(--btn-text)] transition hover:bg-[var(--btn-hover-bg)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      </div>

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
