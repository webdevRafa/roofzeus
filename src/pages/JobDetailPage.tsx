// src/pages/JobDetailPage.tsx
// NOTE: This page uses framer-motion and react-countup.
// Install:  npm i framer-motion react-countup lucide-react
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Link, useParams, useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  FieldValue,
  deleteDoc,
  query,
  limit,
  deleteField,
  where,
  orderBy,
} from "firebase/firestore";
import {
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Camera,
  Image as ImageIcon,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  UserRound,
  Hammer,
  Layers3,
  Calculator,
  MapPin,
  Building2,
} from "lucide-react";
import { MdArrowBackIos } from "react-icons/md";

import { getStorage, ref as storageRef, uploadBytes } from "firebase/storage";
import { motion, AnimatePresence, type MotionProps } from "framer-motion";
import CountUp from "react-countup";
import { Pencil } from "lucide-react";
import InvoiceCreateModal from "../components/InvoiceCreateModal";
import WarrantyReportModal from "../components/WarrantyReportModal";
import WarrantyEditModal from "../components/WarrantyEditModal";
import WarrantyCenterModal from "../components/WarrantyCenterModal";

import JobReportModal from "../components/JobReportModal";
import { db } from "../firebase/firebaseConfig";
import type {
  Job,
  Payout,
  MaterialExpense,
  Note,
  JobStatus,
  MaterialCategory,
  Employee,
  PayoutDoc,
  Org,
  OrgMaterialOption,
  WarrantyTypeKey,
  ContactInfo,
  BillingRecipient,
} from "../types/types";

import { jobConverter } from "../types/types";
import { toCents } from "../utils/money";
import { recomputeJob } from "../utils/calc";
import { useOrg } from "../contexts/OrgContext";

// ---------- Animation helpers ----------
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const BILLING_RECIPIENT_OPTIONS: Array<{
  value: BillingRecipient;
  label: string;
  description: string;
}> = [
  {
    value: "homeowner",
    label: "Homeowner",
    description: "Use the homeowner contact saved on this job.",
  },
  {
    value: "builder",
    label: "Builder / GC",
    description:
      "Use this for builder, general contractor, or company billing.",
  },
  {
    value: "insurance",
    label: "Insurance / Adjuster",
    description: "Use this when billing an insurance contact or adjuster.",
  },
  {
    value: "other",
    label: "Other",
    description:
      "Use this for third-party, property manager, or custom billing.",
  },
];

function billingRecipientLabel(value: BillingRecipient | undefined) {
  if (value === "builder") return "Builder / GC";
  if (value === "insurance") return "Insurance / Adjuster";
  if (value === "other") return "Other";
  return "Homeowner";
}

const fadeUp = (delay = 0): Partial<MotionProps> => ({
  initial: { opacity: 0, y: 12, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  transition: { duration: 0.42, ease: EASE, delay },
});

const toastAnim: MotionProps = {
  initial: { opacity: 0, y: -20, scale: 0.96, filter: "blur(6px)" },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 0.35, ease: EASE },
  },
  exit: {
    opacity: 0,
    y: -12,
    scale: 0.98,
    filter: "blur(4px)",
    transition: { duration: 0.2, ease: EASE },
  },
};

const item: MotionProps["variants"] = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

const scheduleCardMotion = (delay = 0): Partial<MotionProps> => ({
  initial: { opacity: 0, y: 18, scale: 0.985, filter: "blur(8px)" },
  animate: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
  transition: { duration: 0.46, ease: EASE, delay },
});

function statusClasses(status: JobStatus) {
  switch (status) {
    case "active":
      return "bg-[var(--color-primary)]/15 text-[var(--color-primary)]";
    case "pending":
      return "bg-yellow-500/15 text-yellow-200";
    case "invoiced":
      return "bg-blue-500/15 text-blue-200";
    case "paid":
      return "bg-emerald-500/15 text-emerald-200";
    case "completed": // ← NEW
      return "bg-emerald-500/15 text-emerald-200";
    case "closed":
      return "bg-[var(--color-surface)]/35/10 text-white/70";
    case "archived":
      return "bg-[var(--color-surface)]/35/10 text-white/70";
    case "draft":
    default:
      return "bg-[var(--color-surface)]/35/10 text-white/70";
  }
}

// ---------- Money display ----------
function CountMoney({
  cents,
  className = "",
}: {
  cents: number;
  className?: string;
}) {
  const dollars = (cents ?? 0) / 100;
  return (
    <span className={className}>
      <CountUp
        key={cents}
        end={dollars}
        decimals={2}
        prefix="$"
        duration={0.6}
      />
    </span>
  );
}
type JobPhoto = {
  id: string;
  orgId: string;
  jobId: string;

  // URLs written by your Cloud Function
  thumbUrl?: string;
  previewUrl?: string; // (optional, if you generate it)
  fullUrl?: string;

  // Back-compat / fallback
  url?: string;

  // Storage paths (so delete cleanup knows what to delete)
  thumbPath?: string;
  previewPath?: string;
  fullPath?: string;

  caption?: string;
  createdAt?: Timestamp | Date | FieldValue | null;
};

type ActivityKind = "payout" | "material" | "note" | "photo";

type ActivityItem = {
  id: string;
  kind: ActivityKind;
  at: Date; // normalized timestamp
  title: string; // bold-ish line
  detail?: string; // optional second line
  // ✅ for photo preview rows
  photoUrl?: string;
  photoCaption?: string;
};

type WarrantyDraft = NonNullable<Job["warranty"]>;
type WarrantyRecord = Partial<Record<WarrantyTypeKey, WarrantyDraft>>;

const WARRANTY_TYPES: WarrantyTypeKey[] = [
  "workmanship",
  "manufacturer",
  "thirdParty",
  "insurance",
];

function toDateSafe(d: any): Date | null {
  if (!d) return null;
  // Firestore Timestamp
  if (typeof d?.toDate === "function") return d.toDate();
  // JS Date
  if (d instanceof Date) return d;
  return null;
}

// ---------- Timestamp helpers ----------
type FsTimestampLike = { toDate: () => Date };
function isFsTimestamp(x: unknown): x is FsTimestampLike {
  return typeof (x as FsTimestampLike)?.toDate === "function";
}
function toMillis(x: unknown): number | null {
  if (x == null) return null;
  let d: Date | null = null;
  if (isFsTimestamp(x)) d = x.toDate();
  else if (x instanceof Date) d = x;
  else if (typeof x === "string" || typeof x === "number") {
    const parsed = new Date(x);
    if (!Number.isNaN(parsed.getTime())) d = parsed;
  }
  return d ? d.getTime() : null;
}
function fmtDate(x: unknown): string {
  const ms = toMillis(x);
  return ms == null ? "—" : new Date(ms).toLocaleString();
}
function toYMD(x: unknown): string {
  const ms = toMillis(x);
  if (ms == null) return "";
  const d = new Date(ms);
  return d.toISOString().slice(0, 10);
}

const FALLBACK_JOB_FEE_CENTS = 3500;

function normalizeJobFeeCents(
  value: unknown,
  fallback = FALLBACK_JOB_FEE_CENTS
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.round(value));
}

function calculateJobBasePayCents(
  sqft: number,
  ratePerSqFt: number,
  feeCents: number
): number {
  const safeSqft = Math.max(0, Number(sqft) || 0);
  const safeRate = Math.max(0, Number(ratePerSqFt) || 0);
  const safeFeeCents = normalizeJobFeeCents(feeCents, 0);

  return Math.round(safeSqft * safeRate * 100) + safeFeeCents;
}

function formatFeeLabel(feeCents: number): string {
  return (normalizeJobFeeCents(feeCents, 0) / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

function fmtLongDate(x: unknown): string {
  const ms = toMillis(x);
  if (ms == null) return "—";
  return new Date(ms).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

type MaterialDraft = {
  category: MaterialCategory | string;
  unitPrice: string;
  quantity: string;
  vendor?: string;
  isCommitted: boolean;
};

const blankMaterial = (): MaterialDraft => ({
  category: "coilNails",
  unitPrice: "",
  quantity: "",
  vendor: "",
  isCommitted: false,
});

const PRESET_MATERIAL_OPTIONS: Array<{
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

function humanizeMaterialKey(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\bNp1\b/i, "NP1")
    .replace(/\bJl\b/i, "J / L")
    .trim();
}

function formatMaterialUnit(unit?: string | null) {
  if (!unit) return "";
  return unit.trim().toLowerCase();
}
function formatMaterialQuantityLabel(quantity: number, unit?: string | null) {
  const qty = Number(quantity) || 0;
  const normalizedUnit = formatMaterialUnit(unit);

  if (!normalizedUnit) return `Qty ${qty}`;

  if (normalizedUnit === "each") {
    return qty === 1 ? "1 each" : `${qty} each`;
  }

  if (normalizedUnit === "box") {
    return qty === 1 ? "1 box" : `${qty} boxes`;
  }

  if (normalizedUnit === "piece") {
    return qty === 1 ? "1 piece" : `${qty} pieces`;
  }

  if (normalizedUnit === "tube") {
    return qty === 1 ? "1 tube" : `${qty} tubes`;
  }

  return qty === 1 ? `1 ${normalizedUnit}` : `${qty} ${normalizedUnit}s`;
}

function resolveOrgMaterialKey(row: OrgMaterialOption): string {
  if (typeof row.key === "string" && row.key.trim().length > 0) {
    return row.key.trim();
  }

  const fromName = row.name?.trim();
  if (fromName) {
    return fromName
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .toLowerCase()
      .replace(/[^a-z0-9]+(.)/g, (_, chr: string) => chr.toUpperCase())
      .replace(/[^a-zA-Z0-9]/g, "");
  }

  return row.id;
}

function materialLineTotal(d: MaterialDraft) {
  const unit = Number(d.unitPrice) || 0;
  const qty = Number(d.quantity) || 0;
  return unit * qty;
}

function materialLineCanSubmit(d: MaterialDraft) {
  return (Number(d.unitPrice) || 0) > 0 && (Number(d.quantity) || 0) > 0;
}

function normalizeCommonRatesPerSq(value: unknown): number[] {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((rate) => Number(rate))
        .filter((rate) => Number.isFinite(rate) && rate > 0)
    )
  ).sort((a, b) => a - b);
}

function buildMaterialDraftPreview(
  draft: MaterialDraft,
  index: number,
  getName: (category: string) => string,
  getUnit: (category: string) => string
): MaterialExpense {
  const qty = Math.max(0, Math.floor(Number(draft.quantity) || 0));
  const unitCents = toCents(Number(draft.unitPrice) || 0);
  const vendor = (draft.vendor || "").trim();
  const resolvedUnit = getUnit(draft.category);

  return {
    id: `draft-${index}`,
    category: draft.category,
    materialKey: draft.category,
    labelSnapshot: getName(draft.category),
    unitSnapshot: resolvedUnit,
    unitPriceCents: unitCents,
    quantity: qty,
    amountCents: unitCents * qty,
    ...(vendor ? { vendor } : {}),
    createdAt: Timestamp.now(),
  };
}

type JobDetailPageProps = {
  /**
   * Optional jobId override (for rendering this page as an embedded component/modal).
   * If not provided, falls back to the route param (:id).
   */
  jobId?: string;
  /**
   * Optional close handler for embedded/modal usage.
   * If provided, the header will show a Close button and call this.
   */
  onClose?: () => void;
  /**
   * Visual mode. "page" keeps original route-page behavior; "modal" swaps header back-link for close.
   */
  variant?: "page" | "modal";
};

export default function JobDetailPage({
  jobId,
  onClose,
  variant = "page",
}: JobDetailPageProps) {
  const { id: routeJobId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const resolvedJobId = jobId ?? routeJobId;
  const isModal = variant === "modal" || typeof onClose === "function";
  const handleClose = () => {
    if (onClose) return onClose();
    navigate(-1);
  };

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [warrantyCenterOpen, setWarrantyCenterOpen] = useState(false);
  const [warrantyReportOpen, setWarrantyReportOpen] = useState(false);
  const [warrantyEditOpen, setWarrantyEditOpen] = useState(false);
  const [activeWarrantyType, setActiveWarrantyType] =
    useState<WarrantyTypeKey | null>(null);
  const [jobReportOpen, setJobReportOpen] = useState(false);

  const [summaryNotesOpen, setSummaryNotesOpen] = useState(false);
  const [summaryNotesDraft, setSummaryNotesDraft] = useState("");

  const [homeownerOpen, setHomeownerOpen] = useState(false);
  const [homeownerSaving, setHomeownerSaving] = useState(false);
  const [homeownerDraft, setHomeownerDraft] = useState<ContactInfo>({
    name: "",
    phone: "",
    email: "",
  });

  const [billingOpen, setBillingOpen] = useState(false);
  const [billingSaving, setBillingSaving] = useState(false);
  const [billingRecipientDraft, setBillingRecipientDraft] =
    useState<BillingRecipient>("homeowner");

  const [billingContactDraft, setBillingContactDraft] = useState<ContactInfo>({
    companyName: "",
    name: "",
    phone: "",
    email: "",
    mailingAddress: {
      line1: "",
      city: "",
      state: "",
      zip: "",
    },
  });

  const [payoutDocs, setPayoutDocs] = useState<PayoutDoc[]>([]);

  const [photos, setPhotos] = useState<JobPhoto[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [orgMaterials, setOrgMaterials] = useState<OrgMaterialOption[]>([]);

  const [schedulePunchOpen, setSchedulePunchOpen] = useState(false);
  const [schedulePunchDate, setSchedulePunchDate] = useState<string>("");
  const [confirmPunchedOpen, setConfirmPunchedOpen] = useState(false);
  const [confirmUndoPunchOpen, setConfirmUndoPunchOpen] = useState(false);

  // Delete job confirmation modal
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deletingJob, setDeletingJob] = useState(false);

  const sections = [
    "Schedule",
    "Pricing",
    "Overview",
    "Activity",
    "Payouts",
    "Materials",
    "Notes",
    "Photos",
  ];

  const [editPayoutModalOpen, setEditPayoutModalOpen] = useState(false);
  const [editingPayoutId, setEditingPayoutId] = useState<string | null>(null);

  const [editPayoutCategory, setEditPayoutCategory] = useState<
    "shingles" | "felt"
  >("shingles");
  const [editPayoutSqft, setEditPayoutSqft] = useState("");
  const [editPayoutRate, setEditPayoutRate] = useState("");

  const [activeSection, setActiveSection] =
    useState<(typeof sections)[number]>("Schedule");

  const [showMobileSectionNav, setShowMobileSectionNav] = useState(true);

  const [payoutModalOpen, setPayoutModalOpen] = useState(false);
  const [materialModalOpen, setMaterialModalOpen] = useState(false);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);

  // Felt / shingles scheduling controls
  const [feltScheduleEditing, setFeltScheduleEditing] = useState(false);
  const [feltScheduleDate, setFeltScheduleDate] = useState<string>("");

  const [shinglesScheduleEditing, setShinglesScheduleEditing] = useState(false);
  const [shinglesScheduleDate, setShinglesScheduleDate] = useState<string>("");

  // Confirm "mark done" modals for felt / shingles
  const [confirmFeltDoneOpen, setConfirmFeltDoneOpen] = useState(false);
  const [confirmShinglesDoneOpen, setConfirmShinglesDoneOpen] = useState(false);

  // --- Flashing (C/J/L) Pay (earnings add-on) ---
  const [flashingUnits, setFlashingUnits] = useState("1");
  const [flashingUnitPrice, setFlashingUnitPrice] = useState("0"); // dollars per unit
  const [flashingModalOpen, setFlashingModalOpen] = useState(false);

  const [materialDrafts, setMaterialDrafts] = useState<MaterialDraft[]>([]);
  const [expandedMaterialIndex, setExpandedMaterialIndex] = useState<
    number | null
  >(null);

  const anyMaterialValid = useMemo(
    () => materialDrafts.some((d) => d.isCommitted && materialLineCanSubmit(d)),
    [materialDrafts]
  );

  const materialsGrandTotal = useMemo(
    () =>
      materialDrafts.reduce(
        (sum, d) =>
          d.isCommitted && materialLineCanSubmit(d)
            ? sum + materialLineTotal(d)
            : sum,
        0
      ),
    [materialDrafts]
  );

  const { orgId, loading: orgLoading } = useOrg();

  // ✅ Global job doc ref (usable by any function)
  const jobDocRef = useMemo(() => {
    if (!resolvedJobId) return null;
    if (!orgId) return null; // ✅ org not ready yet
    return doc(db, "organizations", orgId, "jobs", resolvedJobId);
  }, [resolvedJobId, orgId]);

  const employeesColRef = useMemo(() => {
    if (!orgId) return null;
    return collection(db, "organizations", orgId, "employees");
  }, [orgId]);

  const payoutsColRef = useMemo(() => {
    if (!orgId) return null;
    return collection(db, "organizations", orgId, "payouts");
  }, [orgId]);

  const jobPhotosColRef = useMemo(() => {
    if (!orgId) return null;
    return collection(db, "organizations", orgId, "jobPhotos");
  }, [orgId]);

  const [commonRatesPerSq, setCommonRatesPerSq] = useState<number[]>([]);
  const [rateSavePrompt, setRateSavePrompt] = useState<number | null>(null);
  const [savingCommonRate, setSavingCommonRate] = useState(false);

  useEffect(() => {
    if (orgLoading || !orgId) {
      setCommonRatesPerSq([]);
      return;
    }

    const orgRef = doc(db, "organizations", orgId);

    const unsub = onSnapshot(
      orgRef,
      (snap) => {
        const data = snap.data();
        setCommonRatesPerSq(normalizeCommonRatesPerSq(data?.commonRatesPerSq));
      },
      (err) => {
        console.error("Failed to load organization common rates", err);
        setCommonRatesPerSq([]);
      }
    );

    return () => unsub();
  }, [orgId, orgLoading]);

  async function saveRateToOrgSettings(rateToSave: number) {
    if (!orgId) return;

    const cleanRate = Number(rateToSave);

    if (!Number.isFinite(cleanRate) || cleanRate <= 0) return;

    const nextRates = normalizeCommonRatesPerSq([
      ...commonRatesPerSq,
      cleanRate,
    ]);

    try {
      setSavingCommonRate(true);

      await setDoc(
        doc(db, "organizations", orgId),
        {
          commonRatesPerSq: nextRates,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setRateSavePrompt(null);

      setToast({
        status: "success",
        title: "Common rate saved",
        message: `$${cleanRate}/SQ was added to this organization's pricing settings.`,
      });
    } catch (err) {
      console.error("Failed to save common rate", err);

      setToast({
        status: "error",
        title: "Could not save rate",
        message:
          "The rate was applied to this job, but it was not saved to organization settings.",
      });
    } finally {
      setSavingCommonRate(false);
    }
  }

  const [orgDefaultJobFeeCents, setOrgDefaultJobFeeCents] = useState(
    FALLBACK_JOB_FEE_CENTS
  );

  useEffect(() => {
    if (orgLoading || !orgId) {
      setOrgDefaultJobFeeCents(FALLBACK_JOB_FEE_CENTS);
      return;
    }

    const orgRef = doc(db, "organizations", orgId);

    const unsub = onSnapshot(
      orgRef,
      (snap) => {
        const rawFee = snap.data()?.defaultJobFeeCents;
        setOrgDefaultJobFeeCents(
          normalizeJobFeeCents(rawFee, FALLBACK_JOB_FEE_CENTS)
        );
      },
      (err) => {
        console.error("Failed to load organization pricing default", err);
        setOrgDefaultJobFeeCents(FALLBACK_JOB_FEE_CENTS);
      }
    );

    return () => unsub();
  }, [orgId, orgLoading]);

  const effectiveJobFeeCents = orgDefaultJobFeeCents;
  const effectiveJobFeeLabel = formatFeeLabel(effectiveJobFeeCents);

  // When mounted as a modal/component, jobId may be passed via props.
  // When used as a route page, routeJobId comes from the URL.
  if (!resolvedJobId) {
    return (
      <div className="p-8 text-red-600">
        Missing job id. Navigate to a job route or pass <code>jobId</code> prop.
      </div>
    );
  }

  if (orgLoading) {
    return <div className="p-8 text-white/70">Loading organization…</div>;
  }

  if (!orgId) {
    return (
      <div className="p-8 text-red-600">
        No organization selected. Please re-login or select an organization.
      </div>
    );
  }
  const prefillFlashingInputs = () => {
    const fp = job?.earnings?.flashingPay;

    if (fp) {
      setFlashingUnits(String(fp.units ?? 1));
      setFlashingUnitPrice(String((fp.unitPriceCents ?? 0) / 100)); // dollars
    } else {
      // defaults when no flashing pay exists yet
      setFlashingUnits("1");
      setFlashingUnitPrice("0");
    }
  };

  const flashingAmountCentsPreview = useMemo(() => {
    const units = Math.max(0, Number(flashingUnits) || 0);
    const unitCents = Math.round(
      Math.max(0, Number(flashingUnitPrice) || 0) * 100
    );
    return units * unitCents;
  }, [flashingUnits, flashingUnitPrice]);

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.isActive !== false),
    [employees]
  );

  const materialOptions = useMemo(() => {
    const presetMap = new Map(
      PRESET_MATERIAL_OPTIONS.map((row) => [row.key, row])
    );

    const presetRows = PRESET_MATERIAL_OPTIONS.map((preset) => {
      const orgOverride = orgMaterials.find((row) => row.key === preset.key);

      return {
        key: preset.key,
        name: orgOverride?.name?.trim() || preset.name,
        unit: orgOverride?.unit?.trim() || preset.unit,
        isPreset: true,
      };
    });

    const customRows = orgMaterials
      .map((row) => {
        const resolvedKey = resolveOrgMaterialKey(row);

        return {
          key: resolvedKey,
          name: row.name?.trim() || humanizeMaterialKey(resolvedKey),
          unit: row.unit?.trim() || "",
          isPreset: false,
        };
      })
      .filter((row) => !presetMap.has(row.key as MaterialCategory));

    return [...presetRows, ...customRows];
  }, [orgMaterials]);

  const materialOptionsByKey = useMemo(() => {
    return new Map(materialOptions.map((row) => [row.key, row]));
  }, [materialOptions]);

  function getMaterialOptionName(category: string) {
    return (
      materialOptionsByKey.get(category)?.name || humanizeMaterialKey(category)
    );
  }

  function getMaterialOptionUnit(category: string) {
    return formatMaterialUnit(materialOptionsByKey.get(category)?.unit);
  }

  const materialDraftPreviewItems = useMemo(() => {
    return materialDrafts
      .filter((draft) => draft.isCommitted && materialLineCanSubmit(draft))
      .map((draft, index) =>
        buildMaterialDraftPreview(
          draft,
          index,
          getMaterialOptionName,
          getMaterialOptionUnit
        )
      );
  }, [materialDrafts, materialOptionsByKey]);

  function getMaterialDisplayName(material: MaterialExpense) {
    const snapshot = material.labelSnapshot?.trim();
    if (snapshot) return snapshot;

    return getMaterialOptionName(material.category);
  }

  function getMaterialDisplayUnit(material: MaterialExpense) {
    const snapshot = material.unitSnapshot?.trim();
    if (snapshot) return formatMaterialUnit(snapshot);

    return getMaterialOptionUnit(material.category);
  }

  const UI = {
    input:
      "h-10 w-full min-w-0  border border-[var(--color-border)] bg-[var(--color-surface)]/35 px-3 text-sm text-[var(--color-text)] outline-none " +
      "focus:ring-2 focus:ring-[var(--color-accent)]/70 shadow-sm",
    textarea:
      "w-full min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/35 px-4 py-3 text-sm leading-6 " +
      "outline-none shadow-sm focus:ring-1 focus:ring-[var(--color-accent)] " +
      "placeholder:text-[var(--color-muted)] resize-none",

    select:
      "h-11 w-full min-w-0  border border-[var(--color-border)] bg-[var(--color-card)] px-3 pr-10 text-sm text-[var(--color-text)] outline-none shadow-sm transition " +
      "hover:bg-[var(--color-card-hover)] focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)] appearance-none cursor-pointer",
    btnPrimary:
      "h-8 inline-flex items-center justify-center rounded-md bg-[var(--color-card-hover)] text-[var(--color-text)]/85 hover:text-[var(--color-text)] cursor-pointer px-2 text-xs font-medium " +
      "text-[var(--btn-text)] shadow-sm  transition disabled:opacity-60 disabled:cursor-not-allowed",
    btnSoft:
      "h-8 inline-flex items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/35 px-2 text-xs " +
      "font-medium text-[var(--color-text)] shadow-sm hover:bg-[var(--color-card-hover)] transition",
    btnDangerSm:
      "rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/35 px-2 py-1 text-xs text-[var(--color-muted)] " +
      "hover:bg-[var(--color-card-hover)]",
  } as const;

  function openEditPayoutModal(p: Payout) {
    setEditingPayoutId(p.id);
    setEditPayoutCategory(p.category === "felt" ? "felt" : "shingles");
    setEditPayoutSqft(typeof p.sqft === "number" ? String(p.sqft) : "");
    setEditPayoutRate(
      typeof p.ratePerSqFt === "number" ? String(p.ratePerSqFt) : ""
    );
    setEditPayoutModalOpen(true);
  }

  const LIST_MAX_H = "max-h-[300px]"; // tweak to taste

  // Lightbox state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  function openViewer(idx: number) {
    setViewerIndex(idx);
    setViewerOpen(true);
  }
  function closeViewer() {
    setViewerOpen(false);
  }
  function prevPhoto() {
    if (photos.length === 0) return;
    setViewerIndex((i) => (i - 1 + photos.length) % photos.length);
  }
  function nextPhoto() {
    if (photos.length === 0) return;
    setViewerIndex((i) => (i + 1) % photos.length);
  }
  function addLineToList() {
    if (materialDrafts.length === 0) {
      setMaterialDrafts([blankMaterial()]);
      setExpandedMaterialIndex(0);
      return;
    }

    const openIndex = getOpenMaterialDraftIndex(materialDrafts);

    if (openIndex >= 0) {
      const openDraft = materialDrafts[openIndex];

      if (!materialLineCanSubmit(openDraft)) {
        setExpandedMaterialIndex(openIndex);
        return;
      }

      const nextIndex = materialDrafts.length;

      setMaterialDrafts((current) => [
        ...current.map((row, i) =>
          i === openIndex ? { ...row, isCommitted: true } : row
        ),
        blankMaterial(),
      ]);

      setExpandedMaterialIndex(nextIndex);
      return;
    }

    const nextIndex = materialDrafts.length;
    setMaterialDrafts((current) => [...current, blankMaterial()]);
    setExpandedMaterialIndex(nextIndex);
  }

  function beginEditingLine(idx: number) {
    setMaterialDrafts((current) =>
      current.map((row, i) =>
        i === idx ? { ...row, isCommitted: false } : row
      )
    );
    setExpandedMaterialIndex(idx);
  }

  function finishEditingLine(idx: number) {
    const row = materialDrafts[idx];
    if (!row || !materialLineCanSubmit(row)) {
      setExpandedMaterialIndex(idx);
      return;
    }

    setMaterialDrafts((current) =>
      current.map((draft, i) =>
        i === idx ? { ...draft, isCommitted: true } : draft
      )
    );
    setExpandedMaterialIndex(null);
  }

  function getOpenMaterialDraftIndex(rows: MaterialDraft[]) {
    return rows.findIndex((row) => !row.isCommitted);
  }

  function updateLine<K extends keyof MaterialDraft>(
    idx: number,
    key: K,
    value: MaterialDraft[K]
  ) {
    setMaterialDrafts((s) =>
      s.map((row, i) =>
        i === idx ? { ...row, [key]: value, isCommitted: false } : row
      )
    );
  }

  function removeLineFromList(idx: number) {
    setMaterialDrafts((current) => {
      const next = current.filter((_, i) => i !== idx);

      setExpandedMaterialIndex((prev) => {
        if (next.length === 0) return null;
        if (prev == null) return next.length - 1;
        if (prev === idx) return Math.min(idx, next.length - 1);
        if (prev > idx) return prev - 1;
        return prev;
      });

      return next;
    });
  }
  function clearLines() {
    setMaterialDrafts([]);
    setExpandedMaterialIndex(null);
  }
  async function saveFlashingPay() {
    if (!job) return;

    const units = Math.max(0, Number(flashingUnits) || 0);
    const unit = Math.max(0, Number(flashingUnitPrice) || 0);

    // base pay from CURRENT pricing on job
    const sqft = job.pricing?.sqft ?? 0;
    const rate = (job.pricing?.ratePerSqFt as 31 | 35) ?? 31;
    const basePayCents = calculateJobBasePayCents(
      sqft,
      rate,
      effectiveJobFeeCents
    );

    // If user zeros it out, treat as "clear"
    if (units <= 0 || unit <= 0) {
      await saveJob({
        ...job,
        earnings: {
          ...(job.earnings ?? {}),
          flashingPay: deleteField() as any,
          totalEarningsCents: basePayCents,
        },
      });
      return;
    }

    const unitPriceCents = Math.round(unit * 100);
    const amountCents = units * unitPriceCents;

    const flashingPay = {
      units,
      unitPriceCents,
      amountCents,
      updatedAt: Timestamp.now(), // IMPORTANT: NOT serverTimestamp (keeps it simple)
    };

    await saveJob({
      ...job,
      earnings: {
        ...(job.earnings ?? {}),
        flashingPay,
        totalEarningsCents: basePayCents + amountCents,
      },
    });
  }

  function toOptionalOrDelete(v: unknown) {
    if (typeof v !== "string") return deleteField();
    const t = v.trim();
    return t.length ? t : deleteField();
  }

  function cleanPhoneInput(value: string): string {
    return value.replace(/\D/g, "").slice(0, 10);
  }

  function formatPhoneInput(value: string): string {
    const digits = cleanPhoneInput(value);

    if (digits.length <= 3) return digits;
    if (digits.length <= 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    }

    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  function toContactOrDelete(contact?: ContactInfo | null) {
    const name = typeof contact?.name === "string" ? contact.name.trim() : "";
    const phone =
      typeof contact?.phone === "string" ? cleanPhoneInput(contact.phone) : "";
    const email =
      typeof contact?.email === "string" ? contact.email.trim() : "";

    if (!name && !phone && !email) return deleteField();

    return {
      ...(name ? { name } : {}),
      ...(phone ? { phone } : {}),
      ...(email ? { email } : {}),
    };
  }

  function toBillingContactOrDelete(contact?: ContactInfo | null) {
    const companyName =
      typeof contact?.companyName === "string"
        ? contact.companyName.trim()
        : "";

    const name = typeof contact?.name === "string" ? contact.name.trim() : "";
    const phone =
      typeof contact?.phone === "string" ? cleanPhoneInput(contact.phone) : "";
    const email =
      typeof contact?.email === "string" ? contact.email.trim() : "";

    const mailing = contact?.mailingAddress ?? null;

    const line1 =
      typeof mailing?.line1 === "string" ? mailing.line1.trim() : "";
    const city = typeof mailing?.city === "string" ? mailing.city.trim() : "";
    const state =
      typeof mailing?.state === "string" ? mailing.state.trim() : "";
    const zip = typeof mailing?.zip === "string" ? mailing.zip.trim() : "";

    const hasMailingAddress = Boolean(line1 || city || state || zip);

    if (!companyName && !name && !phone && !email && !hasMailingAddress) {
      return deleteField();
    }

    return {
      ...(companyName ? { companyName } : {}),
      ...(name ? { name } : {}),
      ...(phone ? { phone } : {}),
      ...(email ? { email } : {}),
      ...(hasMailingAddress
        ? {
            mailingAddress: {
              ...(line1 ? { line1, fullLine: line1 } : {}),
              ...(city ? { city } : {}),
              ...(state ? { state } : {}),
              ...(zip ? { zip } : {}),
            },
          }
        : {}),
    };
  }

  function contactDraftFromInfo(contact?: ContactInfo | null): ContactInfo {
    return {
      companyName: contact?.companyName ?? "",
      name: contact?.name ?? "",
      phone: contact?.phone ?? "",
      email: contact?.email ?? "",
      mailingAddress: {
        line1:
          contact?.mailingAddress?.line1 ??
          contact?.mailingAddress?.fullLine ??
          "",
        city: contact?.mailingAddress?.city ?? "",
        state: contact?.mailingAddress?.state ?? "",
        zip: contact?.mailingAddress?.zip ?? "",
      },
    };
  }

  function billingContactDraftHasValue(contact?: ContactInfo | null) {
    const companyName = contact?.companyName?.trim() ?? "";
    const name = contact?.name?.trim() ?? "";
    const phone = cleanPhoneInput(contact?.phone ?? "");
    const email = contact?.email?.trim() ?? "";

    const mailing = contact?.mailingAddress ?? null;
    const line1 = mailing?.line1?.trim() ?? "";
    const city = mailing?.city?.trim() ?? "";
    const state = mailing?.state?.trim() ?? "";
    const zip = mailing?.zip?.trim() ?? "";

    return Boolean(
      companyName || name || phone || email || line1 || city || state || zip
    );
  }

  function billingContactForRecipient(
    currentJob: Job,
    recipient: BillingRecipient
  ): ContactInfo | null {
    if (recipient === "homeowner") {
      return currentJob.homeowner ?? null;
    }

    const contactsByType = (currentJob as any).billingContacts as
      | Partial<Record<Exclude<BillingRecipient, "homeowner">, ContactInfo>>
      | undefined;

    // Normal nested shape:
    // billingContacts: { builder: {...}, insurance: {...}, other: {...} }
    const nestedContact = contactsByType?.[recipient];
    if (nestedContact) return nestedContact;

    // Defensive fallback in case any previous save created a literal dotted field:
    // { "billingContacts.builder": {...} }
    const dottedContact = (currentJob as any)[
      `billingContacts.${recipient}`
    ] as ContactInfo | undefined;

    if (dottedContact) return dottedContact;

    // Legacy fallback only when the active recipient matches.
    if (
      currentJob.billingRecipient === recipient &&
      currentJob.billingContact
    ) {
      return currentJob.billingContact;
    }

    return null;
  }

  async function getFreshJobForBilling(): Promise<Job | null> {
    if (!jobDocRef) return job;

    try {
      const typedRef = jobDocRef.withConverter(jobConverter);
      const snap = await getDoc(typedRef);

      if (!snap.exists()) return job;

      const freshJob = snap.data();
      setJob(freshJob);
      return freshJob;
    } catch (e) {
      console.warn("Failed to refresh job before billing hydrate", e);
      return job;
    }
  }

  async function openBillingRecipientModal() {
    const freshJob = await getFreshJobForBilling();
    if (!freshJob) return;

    const recipient = freshJob.billingRecipient ?? "homeowner";
    const contact = billingContactForRecipient(freshJob, recipient);

    setBillingRecipientDraft(recipient);
    setBillingContactDraft(contactDraftFromInfo(contact));
    setBillingOpen(true);
  }

  async function selectBillingRecipientType(recipient: BillingRecipient) {
    setBillingRecipientDraft(recipient);

    const freshJob = await getFreshJobForBilling();
    if (!freshJob) {
      setBillingContactDraft(contactDraftFromInfo(null));
      return;
    }

    const contact = billingContactForRecipient(freshJob, recipient);
    setBillingContactDraft(contactDraftFromInfo(contact));
  }

  function billingSummaryForJob(currentJob: Job) {
    const recipient = currentJob.billingRecipient ?? "homeowner";

    if (recipient === "homeowner") {
      const display =
        currentJob.homeowner?.name ||
        currentJob.homeowner?.email ||
        currentJob.homeowner?.phone ||
        "Not set";

      return {
        label: "Homeowner",
        value: display,
      };
    }

    const contact = billingContactForRecipient(currentJob, recipient);
    const display =
      contact?.companyName ||
      contact?.name ||
      contact?.email ||
      contact?.phone ||
      "Not set";

    return {
      label: billingRecipientLabel(recipient),
      value: display,
    };
  }

  function dateToTimestampOrDelete(d: any) {
    if (!d) return deleteField();

    // Accept Date OR Firestore Timestamp OR string(YYYY-MM-DD)
    const asDate =
      typeof d?.toDate === "function"
        ? d.toDate()
        : d instanceof Date
        ? d
        : typeof d === "string"
        ? new Date(`${d.slice(0, 10)}T00:00:00`)
        : null;

    if (!asDate || Number.isNaN(asDate.getTime())) return deleteField();
    return Timestamp.fromDate(asDate);
  }

  async function saveEditedPayout() {
    if (!job || !editingPayoutId) return;
    if (!payoutsColRef) return;

    const sqft = Number(editPayoutSqft);
    const rate = Number(editPayoutRate);

    if (!Number.isFinite(sqft) || sqft <= 0) {
      alert("Please enter a valid sq amount.");
      return;
    }

    if (!Number.isFinite(rate) || rate <= 0) {
      alert("Please enter a valid rate per sq.");
      return;
    }

    const nextAmountCents = Math.round(sqft * rate * 100);

    const nextPayouts = (job.expenses?.payouts ?? []).map((p) => {
      if (p.id !== editingPayoutId) return p;

      return {
        ...p,
        category: editPayoutCategory,
        sqft,
        ratePerSqFt: rate,
        amountCents: nextAmountCents,
      };
    });

    const updatedJob: Job = {
      ...job,
      expenses: {
        ...(job.expenses ?? {}),
        payouts: nextPayouts,
      },
    };

    await saveJob(updatedJob);

    try {
      await setDoc(
        doc(payoutsColRef, editingPayoutId),
        {
          category: editPayoutCategory,
          sqft,
          ratePerSqFt: rate,
          amountCents: nextAmountCents,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (e) {
      console.error("Failed to update mirrored payout doc", e);
    }

    setEditPayoutModalOpen(false);
    setEditingPayoutId(null);
    setEditPayoutSqft("");
    setEditPayoutRate("");
    setToast({
      status: "success",
      title: "Payout updated",
      message: "Payout changes were saved successfully.",
    });
  }

  async function saveHomeowner() {
    if (!jobDocRef) return;

    setHomeownerSaving(true);

    try {
      await setDoc(
        jobDocRef,
        {
          homeowner: toContactOrDelete(homeownerDraft),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      const typedRef = jobDocRef.withConverter(jobConverter);
      const snap = await getDoc(typedRef);
      if (snap.exists()) setJob(snap.data());

      setHomeownerOpen(false);

      setToast({
        status: "success",
        title: "Homeowner saved",
        message:
          "Homeowner information is now available for all warranty packets.",
      });
    } catch (e) {
      console.error("Failed to save homeowner", e);
      setToast({
        status: "error",
        title: "Homeowner save failed",
        message: "Check console for details and try again.",
      });
    } finally {
      setHomeownerSaving(false);
    }
  }

  async function saveBillingInformation() {
    if (!jobDocRef || !job) return;

    setBillingSaving(true);

    try {
      const patch: Record<string, unknown> =
        billingRecipientDraft === "homeowner"
          ? {
              billingRecipient: "homeowner" as BillingRecipient,
              billingContact: deleteField(),
              updatedAt: serverTimestamp(),
            }
          : (() => {
              const hasContact =
                billingContactDraftHasValue(billingContactDraft);
              const nextContact = hasContact
                ? toBillingContactOrDelete(billingContactDraft)
                : deleteField();

              return {
                billingRecipient: billingRecipientDraft,

                /**
                 * billingContact is only the active invoice snapshot.
                 * The permanent per-type data lives inside billingContacts.
                 */
                billingContact: nextContact,

                /**
                 * Critical:
                 * Write as a nested map, not as a dotted string key.
                 * Firestore merge will preserve sibling contacts:
                 * billingContacts.builder
                 * billingContacts.insurance
                 * billingContacts.other
                 */
                billingContacts: {
                  [billingRecipientDraft]: nextContact,
                },

                updatedAt: serverTimestamp(),
              };
            })();

      await setDoc(jobDocRef, patch, { merge: true });

      const typedRef = jobDocRef.withConverter(jobConverter);
      const snap = await getDoc(typedRef);
      if (snap.exists()) setJob(snap.data());

      setBillingOpen(false);

      setToast({
        status: "success",
        title: "Billing recipient saved",
        message:
          billingRecipientDraft === "homeowner"
            ? "Invoices will use the homeowner contact for this job."
            : `${billingRecipientLabel(
                billingRecipientDraft
              )} billing details were saved for this job.`,
      });
    } catch (e) {
      console.error("Failed to save billing recipient", e);
      setToast({
        status: "error",
        title: "Billing save failed",
        message: "Check console for details and try again.",
      });
    } finally {
      setBillingSaving(false);
    }
  }
  async function saveWarranty(
    nextWarranty: WarrantyDraft,
    nextHomeowner: ContactInfo
  ) {
    if (!job) return;
    if (!jobDocRef) return;
    if (!activeWarrantyType) return;

    const rawRef = jobDocRef;
    const type = activeWarrantyType;

    const warrantyPatch: any = {
      kind: type,
      status: nextWarranty.status ?? deleteField(),

      manufacturer: toOptionalOrDelete(nextWarranty.manufacturer),
      programName: toOptionalOrDelete(nextWarranty.programName),
      productLine: toOptionalOrDelete((nextWarranty as any).productLine),
      warrantyNumber: toOptionalOrDelete((nextWarranty as any).warrantyNumber),

      portalUrl: toOptionalOrDelete(nextWarranty.portalUrl),
      registrationId: toOptionalOrDelete(nextWarranty.registrationId),

      claimId: toOptionalOrDelete(nextWarranty.claimId),
      claimNumber: toOptionalOrDelete(nextWarranty.claimNumber),
      claimStatus: toOptionalOrDelete((nextWarranty as any).claimStatus),

      insuranceCarrier: toOptionalOrDelete(nextWarranty.insuranceCarrier),
      policyNumber: toOptionalOrDelete(nextWarranty.policyNumber),

      serviceRequestNumber: toOptionalOrDelete(
        (nextWarranty as any).serviceRequestNumber
      ),
      authorizationNumber: toOptionalOrDelete(
        (nextWarranty as any).authorizationNumber
      ),

      causeOfLoss: toOptionalOrDelete((nextWarranty as any).causeOfLoss),
      coveredScope: toOptionalOrDelete((nextWarranty as any).coveredScope),
      exclusionsSummary: toOptionalOrDelete(
        (nextWarranty as any).exclusionsSummary
      ),

      notes: toOptionalOrDelete(nextWarranty.notes),

      coverageYears:
        typeof nextWarranty.coverageYears === "number"
          ? nextWarranty.coverageYears
          : deleteField(),

      deductibleCents:
        typeof (nextWarranty as any).deductibleCents === "number"
          ? (nextWarranty as any).deductibleCents
          : deleteField(),

      transferEligible:
        typeof (nextWarranty as any).transferEligible === "boolean"
          ? (nextWarranty as any).transferEligible
          : deleteField(),

      installDate: dateToTimestampOrDelete(nextWarranty.installDate),
      repairDate: dateToTimestampOrDelete(nextWarranty.repairDate),
      expiresAt: dateToTimestampOrDelete(nextWarranty.expiresAt),

      submittedAt: dateToTimestampOrDelete((nextWarranty as any).submittedAt),
      registeredAt: dateToTimestampOrDelete((nextWarranty as any).registeredAt),
      transferDeadline: dateToTimestampOrDelete(
        (nextWarranty as any).transferDeadline
      ),

      lossDate: dateToTimestampOrDelete((nextWarranty as any).lossDate),
      reportedAt: dateToTimestampOrDelete((nextWarranty as any).reportedAt),

      claimOpenedAt: dateToTimestampOrDelete(
        (nextWarranty as any).claimOpenedAt
      ),
      claimClosedAt: dateToTimestampOrDelete(
        (nextWarranty as any).claimClosedAt
      ),

      /**
       * Homeowner is now job-level.
       * Delete the legacy packet-level homeowner so all packets use job.homeowner.
       */
      homeowner: deleteField(),

      adjuster: nextWarranty.adjuster ?? deleteField(),
      thirdPartyAdmin: nextWarranty.thirdPartyAdmin ?? deleteField(),

      attachments: Array.isArray(nextWarranty.attachments)
        ? nextWarranty.attachments
        : deleteField(),

      warrantyPhotoIds: Array.isArray((nextWarranty as any).warrantyPhotoIds)
        ? (nextWarranty as any).warrantyPhotoIds
        : deleteField(),
    };

    try {
      await setDoc(
        rawRef,
        {
          warranties: {
            [type]: warrantyPatch,
          },
          homeowner: toContactOrDelete(nextHomeowner),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      const typedRef = jobDocRef.withConverter(jobConverter);
      const snap = await getDoc(typedRef);
      if (snap.exists()) setJob(snap.data());

      setToast({
        status: "success",
        title: "Warranty saved",
        message: "Warranty details and homeowner contact have been saved.",
      });
    } catch (e) {
      console.error("Failed to save warranty", e);
      setToast({
        status: "error",
        title: "Warranty save failed",
        message: "Check console for details and try again.",
      });
    }
  }

  async function clearFlashingPay() {
    if (!job) return;

    const sqft = job.pricing?.sqft ?? 0;
    const rate = (job.pricing?.ratePerSqFt as 31 | 35) ?? 31;
    const basePayCents = calculateJobBasePayCents(
      sqft,
      rate,
      effectiveJobFeeCents
    );

    setFlashingUnits("1");
    setFlashingUnitPrice("0");

    await saveJob({
      ...job,
      earnings: {
        ...(job.earnings ?? {}),
        flashingPay: deleteField() as any, // ✅ actually removes the field in Firestore
        totalEarningsCents: basePayCents,
      },
    });
  }

  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;

      ticking = true;
      window.requestAnimationFrame(() => {
        const currentY = window.scrollY;
        const diff = currentY - lastY;

        // always show near the top of the page
        if (currentY <= 120) {
          setShowMobileSectionNav(true);
          lastY = currentY;
          ticking = false;
          return;
        }

        // ignore tiny scroll jitter
        if (Math.abs(diff) < 6) {
          ticking = false;
          return;
        }

        // scrolling down -> hide
        if (diff > 0) {
          setShowMobileSectionNav(false);
        }

        // scrolling up -> show
        if (diff < 0) {
          setShowMobileSectionNav(true);
        }

        lastY = currentY;
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    // Wait until org context is ready
    if (orgLoading) return;

    // If no org selected, don't show any employees
    if (!orgId) {
      setEmployees([]);
      return;
    }

    if (!employeesColRef) {
      setEmployees([]);
      return;
    }
    const q = query(employeesColRef, orderBy("name", "asc"));

    const unsub = onSnapshot(q, (snap) => {
      const list: Employee[] = [];
      snap.forEach((d) =>
        list.push({
          id: d.id,
          ...(d.data() as Omit<Employee, "id">),
        })
      );
      setEmployees(list);
    });

    return () => unsub();
  }, [orgId, orgLoading]);

  useEffect(() => {
    if (orgLoading) return;
    if (!orgId) {
      setPayoutDocs([]);
      return;
    }
    if (!resolvedJobId) return;

    if (!payoutsColRef) {
      setPayoutDocs([]);
      return;
    }

    const qy = query(
      payoutsColRef,
      where("jobId", "==", resolvedJobId),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const unsub = onSnapshot(
      qy,
      (snap) => {
        const rows = snap.docs.map((d) => {
          const data = d.data() as PayoutDoc;
          return { ...data, id: data.id ?? d.id };
        });
        setPayoutDocs(rows);
      },
      (err) => console.error("payout activity listener failed", err)
    );

    return () => unsub();
  }, [resolvedJobId, orgId, orgLoading]);

  useEffect(() => {
    if (!orgId) {
      setOrgMaterials([]);
      return;
    }

    const ref = doc(db, "organizations", orgId);

    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setOrgMaterials([]);
          return;
        }

        const data = snap.data() as Partial<Org>;
        const rows = Array.isArray(data.commonMaterials)
          ? [...data.commonMaterials]
              .filter((row) => row?.isActive !== false)
              .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
          : [];

        setOrgMaterials(rows);
      },
      () => setOrgMaterials([])
    );

    return () => unsub();
  }, [orgId]);

  useEffect(() => {
    if (materialModalOpen) {
      setMaterialDrafts([]);
      setExpandedMaterialIndex(null);
      prevMaterialDraftCountRef.current = 0;
    }
  }, [materialModalOpen]);

  useEffect(() => {
    const prevCount = prevMaterialDraftCountRef.current;

    if (
      materialModalOpen &&
      materialDrafts.length > prevCount &&
      materialListRef.current
    ) {
      window.requestAnimationFrame(() => {
        const el = materialListRef.current;
        if (!el) return;

        el.scrollTo({
          top: el.scrollHeight,
          behavior: "smooth",
        });
      });
    }

    prevMaterialDraftCountRef.current = materialDrafts.length;
  }, [materialDrafts.length, materialModalOpen]);

  // Keyboard handlers (ESC / Left / Right)
  useEffect(() => {
    if (!viewerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeViewer();
      else if (e.key === "ArrowLeft") prevPhoto();
      else if (e.key === "ArrowRight") nextPhoto();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewerOpen, photos.length]);

  // Optional: preload neighbors for snappy next/prev
  useEffect(() => {
    if (!viewerOpen || photos.length === 0) return;
    const curr = photos[viewerIndex];
    const next = photos[(viewerIndex + 1) % photos.length];
    const prev = photos[(viewerIndex - 1 + photos.length) % photos.length];
    [curr, next, prev].forEach((p) => {
      if (!p) return;
      const img = new Image();
      const src = p.fullUrl ?? p.previewUrl ?? p.url ?? p.thumbUrl ?? "";
      img.src = src;
    });
  }, [viewerOpen, viewerIndex, photos]);

  // --- NEW: pricing edit toggle ---
  const [editingPricing, setEditingPricing] = useState(false);

  // --- Pricing calculator state (used only while editing/initial apply) ---
  const [sqft, setSqft] = useState<string>("");
  const [rate, setRate] = useState<number>(31);
  const totalJobPayCentsPreview = useMemo(() => {
    const nSqft = Math.max(0, Number(sqft) || 0);
    const base = calculateJobBasePayCents(nSqft, rate, effectiveJobFeeCents);
    const flashingPayCents = job?.earnings?.flashingPay?.amountCents ?? 0;
    return base + flashingPayCents;
  }, [
    sqft,
    rate,
    effectiveJobFeeCents,
    job?.earnings?.flashingPay?.amountCents,
  ]);

  const hasOrgCommonRates = commonRatesPerSq.length > 0;

  const pricingRateOptions = useMemo(() => {
    const currentRate = Number(rate);
    const baseRates = commonRatesPerSq;

    if (
      Number.isFinite(currentRate) &&
      currentRate > 0 &&
      !baseRates.includes(currentRate)
    ) {
      return [...baseRates, currentRate].sort((a, b) => a - b);
    }

    return baseRates;
  }, [commonRatesPerSq, rate]);

  function handleManualPricingRateChange(nextValue: string) {
    const nextRate = Number(nextValue);

    setRate(Number.isFinite(nextRate) ? nextRate : 0);

    if (!hasOrgCommonRates && Number.isFinite(nextRate) && nextRate > 0) {
      setRateSavePrompt(nextRate);
    } else {
      setRateSavePrompt(null);
    }
  }

  const [noteText, setNoteText] = useState("");
  useEffect(() => {
    setSummaryNotesDraft(job?.summaryNotes ?? "");
  }, [job?.summaryNotes]);

  // --- NEW: Photo upload (file + optional caption) ---
  const [uploading, setUploading] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoCaption, setPhotoCaption] = useState("");

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const editingPayout = useMemo(() => {
    if (!editingPayoutId) return null;
    return (
      (job?.expenses?.payouts ?? []).find((p) => p.id === editingPayoutId) ??
      null
    );
  }, [editingPayoutId, job]);

  // Generic toast (photo uploads, scheduling, etc.)
  type ToastStatus = "success" | "error";
  type ToastState = {
    status: ToastStatus;
    title: string;
    message: string;
  } | null;

  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    if (!photoFile) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(photoFile);
    setPreviewUrl(url);

    // Clean up object URL when file changes or component unmounts
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  // Auto-hide global toast
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => {
      setToast(null);
    }, 3500);
    return () => clearTimeout(id);
  }, [toast]);

  // Tabs for payouts
  type PayoutTab = "shingles" | "felt" | "technician";
  const [payoutTab, setPayoutTab] = useState<PayoutTab>("shingles");
  useEffect(() => {
    if (payoutModalOpen && payoutTab === "technician") {
      setPayoutTab("shingles");
    }
  }, [payoutModalOpen, payoutTab]);
  const payeeRef = useRef<HTMLInputElement | null>(null);
  const noteRef = useRef<HTMLTextAreaElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const materialListRef = useRef<HTMLDivElement | null>(null);
  const prevMaterialDraftCountRef = useRef(0);

  // Keep separate inputs per tab (name, sqft, rate)
  type PayoutInput = {
    employeeId?: string;
    payeeNickname: string; // derived from employee but kept for display/backcompat
    sqft: string;
    rate: string;
    amount: string;
  };

  const [payoutInputs, setPayoutInputs] = useState<
    Record<PayoutTab, PayoutInput>
  >({
    shingles: {
      employeeId: undefined,
      payeeNickname: "",
      sqft: "",
      rate: "",
      amount: "",
    },
    felt: {
      employeeId: undefined,
      payeeNickname: "",
      sqft: "",
      rate: "",
      amount: "",
    },
    technician: {
      employeeId: undefined,
      payeeNickname: "",
      sqft: "",
      rate: "",
      amount: "",
    },
  });

  const activePayout = payoutInputs[payoutTab];
  function setActivePayout(
    next: Partial<{
      employeeId?: string;
      payeeNickname: string;
      sqft: string;
      rate: string;
      amount: string;
    }>
  ) {
    setPayoutInputs((s) => ({
      ...s,
      [payoutTab]: { ...s[payoutTab], ...next },
    }));
  }
  const activityItems = useMemo<ActivityItem[]>(() => {
    if (!job) return [];

    const items: ActivityItem[] = [];

    // 1) Payout docs (real createdAt)
    for (const p of payoutDocs) {
      const at = toDateSafe(p.createdAt) ?? new Date(0);
      items.push({
        id: `payout:${p.id}`,
        kind: "payout",
        at,
        title: `Payout created for ${p.employeeNameSnapshot}`,
        detail: `$${(p.amountCents / 100).toFixed(2)} • ${p.category}`,
      });
    }

    // 2) Materials (createdAt exists on MaterialExpense)
    for (const m of job.expenses?.materials ?? []) {
      const at = toDateSafe(m.createdAt) ?? null;
      if (!at) continue;

      const materialName = getMaterialDisplayName(m);
      const materialUnit = getMaterialDisplayUnit(m);
      const vendor = m.vendor?.trim();

      const totalLabel = `Total: $${(m.amountCents / 100).toFixed(2)}`;
      const unitPriceLabel = `$${(m.unitPriceCents / 100).toFixed(2)}`;

      const quantityLabel = formatMaterialQuantityLabel(
        m.quantity,
        materialUnit
      );

      const breakdownLabel = materialUnit
        ? `${quantityLabel} × ${unitPriceLabel} each`
        : `${quantityLabel} × ${unitPriceLabel}`;

      items.push({
        id: `material:${m.id}`,
        kind: "material",
        at,
        title: `Material added - ${materialName}`,
        detail: [
          vendor ? `Vendor: ${vendor}` : null,
          totalLabel,
          breakdownLabel,
        ]
          .filter(Boolean)
          .join("\n"),
      });
    }

    // 3) Notes (createdAt exists)
    for (const n of job.notes ?? []) {
      const at = toDateSafe(n.createdAt) ?? null;
      if (!at) continue;

      const trimmed = (n.text ?? "").trim();
      const preview =
        trimmed.length > 140 ? trimmed.slice(0, 140).trim() + "…" : trimmed;

      items.push({
        id: `note:${n.id}`,
        kind: "note",
        at,
        title: "Note added",
        detail: preview,
      });
    }

    // 4) Photos (from jobPhotos collection state)
    for (const ph of photos) {
      const at = toDateSafe(ph.createdAt) ?? null;
      if (!at) continue;

      const src = (ph as any)?.thumbUrl ?? (ph as any)?.fullUrl ?? ph.url;

      items.push({
        id: `photo:${ph.id}`,
        kind: "photo",
        at,
        title: "Photo uploaded",
        detail: ph.caption?.trim() ? ph.caption.trim() : undefined,
        photoUrl: src,
        photoCaption: ph.caption?.trim() ? ph.caption.trim() : undefined,
      });
    }

    // newest first
    items.sort((a, b) => b.at.getTime() - a.at.getTime());

    return items.slice(0, 50);
  }, [job, payoutDocs, photos]);

  const payoutAmountCents = useMemo(() => {
    if (payoutTab === "technician") {
      const amt = Number(activePayout.amount) || 0;
      return Math.round(Math.max(0, amt) * 100);
    }
    const sqft = Number(activePayout.sqft) || 0;
    const rate = Number(activePayout.rate) || 0;
    return Math.round(Math.max(0, sqft * rate) * 100);
  }, [payoutTab, activePayout.amount, activePayout.sqft, activePayout.rate]);
  function toPosNumber(v: string) {
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  }

  const payoutCanSubmit = useMemo(() => {
    const hasEmployee = !!activePayout.employeeId;

    if (!hasEmployee) return false;

    if (payoutTab === "technician") {
      const amt = toPosNumber(activePayout.amount);
      return Number.isFinite(amt) && amt > 0;
    }

    const sqft = toPosNumber(activePayout.sqft);
    const rate = toPosNumber(activePayout.rate);
    return (
      Number.isFinite(sqft) && sqft > 0 && Number.isFinite(rate) && rate > 0
    );
  }, [
    payoutTab,
    activePayout.employeeId,
    activePayout.amount,
    activePayout.sqft,
    activePayout.rate,
  ]);

  // Load job + its photos (real-time)
  useEffect(() => {
    if (orgLoading) return;
    if (!jobDocRef) return; // ✅ covers: !resolvedJobId OR !orgId

    // Job listener (ORG-SCOPED)
    const typedJobRef = jobDocRef.withConverter(jobConverter);

    const unsubJob = onSnapshot(
      typedJobRef,
      (snap) => {
        if (!snap.exists()) {
          setError("Job not found");
          setLoading(false);
          return;
        }

        const data = snap.data();
        setJob(data);

        if (data.pricing) {
          setSqft(String(data.pricing.sqft ?? ""));
          setRate(Number(data.pricing.ratePerSqFt) || 31);
        }

        setLoading(false);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      }
    );

    // Photos listener (keep your existing approach)
    // If jobPhotos is also org-scoped in your schema, tell me and I’ll adjust this too.
    if (!jobPhotosColRef) {
      setPhotos([]);
      return;
    }

    const q = query(
      jobPhotosColRef,
      where("jobId", "==", jobDocRef.id),
      orderBy("createdAt", "desc")
    );

    const unsubPhotos = onSnapshot(q, (qs) => {
      const list: JobPhoto[] = [];
      qs.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
      setPhotos(list);
    });

    return () => {
      unsubJob();
      unsubPhotos();
    };
  }, [jobDocRef, orgLoading]);

  const totals = useMemo(() => {
    const earnings = job?.earnings?.totalEarningsCents ?? 0;
    const payouts = job?.expenses?.totalPayoutsCents ?? 0;
    const materials = job?.expenses?.totalMaterialsCents ?? 0;
    const expenses = job?.computed?.totalExpensesCents ?? 0;
    const net = job?.computed?.netProfitCents ?? earnings - expenses;
    const expensePortion = earnings > 0 ? Math.min(1, expenses / earnings) : 0;
    return { earnings, payouts, materials, expenses, net, expensePortion };
  }, [job]);

  // Save (optimistic, typed)
  async function saveJob(nextJob: Job) {
    if (!jobDocRef) {
      console.warn("saveJob called without jobDocRef (orgId/jobId not ready)");
      return;
    }

    // Safety: ensure we never write to the wrong document id
    if (nextJob.id !== jobDocRef.id) {
      console.warn("saveJob id mismatch:", nextJob.id, "!==", jobDocRef.id);
    }

    const ref = jobDocRef.withConverter(jobConverter);
    const previous = job;

    try {
      const optimistic = recomputeJob({
        ...nextJob,
        updatedAt: Timestamp.now(),
      });
      setJob(optimistic);

      const toPersist = recomputeJob({
        ...nextJob,
        updatedAt: serverTimestamp() as FieldValue,
      });

      await setDoc(ref, toPersist, { merge: true });

      const snap = await getDoc(ref);
      if (snap.exists()) setJob(snap.data());
    } catch (err) {
      console.error("Failed to save job", err);
      if (previous) setJob(previous);
    }
  }

  async function confirmMarkPunched() {
    if (!job) return;

    const now = Timestamp.now();

    await saveJob({
      ...job,
      status: "completed", // mark job as completed
      punchedAt: now,
      punchScheduledFor: null, // clear any scheduled date
    });

    setConfirmPunchedOpen(false);

    // Show success toast
    const label = now.toDate().toLocaleString();
    setToast({
      status: "success",
      title: "Job marked complete",
      message: `This job has been marked as punched and completed on ${label}.`,
    });
  }
  async function confirmUndoPunch() {
    if (!job) return;

    // Allow undo even though "completed" normally locks the job UI.
    // We only block undo for truly locked states.
    if (job.status === "closed" || job.status === "archived") return;

    await saveJob({
      ...job,
      status: "pending", // back to an actionable workflow state
      punchedAt: null, // undo completion
      // NOTE: we do NOT restore punchScheduledFor because confirmMarkPunched clears it.
      // User can reschedule punch immediately after undo.
    });

    setConfirmUndoPunchOpen(false);

    setToast({
      status: "success",
      title: "Punch undone",
      message: "Job reopened. You can reschedule punch or make changes.",
    });
  }

  async function saveFeltSchedule() {
    if (!job || !feltScheduleDate) return;

    const wasScheduledBefore = !!(job as any).feltScheduledFor;

    const [year, month, day] = feltScheduleDate.split("-").map(Number);
    const scheduledDate = new Date(year, month - 1, day);

    await saveJob({
      ...job,
      feltScheduledFor: Timestamp.fromDate(scheduledDate),
    });

    setFeltScheduleEditing(false);

    setToast({
      status: "success",
      title: wasScheduledBefore ? "DRY IN rescheduled" : "DRY IN scheduled",
      message: `DRY IN is now set for ${fmtLongDate(scheduledDate)}.`,
    });
  }

  async function saveShinglesSchedule() {
    if (!job || !shinglesScheduleDate) return;

    const wasScheduledBefore = !!(job as any).shinglesScheduledFor;

    const [year, month, day] = shinglesScheduleDate.split("-").map(Number);
    const scheduledDate = new Date(year, month - 1, day);

    await saveJob({
      ...job,
      shinglesScheduledFor: Timestamp.fromDate(scheduledDate),
    });

    setShinglesScheduleEditing(false);

    setToast({
      status: "success",
      title: wasScheduledBefore ? "Shingles rescheduled" : "Shingles scheduled",
      message: `Shingles are now set for ${fmtLongDate(scheduledDate)}.`,
    });
  }

  async function markFeltCompleted() {
    if (!job) return;
    await saveJob({
      ...job,
      feltCompletedAt: Timestamp.now(),
    });
  }
  async function reopenFelt() {
    if (!job) return;
    if (jobIsLocked) return;

    // 1) Stable local UI update (no deleteField sentinels)
    const optimisticJob: Job = {
      ...job,
      feltCompletedAt: null as any,
      shinglesCompletedAt: null as any,
      punchedAt: null as any,
    };

    // 2) Persist actual field deletes to Firestore
    const persistJob: Job = {
      ...job,
      feltCompletedAt: deleteField() as any,
      shinglesCompletedAt: deleteField() as any,
      punchedAt: deleteField() as any,
    };

    setJob(recomputeJob({ ...optimisticJob, updatedAt: Timestamp.now() }));

    await saveJob(persistJob);

    setToast({
      status: "success",
      title: "Dry-in reopened",
      message:
        "Dry-in has been reopened. Downstream completion states were cleared, but the punch scheduled date was kept.",
    });
  }

  async function reopenShingles() {
    if (!job) return;
    if (jobIsLocked) return;

    // 1) Stable local UI update (no deleteField sentinels)
    const optimisticJob: Job = {
      ...job,
      shinglesCompletedAt: null as any,
      punchedAt: null as any,
    };

    // 2) Persist actual field deletes to Firestore
    const persistJob: Job = {
      ...job,
      shinglesCompletedAt: deleteField() as any,
      punchedAt: deleteField() as any,
    };

    setJob(recomputeJob({ ...optimisticJob, updatedAt: Timestamp.now() }));

    await saveJob(persistJob);

    setToast({
      status: "success",
      title: "Shingles reopened",
      message:
        "Shingles has been reopened. Punch completion was cleared, but the scheduled punch date was kept.",
    });
  }
  async function markShinglesCompleted() {
    if (!job) return;
    await saveJob({
      ...job,
      shinglesCompletedAt: Timestamp.now(),
    });
  }

  // ---- Mutations ----
  async function addPayout() {
    if (!job) return;

    const employeeId = activePayout.employeeId;
    const employee = employees.find((e) => e.id === employeeId);

    if (!employeeId || !employee) {
      alert("Please select an employee for this payout.");
      return;
    }

    // still keep a nickname for display + backward compatibility
    const name = employee.name.trim();
    if (!name) return;

    let entry: Payout;
    const baseId = crypto.randomUUID();

    if (payoutTab === "technician") {
      const amt = Number(activePayout.amount);
      if (!Number.isFinite(amt) || amt <= 0) return;

      entry = {
        id: baseId,
        payeeNickname: name,
        employeeId,
        amountCents: payoutAmountCents,
        method: "check",
        category: "technician",
        // paidAt intentionally omitted – starts as pending
      };
    } else {
      const sqft = Number(activePayout.sqft);
      const rate = Number(activePayout.rate);
      if (
        !Number.isFinite(sqft) ||
        !Number.isFinite(rate) ||
        sqft <= 0 ||
        rate <= 0
      )
        return;

      entry = {
        id: baseId,
        payeeNickname: name,
        employeeId,
        amountCents: payoutAmountCents,
        method: "check",
        sqft,
        ratePerSqFt: rate,
        category: payoutTab,
        // paidAt intentionally omitted – starts as pending
      };
    }

    // 1) Update the job doc (backwards-compatible)
    const updated: Job = {
      ...job,
      expenses: {
        ...(job.expenses ?? {}),
        payouts: [...(job.expenses?.payouts ?? []), entry],
      },
    };

    await saveJob(updated);

    // 2) Write mirrored doc into top-level "payouts" collection
    try {
      if (!payoutsColRef) throw new Error("payoutsColRef not ready");
      const payoutRef = doc(payoutsColRef, entry.id);
      const payoutMethod: "check" | "cash" | "zelle" | "other" = (() => {
        const m = entry.method;
        if (m === "check" || m === "cash" || m === "zelle" || m === "other") {
          return m;
        }
        return "check"; // sensible default / fallback
      })();
      if (!orgId) {
        throw new Error("Cannot create payout without orgId");
      }
      const payoutDoc: PayoutDoc = {
        id: entry.id,
        jobId: job.id,
        employeeId,
        employeeNameSnapshot: employee.name,
        jobAddressSnapshot: job.address,
        category: entry.category ?? "shingles",
        amountCents: entry.amountCents,
        method: payoutMethod,
        sqft: entry.sqft,
        ratePerSqFt: entry.ratePerSqFt,
        orgId,
        createdAt: serverTimestamp() as FieldValue,
        paidAt: null, // start as pending; will be filled when marked as paid
      };

      await setDoc(payoutRef, payoutDoc);
    } catch (e) {
      console.error("Failed to record payout doc", e);
      // we don't block the job update if this fails
    }

    // reset form for current tab
    setPayoutInputs((s) => ({
      ...s,
      [payoutTab]: {
        employeeId: undefined,
        payeeNickname: "",
        sqft: "",
        rate: "",
        amount: "",
      },
    }));
    (payeeRef.current as any)?.focus?.();
  }

  async function addNote() {
    if (!job || !noteText.trim()) return;
    const entry: Note = {
      id: crypto.randomUUID(),
      text: noteText.trim(),
      createdAt: Timestamp.now(),
    };
    const updated: Job = { ...job, notes: [...(job.notes ?? []), entry] };
    await saveJob(updated);
    setNoteText("");
    noteRef.current?.focus();
  }
  async function saveSummaryNotes() {
    if (!job) return;

    await saveJob({
      ...job,
      summaryNotes: summaryNotesDraft.trim(),
    });

    setSummaryNotesOpen(false);
    setToast({
      status: "success",
      title: "Summary notes saved",
      message: "Summary notes were updated successfully.",
    });
  }

  async function handleAddPayoutSubmit() {
    if (!payoutCanSubmit) return; // ✅ don’t close modal, don’t toast
    await addPayout();
    setPayoutModalOpen(false);
    setToast({
      status: "success",
      title: "Payout added",
      message: "Payout saved successfully.",
    });
  }

  async function handleAddMaterialsSubmit() {
    if (!job || !jobDocRef) return;

    const valid = materialDrafts.filter(
      (draft) => draft.isCommitted && materialLineCanSubmit(draft)
    );
    if (!valid.length) return;

    const materialItems: MaterialExpense[] = valid.map((m) => {
      const qty = Math.floor(Number(m.quantity) || 0);
      const unitCents = toCents(Number(m.unitPrice) || 0);
      const vendor = (m.vendor || "").trim();

      const orgMatch = materialOptionsByKey.get(m.category);
      const resolvedLabel =
        orgMatch?.name?.trim() || humanizeMaterialKey(m.category);
      const resolvedUnit = orgMatch?.unit?.trim() || "";

      return {
        id: crypto.randomUUID(),
        materialId: orgMaterials.find(
          (row) => resolveOrgMaterialKey(row) === m.category
        )?.id,
        materialKey: m.category,
        category: m.category,
        labelSnapshot: resolvedLabel,
        unitSnapshot: resolvedUnit,
        unitPriceCents: unitCents,
        quantity: qty,
        amountCents: unitCents * qty,
        ...(vendor ? { vendor } : {}),
        createdAt: Timestamp.now(),
      };
    });

    // ✅ save through saveJob so recompute + totals stay consistent
    await saveJob({
      ...job,
      expenses: {
        ...(job.expenses ?? {}),
        materials: [...(job.expenses?.materials ?? []), ...materialItems],
      },
    });

    setMaterialModalOpen(false);
    setMaterialDrafts([]);
    setExpandedMaterialIndex(null);

    setToast({
      status: "success",
      title: "Materials saved",
      message: "Material items were saved successfully.",
    });
  }

  async function handleAddNoteSubmit() {
    await addNote();
    setNoteModalOpen(false);
    setToast({
      status: "success",
      title: "Note added",
      message: "Note saved successfully.",
    });
  }

  async function handleUploadPhotoSubmit() {
    await uploadPhoto();
    setPhotoModalOpen(false); // uploadPhoto already sets toast success/error
  }

  // ------- NEW: Photo upload (Storage -> CF sharp -> Firestore) -------
  async function uploadPhoto() {
    if (!job || !photoFile || !orgId) return;

    setUploading(true);

    try {
      const storage = getStorage();

      const safeName = photoFile.name
        .replace(/\s+/g, "_")
        .replace(/[^\w.\-]/g, "");

      const filename = `${Date.now()}_${safeName}`;

      // ✅ This must match your Cloud Function trigger path
      const originalPath = `organizations/${orgId}/jobs/${job.id}/attachments/originals/${filename}`;
      const fileRef = storageRef(storage, originalPath);

      await uploadBytes(fileRef, photoFile, {
        contentType: photoFile.type || "image/*",
        customMetadata: {
          orgId,
          jobId: job.id,
          caption: photoCaption?.trim() || "",
        },
      });

      setPhotoFile(null);
      setPhotoCaption("");

      setToast({
        status: "success",
        title: "Photo upload received",
        message: "Processing now. It will appear shortly.",
      });
    } catch (e) {
      console.error(e);
      setToast({
        status: "error",
        title: "Photo upload failed",
        message: "Upload failed. Check console for details and try again.",
      });
    } finally {
      setUploading(false);
    }
  }

  async function deletePhoto(photoId: string) {
    if (!jobPhotosColRef) return;
    await deleteDoc(doc(jobPhotosColRef, photoId));
    // Cloud Function cleanupPhotoOnDelete will remove the Storage file and decrement counters.
  }

  async function removePayout(pid: string) {
    if (!job) return;
    const updated: Job = {
      ...job,
      expenses: {
        ...job.expenses,
        payouts: (job.expenses.payouts ?? []).filter((p) => p.id !== pid),
      },
    };
    await saveJob(updated);

    // try to delete mirrored payout doc (if it exists)
    try {
      if (payoutsColRef) {
        await deleteDoc(doc(payoutsColRef, pid));
      }
    } catch (e) {
      console.warn("Failed to delete payout doc", e);
    }
  }

  async function removeMaterial(mid: string) {
    if (!job) return;
    const updated: Job = {
      ...job,
      expenses: {
        ...job.expenses,
        materials: (job.expenses.materials ?? []).filter((m) => m.id !== mid),
      },
    };
    await saveJob(updated);
  }

  async function removeNote(nid: string) {
    if (!job) return;
    const updated: Job = {
      ...job,
      notes: (job.notes ?? []).filter((n) => n.id !== nid),
    };
    await saveJob(updated);
  }

  // ------- Danger zone -------
  async function permanentlyDeleteJob() {
    if (!job) return;
    if (!orgId) return;

    // prefer resolvedJobId if you’re using it elsewhere; fallback to job.id
    const jobId = resolvedJobId ?? job.id;
    if (!jobId) return;

    setDeletingJob(true);

    try {
      const jobRef = doc(db, "organizations", orgId, "jobs", jobId);
      await deleteDoc(jobRef);

      setConfirmDeleteOpen(false);
      if (isModal) handleClose();
      else navigate("/dashboard");
    } catch (e) {
      console.error("Failed to permanently delete job", e);
      alert("Failed to delete the job. Check console for details.");
    } finally {
      setDeletingJob(false);
    }
  }

  const jobWarranties: WarrantyRecord = useMemo(() => {
    if (!job) return {};

    const rawJob = job as Job &
      Partial<Record<`warranties.${WarrantyTypeKey}`, WarrantyDraft>>;

    const next: WarrantyRecord = {
      ...(job.warranties ?? {}),
    };

    for (const type of WARRANTY_TYPES) {
      const dottedWarranty = rawJob[`warranties.${type}`];

      if (!next[type] && dottedWarranty && typeof dottedWarranty === "object") {
        next[type] = {
          ...dottedWarranty,
          kind: type,
        };
      }
    }

    if (Object.keys(next).length > 0) return next;

    const legacyWarranty = job.warranty as WarrantyDraft | null | undefined;
    if (legacyWarranty?.kind && legacyWarranty.kind !== "none") {
      next[legacyWarranty.kind as WarrantyTypeKey] = legacyWarranty;
    }

    return next;
  }, [job, job?.warranties, job?.warranty]);

  const activeWarranty =
    activeWarrantyType && jobWarranties[activeWarrantyType]
      ? jobWarranties[activeWarrantyType]
      : null;

  if (loading)
    return <div className="p-8 text-[var(--color-text)]">Loading…</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!job) return <div className="p-8">Not found.</div>;

  const createdStr = fmtDate(job.createdAt ?? null);
  const updatedStr = fmtDate(job.updatedAt ?? job.createdAt ?? null);
  const headerAddress =
    typeof job.address === "string"
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
        "Untitled job";

  const billingSummary = billingSummaryForJob(job);

  const roofSizeLabel =
    typeof job.pricing?.sqft === "number" && job.pricing.sqft > 0
      ? `${job.pricing.sqft.toLocaleString()} SQ`
      : "—";
  const punchScheduledMs = toMillis(job.punchScheduledFor ?? null);
  const punchScheduledLabel =
    punchScheduledMs != null ? fmtLongDate(punchScheduledMs) : null;

  const punchedAtMs = toMillis(job.punchedAt ?? null);
  const punchedAtLabel = punchedAtMs != null ? fmtDate(job.punchedAt) : null;

  const feltScheduledMs = toMillis((job as any).feltScheduledFor ?? null);
  const feltCompletedMs = toMillis((job as any).feltCompletedAt ?? null);
  const shinglesScheduledMs = toMillis(
    (job as any).shinglesScheduledFor ?? null
  );
  const shinglesCompletedMs = toMillis(
    (job as any).shinglesCompletedAt ?? null
  );

  const jobIsLocked =
    job.status === "completed" ||
    job.status === "closed" ||
    job.status === "archived";

  const hasFeltScheduledOrCompleted =
    feltScheduledMs != null || feltCompletedMs != null;

  const hasShinglesScheduledOrCompleted =
    shinglesScheduledMs != null || shinglesCompletedMs != null;

  const canSchedulePunch =
    !job.punchedAt &&
    !jobIsLocked &&
    hasFeltScheduledOrCompleted &&
    hasShinglesScheduledOrCompleted;

  const canMarkPunchDone =
    !job.punchedAt &&
    !jobIsLocked &&
    feltCompletedMs != null &&
    shinglesCompletedMs != null;

  const canMarkShinglesDone = !jobIsLocked && feltCompletedMs != null;

  const hasPricing =
    job.pricing &&
    Number.isFinite(job.pricing.sqft) &&
    Number.isFinite(job.pricing.ratePerSqFt);

  const displaySqft = editingPricing
    ? Number(sqft || 0)
    : job.pricing?.sqft ?? 0;
  const displayRate = editingPricing
    ? rate
    : Number(job.pricing?.ratePerSqFt) || 31;
  const displayTotal = editingPricing
    ? totalJobPayCentsPreview
    : job.earnings?.totalEarningsCents ??
      calculateJobBasePayCents(displaySqft, displayRate, effectiveJobFeeCents);
  const flashingSaved = job.earnings?.flashingPay;
  const flashingSavedCents = flashingSaved?.amountCents ?? 0;
  const hasFlashingPay = flashingSavedCents > 0;

  const savedPricingSqft = job.pricing?.sqft ?? 0;
  const savedPricingRate = (job.pricing?.ratePerSqFt as 31 | 35) ?? 31;

  const explicitSavedFeeCents = (job.pricing as any)?.feeCents;

  const inferredSavedFeeCents =
    typeof job.earnings?.totalEarningsCents === "number"
      ? Math.max(
          0,
          Math.round(
            job.earnings.totalEarningsCents -
              flashingSavedCents -
              savedPricingSqft * savedPricingRate * 100
          )
        )
      : null;

  const savedJobFeeCents =
    typeof explicitSavedFeeCents === "number" &&
    Number.isFinite(explicitSavedFeeCents)
      ? normalizeJobFeeCents(explicitSavedFeeCents, FALLBACK_JOB_FEE_CENTS)
      : inferredSavedFeeCents != null
      ? normalizeJobFeeCents(inferredSavedFeeCents, FALLBACK_JOB_FEE_CENTS)
      : effectiveJobFeeCents;

  const savedJobFeeLabel = formatFeeLabel(savedJobFeeCents);

  const currentOrgDefaultTotalCents =
    calculateJobBasePayCents(
      savedPricingSqft,
      savedPricingRate,
      effectiveJobFeeCents
    ) + flashingSavedCents;

  const savedJobTotalCents =
    job.earnings?.totalEarningsCents ??
    calculateJobBasePayCents(
      savedPricingSqft,
      savedPricingRate,
      savedJobFeeCents
    ) + flashingSavedCents;

  const pricingUsesHistoricalFee =
    hasPricing && savedJobFeeCents !== effectiveJobFeeCents;

  const pricingFeeDeltaCents = currentOrgDefaultTotalCents - savedJobTotalCents;

  const pricingFeeDeltaLabel =
    pricingFeeDeltaCents === 0
      ? "$0.00"
      : `${pricingFeeDeltaCents > 0 ? "+" : "-"}${formatFeeLabel(
          Math.abs(pricingFeeDeltaCents)
        )}`;

  const flashingSavedLabel = hasFlashingPay
    ? `${flashingSaved?.units ?? 0} × $${(
        (flashingSaved?.unitPriceCents ?? 0) / 100
      ).toFixed(2)}`
    : null;

  return (
    <>
      <div className="w-full relative h-full  ">
        {/* ===== Global Toast ===== */}
        <AnimatePresence>
          {toast && (
            <motion.div
              {...toastAnim}
              className="fixed max-w-[300px] right-6 top-6 lg:top-20 lg:right-20 z-[100]"
            >
              <div className="flex items-start gap-3 px-4 py-4 text-sm shadow-xl border border-[var(--color-border)] backdrop-blur">
                <div className="mt-0.5">
                  {toast.status === "success" ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                  )}
                </div>

                <div className="flex-1">
                  <div
                    className={
                      "font-semibold " +
                      (toast.status === "success"
                        ? "text-emerald-400"
                        : "text-red-400")
                    }
                  >
                    {toast.title}
                  </div>

                  <div className="mt-0.5 text-xs text-[var(--color-muted)]">
                    {toast.message}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setToast(null)}
                  className="ml-2 rounded-full p-1 text-gray-400 hover:bg-white/10 hover:text-white transition"
                  aria-label="Dismiss"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <motion.div
          {...fadeUp(0)}
          className="sticky top-17 z-20 border-b border-[var(--color-border)] bg-[var(--rz-topbar)] py-4 backdrop-blur-xl"
        >
          <div className="mx-auto w-full max-w-[1200px] px-4">
            <div className="flex flex-col gap-4">
              <div className="text-center">
                <h1 className="text-base font-semibold leading-tight text-[var(--color-text)] sm:text-lg lg:text-xl">
                  {headerAddress}
                </h1>

                <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs sm:text-sm text-[var(--color-muted)]">
                  <span>Created: {createdStr}</span>
                  <span>Updated: {updatedStr}</span>
                  <span>Job ID: {job.id}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setHomeownerDraft({
                      name: job.homeowner?.name ?? "",
                      phone: job.homeowner?.phone ?? "",
                      email: job.homeowner?.email ?? "",
                    });
                    setHomeownerOpen(true);
                  }}
                  className="inline-flex items-center gap-2 cursor-pointer rounded-xl border border-[var(--color-border)] bg-[var(--color-card-alt)] px-3 py-2 text-xs font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-card-hover)]"
                  title="Add homeowner information used by warranty packets"
                >
                  <UserRound className="h-4 w-4 text-[var(--color-muted)]" />
                  {job.homeowner?.name ? "Homeowner" : "Add homeowner"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    void openBillingRecipientModal();
                  }}
                  className="inline-flex items-center gap-2 cursor-pointer rounded-xl border border-[var(--color-border)] bg-[var(--color-card-alt)] px-3 py-2 text-xs font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-card-hover)]"
                  title="Set who invoices should be billed to for this job"
                >
                  <Building2 className="h-4 w-4 text-[var(--color-muted)]" />
                  <span className="hidden sm:inline">Bill to:</span>
                  <span>{billingSummary.label}</span>
                  <span className="max-w-[150px] truncate text-[var(--color-muted)]">
                    {billingSummary.value !== "Not set"
                      ? `• ${billingSummary.value}`
                      : "• Not set"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setWarrantyCenterOpen(true)}
                  className="inline-flex items-center gap-2 cursor-pointer rounded-xl border border-[var(--color-border)] bg-[var(--color-card-alt)] px-3 py-2 text-xs font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-card-hover)]"
                  title="Manage warranty details for this job"
                >
                  Warranty
                </button>

                <button
                  type="button"
                  onClick={() => setSummaryNotesOpen(true)}
                  className="inline-flex items-center gap-2 cursor-pointer rounded-xl border border-[var(--color-border)] bg-[var(--color-card-alt)] px-3 py-2 text-xs font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-card-hover)]"
                  title="Edit summary notes used in the job report"
                >
                  Summary notes
                </button>

                <button
                  type="button"
                  onClick={() => setJobReportOpen(true)}
                  className="inline-flex items-center gap-2 cursor-pointer rounded-xl border border-[var(--color-border)] bg-[var(--color-card-alt)] px-3 py-2 text-xs font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-card-hover)]"
                  title="Open internal job report with financials"
                >
                  Job report
                </button>

                <div className="inline-flex items-center gap-2 px-3 py-2 text-xs uppercase tracking-wide text-[var(--color-muted)]">
                  <span>Status</span>
                  <span
                    className={`px-2 text-[10px] py-0.5 ${statusClasses(
                      job.status as JobStatus
                    )}`}
                  >
                    {job.status}
                  </span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 text-left">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                    Earnings
                  </div>
                  <div className="mt-1.5 text-lg font-semibold text-[var(--color-text)]">
                    <CountMoney cents={totals.earnings} />
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 text-left">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                    Expenses
                  </div>
                  <div className="mt-1.5 text-lg font-semibold text-[var(--color-text)]">
                    <CountMoney cents={totals.expenses} />
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 text-left">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                    Profit
                  </div>
                  <div className="mt-1.5 text-lg font-semibold text-[var(--color-text)]">
                    <CountMoney cents={totals.net} />
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 text-left">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
                    Roof Size
                  </div>
                  <div className="mt-1.5 text-lg font-semibold text-[var(--color-text)]">
                    {roofSizeLabel}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="h-full w-full bg-[var(--color-background)]">
          {/* new design */}
          <div className="mx-auto w-full max-w-[1440px] px-3 py-4 sm:px-5 lg:px-8">
            {/* MOBILE-ONLY SECTION NAV */}
            <div className="lg:hidden sticky top-15 z-30 mb-4">
              <motion.div
                // slide up out of view when we hide it; slide down to 0px when we show it
                animate={{ y: showMobileSectionNav ? 0 : "-100%" }}
                // don’t mount/unmount — reuse the element for performance and no layout shift
                initial={false}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="border border-[var(--color-border)] bg-[var(--color-background)] backdrop-blur-xl"
              >
                <div className="px-3 pt-3 pb-2">
                  <Link to="/jobs">
                    <div className="flex items-center gap-2 px-1 py-2 transition hover:bg-[var(--color-card-hover)]">
                      <MdArrowBackIos className="text-sm" />
                      <h1 className="font-poppins text-[13px] leading-none">
                        Back to jobs
                      </h1>
                    </div>
                  </Link>

                  <nav className="mt-2 grid grid-cols-2 gap-1.5">
                    {sections.map((item) => {
                      const isActive = activeSection === item;
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setActiveSection(item)}
                          className={[
                            "flex min-h-[42px] items-center justify-between px-2.5 py-2 text-left text-[13px] font-medium transition",
                            isActive
                              ? "bg-[var(--color-card)] text-[var(--btn-text)] shadow-sm"
                              : "text-[var(--color-text)]/60 hover:bg-[var(--color-card-hover)] hover:text-[var(--color-text)]",
                          ].join(" ")}
                        >
                          <span className="truncate">{item}</span>
                          {isActive ? (
                            <span className="ml-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-blue)] opacity-90" />
                          ) : null}
                        </button>
                      );
                    })}
                  </nav>
                </div>
              </motion.div>
            </div>
            <div className="grid min-h-0 grid-cols-1 gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
              {/* LEFT PANEL */}
              <aside className="hidden min-h-0 lg:block">
                <div className="xl:sticky xl:top-71 xl:self-start">
                  <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-2">
                    <Link to="/jobs">
                      <div className="flex items-center gap-2  hover:bg-[var(--color-card-hover)]  py-3 px-4 ">
                        <MdArrowBackIos />

                        <h1 className="font-poppins  text-sm">Back to jobs</h1>
                      </div>
                    </Link>
                    <nav className="flex flex-col p-2 gap-1">
                      {sections.map((item) => {
                        const isActive = activeSection === item;

                        return (
                          <button
                            key={item}
                            type="button"
                            onClick={() => setActiveSection(item)}
                            className={[
                              "flex items-center cursor-pointer justify-between  px-3 py-2.5 text-left text-sm font-medium transition",
                              isActive
                                ? "bg-[var(--color-card)] text-[var(--btn-text)] shadow-sm"
                                : "text-[var(--color-text)]/50 hover:bg-[var(--color-card-hover)] hover:text-[var(--color-text)]",
                            ].join(" ")}
                          >
                            <span>{item}</span>
                            {isActive ? (
                              <span className="h-2 w-2 rounded-full text-[var(--color-blue)] bg-current opacity-90" />
                            ) : null}
                          </button>
                        );
                      })}
                    </nav>
                  </div>
                </div>
              </aside>

              {/* RIGHT PANEL */}
              <main className="min-h-0">
                <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
                  <div className="border-b border-[var(--color-border)] px-5 py-4 sm:px-6">
                    <h3 className="text-xl font-semibold text-[var(--color-text)]">
                      {activeSection}
                    </h3>
                  </div>

                  <div className="">
                    {activeSection === "Schedule" && (
                      <section className="relative z-10 rounded-2xl p-5 max-w-[1200px]">
                        {/* Scheduling controls */}
                        <div className="w-full  rounded-2xl  p-3 sm:p-4 ">
                          <div className="grid gap-5 md:grid-cols-3">
                            {/* DRY IN */}
                            <motion.div
                              {...scheduleCardMotion(0.06)}
                              className="bg-[var(--color-card-hover)]  p-6 shadow-sm "
                            >
                              <div className="flex items-start justify-between gap-3 ">
                                <div className="min-w-0 ">
                                  <div className="flex gap-1 items-center">
                                    <div className="text-lg font-semibold uppercase tracking-wide text-[var(--color-text)] text-center">
                                      Dry in
                                    </div>
                                    {feltCompletedMs ? (
                                      <span className="inline-flex items-center gap-1  px-2 py-0.5 text-sm font-semibold text-[var(--text-status-complete)] bg-[var(--bg-status-complete)]">
                                        <CheckCircle2 size={14} />
                                        Done
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1   px-2 py-1 text-sm font-semibold text-[var(--color-pending)] ">
                                        <Clock size={14} />
                                        Pending
                                      </span>
                                    )}
                                  </div>

                                  <div className="mt-1 text-sm md:text-lg text-[var(--color-text)]/80">
                                    {feltCompletedMs
                                      ? `Completed ${fmtLongDate(
                                          feltCompletedMs
                                        )}`
                                      : feltScheduledMs
                                      ? `Scheduled for ${fmtLongDate(
                                          feltScheduledMs
                                        )}`
                                      : "Not scheduled"}
                                  </div>
                                </div>
                              </div>

                              <div className="mt-7 flex flex-wrap items-center gap-2">
                                {!feltCompletedMs ? (
                                  <>
                                    <button
                                      type="button"
                                      disabled={jobIsLocked}
                                      onClick={() => {
                                        if (jobIsLocked) return;
                                        setFeltScheduleDate(
                                          feltScheduledMs
                                            ? toYMD(new Date(feltScheduledMs))
                                            : toYMD(new Date())
                                        );
                                        setFeltScheduleEditing(true);
                                      }}
                                      className={
                                        "px-2.5 py-1 text-xs lg:text-md font-medium transition  " +
                                        (jobIsLocked
                                          ? "bg-white/10 text-white/40 cursor-not-allowed ring-white/10"
                                          : "bg-[var(--color-card)] cursor-pointer text-[var(--color-text)] ring-1 ring-white/10")
                                      }
                                    >
                                      {feltScheduledMs
                                        ? "Reschedule"
                                        : "Schedule"}
                                    </button>

                                    <button
                                      type="button"
                                      disabled={jobIsLocked}
                                      onClick={() => {
                                        if (jobIsLocked) return;
                                        setConfirmFeltDoneOpen(true);
                                      }}
                                      className={
                                        "px-2.5 py-1 text-xs lg:text-md font-semibold cursor-pointer transition ring-1 ring-white/10 bg-[var(--color-card)]  " +
                                        (jobIsLocked
                                          ? "text-[var(--color-text)] cursor-not-allowed "
                                          : "  text-[var(--color-text)]")
                                      }
                                    >
                                      Mark done
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={jobIsLocked}
                                    onClick={() => {
                                      if (jobIsLocked) return;
                                      void reopenFelt();
                                    }}
                                    className={
                                      "px-2.5 py-1 text-[11px] font-semibold transition ring-1 " +
                                      (jobIsLocked
                                        ? "bg-white/10 text-white/40 cursor-not-allowed ring-white/10"
                                        : "bg-[var(--color-surface)]/40 text-[var(--color-text)] hover:bg-[var(--color-card-hover)] ring-white/10")
                                    }
                                    title="Undo dry-in completion"
                                  >
                                    Reopen
                                  </button>
                                )}
                              </div>
                            </motion.div>

                            {/* Shingles */}
                            <motion.div
                              {...scheduleCardMotion(0.14)}
                              className="bg-[var(--color-card-hover)]   p-6 shadow-sm "
                            >
                              <div className="flex items-start justify-between gap-3 ">
                                <div className="min-w-0 ">
                                  <div className="flex gap-1 items-center">
                                    <div className="text-lg font-semibold uppercase tracking-wide text-[var(--color-text)] text-center">
                                      Shingles
                                    </div>
                                    {shinglesCompletedMs ? (
                                      <span className="inline-flex items-center gap-1  px-2 py-0.5 text-sm font-semibold text-[var(--text-status-complete)] bg-[var(--bg-status-complete)]">
                                        <CheckCircle2 size={14} />
                                        Done
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1   px-2 py-1 text-sm font-semibold text-[var(--color-pending)] ">
                                        <Clock size={14} />
                                        Pending
                                      </span>
                                    )}
                                  </div>

                                  <div className="mt-1 text-sm md:text-lg text-[var(--color-text)]/80">
                                    {shinglesCompletedMs
                                      ? `Completed ${fmtLongDate(
                                          shinglesCompletedMs
                                        )}`
                                      : shinglesScheduledMs
                                      ? `Scheduled for ${fmtLongDate(
                                          shinglesScheduledMs
                                        )}`
                                      : "Not scheduled"}
                                  </div>
                                </div>
                              </div>

                              <div className="mt-7 flex flex-wrap items-center gap-2">
                                {!shinglesCompletedMs ? (
                                  <>
                                    <button
                                      type="button"
                                      disabled={jobIsLocked}
                                      onClick={() => {
                                        if (jobIsLocked) return;
                                        setShinglesScheduleDate(
                                          shinglesScheduledMs
                                            ? toYMD(
                                                new Date(shinglesScheduledMs)
                                              )
                                            : toYMD(new Date())
                                        );
                                        setShinglesScheduleEditing(true);
                                      }}
                                      className={
                                        "px-2.5 py-1 text-xs lg:text-md font-medium transition  " +
                                        (jobIsLocked
                                          ? "bg-white/10 text-white/40 cursor-not-allowed ring-white/10"
                                          : "bg-[var(--color-card)] cursor-pointer text-[var(--color-text)] ring-1 ring-white/10")
                                      }
                                    >
                                      {shinglesScheduledMs
                                        ? "Reschedule"
                                        : "Schedule"}
                                    </button>

                                    <button
                                      type="button"
                                      disabled={!canMarkShinglesDone}
                                      title={
                                        !feltCompletedMs
                                          ? "Complete DRY IN first to mark shingles done."
                                          : undefined
                                      }
                                      onClick={() => {
                                        if (!canMarkShinglesDone) return;
                                        setConfirmShinglesDoneOpen(true);
                                      }}
                                      className={
                                        "px-2.5 py-1 text-xs lg:text-md font-semibold  transition ring-1 ring-white/10  " +
                                        (!canMarkShinglesDone
                                          ? "bg-white/10 text-white/40 cursor-not-allowed "
                                          : "text-[var(--color-text)] hover:bg-[var(--color-card-hover)] cursor-pointer")
                                      }
                                    >
                                      Mark done
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={jobIsLocked}
                                    onClick={() => {
                                      if (jobIsLocked) return;
                                      void reopenShingles();
                                    }}
                                    className={
                                      "px-2.5 py-1 text-[11px] font-semibold transition ring-1 " +
                                      (jobIsLocked
                                        ? "bg-white/10 text-white/40 cursor-not-allowed ring-white/10"
                                        : "bg-[var(--color-surface)]/40 text-[var(--color-text)] hover:bg-[var(--color-card-hover)] ring-white/10")
                                    }
                                    title="Undo shingles completion"
                                  >
                                    Reopen
                                  </button>
                                )}
                              </div>

                              {!feltCompletedMs && !shinglesCompletedMs ? (
                                <div className="mt-2 flex items-center gap-2 text-[11px] text-[var(--color-muted)]">
                                  <AlertTriangle
                                    size={14}
                                    className="opacity-80"
                                  />
                                  <span>
                                    Shingles completion requires dry in first.
                                  </span>
                                </div>
                              ) : null}
                            </motion.div>

                            {/* Punch */}
                            <motion.div
                              {...scheduleCardMotion(0.22)}
                              className="bg-[var(--color-card-hover)] p-6 shadow-sm"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex gap-1 items-center">
                                    <div className="text-lg font-semibold uppercase tracking-wide text-[var(--color-text)] text-center">
                                      Punch
                                    </div>

                                    {punchedAtMs != null ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-sm font-semibold text-[var(--text-status-complete)] bg-[var(--bg-status-complete)]">
                                        <CheckCircle2 size={14} />
                                        Done
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-1 text-sm font-semibold text-[var(--color-pending)]">
                                        <Clock size={14} />
                                        Pending
                                      </span>
                                    )}
                                  </div>

                                  <div className="mt-1 text-sm md:text-lg text-[var(--color-text)]/80">
                                    {punchedAtMs != null
                                      ? `Punched on ${punchedAtLabel}`
                                      : punchScheduledLabel
                                      ? `Scheduled for ${punchScheduledLabel}`
                                      : "Not scheduled"}
                                  </div>
                                </div>
                              </div>

                              <div className="mt-7 flex flex-wrap items-center gap-2">
                                {punchedAtMs != null ? (
                                  <button
                                    type="button"
                                    disabled={
                                      job.status === "closed" ||
                                      job.status === "archived"
                                    }
                                    onClick={() =>
                                      setConfirmUndoPunchOpen(true)
                                    }
                                    className={
                                      "px-2.5 py-1 text-[11px] font-semibold transition ring-1 " +
                                      (job.status === "closed" ||
                                      job.status === "archived"
                                        ? "bg-white/10 text-white/40 cursor-not-allowed ring-white/10"
                                        : "bg-[var(--color-surface)]/40 text-[var(--color-text)] hover:bg-[var(--color-card-hover)] ring-white/10")
                                    }
                                    title="Undo punch completion and reopen this job"
                                  >
                                    Reopen
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      disabled={!canSchedulePunch}
                                      title={
                                        !hasFeltScheduledOrCompleted
                                          ? "Schedule DRY IN first."
                                          : !hasShinglesScheduledOrCompleted
                                          ? "Schedule shingles first."
                                          : undefined
                                      }
                                      onClick={() => {
                                        if (!canSchedulePunch) return;
                                        setSchedulePunchOpen(true);

                                        const base =
                                          job.punchScheduledFor ?? new Date();
                                        setSchedulePunchDate(toYMD(base));
                                      }}
                                      className={
                                        "px-2.5 py-1 text-xs lg:text-md font-medium transition ring-1 " +
                                        (!canSchedulePunch
                                          ? "bg-white/10 text-white/40 cursor-not-allowed ring-white/10"
                                          : "bg-[var(--color-surface)]/40 cursor-pointer text-[var(--color-text)]/70 hover:bg-[var(--color-card-hover)] ring-white/10")
                                      }
                                    >
                                      {job.punchScheduledFor
                                        ? "Reschedule"
                                        : "Schedule"}
                                    </button>

                                    <button
                                      type="button"
                                      disabled={!canMarkPunchDone}
                                      title={
                                        !feltCompletedMs
                                          ? "Complete DRY IN first."
                                          : !shinglesCompletedMs
                                          ? "Complete shingles first."
                                          : undefined
                                      }
                                      onClick={() => {
                                        if (!canMarkPunchDone) return;
                                        setConfirmPunchedOpen(true);
                                      }}
                                      className={
                                        "px-2.5 py-1 text-xs lg:text-md font-semibold transition ring-1 ring-white/10 " +
                                        (!canMarkPunchDone
                                          ? "bg-white/10 text-white/40 cursor-not-allowed"
                                          : "cursor-pointer hover:bg-[var(--color-card-hover)] text-[var(--color-text)]")
                                      }
                                    >
                                      Mark done
                                    </button>
                                  </>
                                )}
                              </div>
                            </motion.div>
                          </div>
                        </div>
                      </section>
                    )}

                    {activeSection === "Pricing" && (
                      <section className="p-5">
                        <div className="w-full max-w-[560px]">
                          {pricingUsesHistoricalFee && !editingPricing && (
                            <div className="mb-4 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 shadow-sm">
                              <div className="flex items-start gap-3">
                                <div className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-amber-300/25 bg-amber-300/10 text-amber-200">
                                  <AlertTriangle className="h-4 w-4" />
                                </div>

                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-[var(--color-text)]">
                                    Historical pricing fee
                                  </div>

                                  <p className="mt-1 text-xs leading-5 text-[rgb(var(--color-text-rgb)/0.68)]">
                                    This job is still using its saved fixed fee
                                    of{" "}
                                    <span className="font-semibold text-[var(--color-text)]">
                                      {savedJobFeeLabel}
                                    </span>
                                    . Your current organization default is{" "}
                                    <span className="font-semibold text-[var(--color-text)]">
                                      {effectiveJobFeeLabel}
                                    </span>
                                    . Existing totals will stay unchanged unless
                                    you edit pricing and click Apply.
                                  </p>

                                  <div className="mt-2 inline-flex rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-[11px] font-semibold text-amber-100">
                                    Applying current fee would change job pay by{" "}
                                    {pricingFeeDeltaLabel}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                          {!hasPricing || editingPricing ? (
                            <div className="rounded-2xl  shadow-sm px-5 py-6 text-left w-full">
                              <div className="mb-2 text-sm md:text-xl lg:text-2xl text-[var(--color-text)] text-right">
                                Total Job Pay
                              </div>
                              <div className="text-2xl font-semibold text-[var(--color-text)] mx-auto text-right">
                                <CountMoney cents={totalJobPayCentsPreview} />
                              </div>
                              {hasFlashingPay && (
                                <div className="mt-1 text-xs text-[var(--color-muted)]">
                                  Includes{" "}
                                  <span className="font-medium text-[var(--color-text)]">
                                    Flashing (C/J/L)
                                  </span>
                                  :{" "}
                                  <span className="font-medium text-[var(--color-text)]">
                                    <CountMoney cents={flashingSavedCents} />
                                  </span>
                                  {flashingSavedLabel ? (
                                    <span className="ml-2 opacity-70">
                                      ({flashingSavedLabel})
                                    </span>
                                  ) : null}
                                </div>
                              )}
                              {pricingUsesHistoricalFee && (
                                <div className="mt-4 rounded-2xl border border-sky-400/20 bg-sky-400/10 px-4 py-3 text-xs leading-5 text-[rgb(var(--color-text-rgb)/0.72)]">
                                  <div className="font-semibold text-[var(--color-text)]">
                                    Preview is using the current default fee
                                  </div>
                                  <div className="mt-1">
                                    This job was originally priced with{" "}
                                    <span className="font-semibold text-[var(--color-text)]">
                                      {savedJobFeeLabel}
                                    </span>
                                    . This edit preview uses your current fixed
                                    fee of{" "}
                                    <span className="font-semibold text-[var(--color-text)]">
                                      {effectiveJobFeeLabel}
                                    </span>
                                    . Click Apply only if you want this job
                                    updated to the current pricing default.
                                  </div>
                                </div>
                              )}

                              <div className="mt-3 flex flex-wrap items-center justify-end gap-2 text-xs">
                                <input
                                  value={sqft}
                                  onChange={(e) => setSqft(e.target.value)}
                                  type="number"
                                  min={0}
                                  step="1"
                                  placeholder="Sq"
                                  className="w-24  border border-[var(--color-border)]  px-2 py-2 text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                                />
                                {hasOrgCommonRates ? (
                                  <select
                                    value={rate}
                                    onChange={(e) => {
                                      setRate(Number(e.target.value));
                                      setRateSavePrompt(null);
                                    }}
                                    className="w-24 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/35 px-2 py-1 text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                                    title="Pay rate"
                                  >
                                    {pricingRateOptions.map((optionRate) => (
                                      <option
                                        key={optionRate}
                                        value={optionRate}
                                      >
                                        ${optionRate}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <div className="flex flex-col items-end gap-2">
                                    <input
                                      value={rate > 0 ? String(rate) : ""}
                                      onChange={(e) =>
                                        handleManualPricingRateChange(
                                          e.target.value
                                        )
                                      }
                                      type="number"
                                      min={0}
                                      step="0.01"
                                      placeholder="Rate"
                                      className="w-24 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/35 px-2 py-1 text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                                      title="Pay rate"
                                    />

                                    {rateSavePrompt !== null && (
                                      <div className="w-[260px] rounded-2xl border border-amber-400/25 bg-amber-400/10 p-3 text-left shadow-sm">
                                        <div className="text-xs font-semibold text-[var(--color-text)]">
                                          Save ${rateSavePrompt}/SQ as a common
                                          rate?
                                        </div>

                                        <p className="mt-1 text-[11px] leading-4 text-[rgb(var(--color-text-rgb)/0.65)]">
                                          This will make it available in the
                                          pricing dropdown for future jobs in
                                          this organization.
                                        </p>

                                        <div className="mt-3 flex items-center gap-2">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              void saveRateToOrgSettings(
                                                rateSavePrompt
                                              )
                                            }
                                            disabled={savingCommonRate}
                                            className="rounded-lg bg-[var(--btn-bg)] px-3 py-1.5 text-[11px] font-semibold text-[var(--btn-text)] transition hover:bg-[var(--btn-hover-bg)] disabled:cursor-not-allowed disabled:opacity-60"
                                          >
                                            {savingCommonRate
                                              ? "Saving..."
                                              : "Save rate"}
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() =>
                                              setRateSavePrompt(null)
                                            }
                                            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/35 px-3 py-1.5 text-[11px] font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-card-hover)]"
                                          >
                                            Not now
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                                <span className="text-[var(--color-muted)]">
                                  + {effectiveJobFeeLabel} fee
                                </span>
                                <button
                                  onClick={() => {
                                    if (!job) return;

                                    const nSqft = Math.max(
                                      0,
                                      Number(sqft) || 0
                                    );

                                    // 1) base labor pay (sqft * rate + org default fee)
                                    const basePayCents =
                                      calculateJobBasePayCents(
                                        nSqft,
                                        rate,
                                        effectiveJobFeeCents
                                      );

                                    // 2) material pay add-ons (optional)
                                    // IMPORTANT: this assumes you added job.earnings.materialPay: { amountCents: number }[]
                                    const flashingPayCents =
                                      job.earnings?.flashingPay?.amountCents ??
                                      0;

                                    const updated: Job = {
                                      ...job,
                                      pricing: {
                                        sqft: nSqft,
                                        ratePerSqFt: rate,
                                        feeCents: effectiveJobFeeCents,
                                      },
                                      earnings: {
                                        ...(job.earnings ?? {}),
                                        totalEarningsCents:
                                          basePayCents + flashingPayCents,
                                      },
                                    };

                                    void saveJob(updated);
                                    setEditingPricing(false);
                                  }}
                                  className="ml-2  bg-[var(--status-complete)] cursor-pointer transition duration-300 ease-in-out px-3 py-1 text-[var(--color-background)]"
                                >
                                  Apply
                                </button>
                                {hasPricing && (
                                  <button
                                    onClick={() => {
                                      setSqft(String(job.pricing?.sqft ?? ""));
                                      setRate(
                                        Number(job.pricing?.ratePerSqFt) || 31
                                      );
                                      setRateSavePrompt(null);
                                      setEditingPricing(false);
                                    }}
                                    className="cursor-pointer bg-[var(--color-surface)]/35 px-3 py-1"
                                  >
                                    Cancel
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="w-full sm:w-auto">
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={() => {
                                  setSqft(String(job.pricing?.sqft ?? ""));
                                  setRate(
                                    (job.pricing?.ratePerSqFt as 31 | 35) ?? 31
                                  );

                                  // ✅ NEW: prefill flashing inputs from saved job data
                                  prefillFlashingInputs();

                                  setEditingPricing(true);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    setSqft(String(job.pricing?.sqft ?? ""));
                                    setRate(
                                      (job.pricing?.ratePerSqFt as 31 | 35) ??
                                        31
                                    );

                                    // ✅ NEW: prefill flashing inputs from saved job data
                                    prefillFlashingInputs();

                                    setEditingPricing(true);
                                  }
                                }}
                                className="group w-full sm:min-w-[360px] rounded-2xl bg-[var(--color-surface)]/35 shadow-md ring-1 ring-white/10 px-4 py-3 text-left transition hover:bg-[var(--color-card-hover)] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                                title="Edit pricing"
                              >
                                <div className="flex items-end justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="mt-0.5 text-sm md:text-lg font-medium text-[var(--color-text)]">
                                      <span className="truncate">
                                        {Number(
                                          displaySqft || 0
                                        ).toLocaleString()}{" "}
                                        sq @ $ {displayRate}
                                        /sq.ft{" "}
                                        <span className="opacity-70">
                                          • + {savedJobFeeLabel}
                                        </span>
                                      </span>

                                      {pricingUsesHistoricalFee && (
                                        <span className="ml-2 inline-flex align-middle rounded-full border border-amber-300/25 bg-amber-300/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-100">
                                          Historical fee
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <div className="text-right">
                                      <div className="text-xs md:text-md mb-2 uppercase tracking-wide text-[var(--color-muted)]">
                                        Total
                                      </div>
                                      <div className="text-xl font-semibold text-[var(--color-text)] leading-none">
                                        <CountMoney cents={displayTotal} />
                                      </div>
                                      {hasFlashingPay && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation(); // IMPORTANT: don't trigger the Pricing card click
                                            prefillFlashingInputs();
                                            setFlashingModalOpen(true);
                                          }}
                                          className="mt-1 inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100"
                                          title="Edit flashing pay"
                                        >
                                          +{" "}
                                          <CountMoney
                                            cents={flashingSavedCents}
                                          />{" "}
                                          &nbsp; flashing included • Edit
                                        </button>
                                      )}
                                      {!hasFlashingPay && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            prefillFlashingInputs();
                                            setFlashingModalOpen(true);
                                          }}
                                          className="mt-2  items-center hidden rounded-full bg-[var(--color-surface)]/35 px-2 py-0.5 text-[10px] font-medium text-[var(--color-text)] ring-1 ring-white/10 hover:bg-[var(--color-card-hover)]"
                                          title="Add flashing pay"
                                        >
                                          + Add flashing pay
                                        </button>
                                      )}
                                    </div>

                                    <span className="ml-1 inline-flex cursor-pointer h-9 w-9 items-center justify-center   bg-[var(--color-surface)]/30 text-[var(--color-muted)] hover:text-white  transition group-hover:bg-[var(--color-surface)]/35">
                                      <Pencil className="h-4 w-4" />
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </section>
                    )}

                    {activeSection === "Overview" && (
                      <section className=" p-5">
                        {/* Stat row + profit bar */}
                        <motion.div className=" p-4 " {...fadeUp(0.05)}>
                          <div className="grid gap-4 sm:grid-cols-4 ">
                            <motion.div {...scheduleCardMotion(0.08)}>
                              <Stat label="Payouts" cents={totals.payouts} />
                            </motion.div>

                            <motion.div {...scheduleCardMotion(0.14)}>
                              <Stat
                                label="Materials Cost"
                                cents={totals.materials}
                              />
                            </motion.div>

                            <motion.div {...scheduleCardMotion(0.2)}>
                              <Stat
                                label="Total Expenses"
                                cents={totals.expenses}
                              />
                            </motion.div>

                            <motion.div
                              {...scheduleCardMotion(0.26)}
                              className="rounded-xl"
                            >
                              <Stat label="Profit" cents={totals.net} />
                            </motion.div>
                          </div>

                          <motion.div className="mt-4" {...fadeUp(0.32)}>
                            <div className="flex items-center justify-between text-xs text-[var(--color-muted)]">
                              <span>
                                <CountMoney cents={totals.expenses} /> /{" "}
                                <CountMoney cents={totals.earnings} />
                              </span>
                            </div>

                            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-black/10">
                              <motion.div
                                className="h-full bg-[var(--color-primary)]/40"
                                initial={{ width: 0 }}
                                animate={{
                                  width: `${totals.expensePortion * 100}%`,
                                }}
                                transition={{
                                  duration: 0.6,
                                  ease: EASE,
                                  delay: 0.38,
                                }}
                                aria-label="Expense portion of earnings"
                              />
                            </div>
                          </motion.div>
                        </motion.div>
                      </section>
                    )}

                    {activeSection === "Activity" && (
                      <section className=" p-5">
                        {/* LATEST ACTIVITY SECTION */}
                        <section className="max-w-[700px]">
                          <div className="max-h-64 overflow-y-auto pr-1 section-scroll lg:section-scroll-lg">
                            {!activityItems.length ? (
                              <div className="rounded-xl bg-[var(--color-surface)]/25 p-4 text-sm text-[var(--color-muted)]">
                                No recent activity for this job yet.
                              </div>
                            ) : (
                              <ul className="space-y-2">
                                {activityItems.map((a) => (
                                  <li
                                    key={a.id}
                                    className="hover:bg-[var(--color-card)] p-3  transition duration-300 ease-in-out"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex min-w-0 items-start gap-3 ">
                                        {a.kind === "photo" && a.photoUrl ? (
                                          <img
                                            src={a.photoUrl}
                                            alt={a.photoCaption ?? "Job photo"}
                                            className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-white/10"
                                            loading="lazy"
                                          />
                                        ) : null}

                                        <div className="min-w-0">
                                          <div className="text-sm font-semibold text-[var(--color-text)]">
                                            {a.title}
                                          </div>

                                          {a.detail ? (
                                            <div className="mt-1 text-xs text-[var(--color-muted)] whitespace-pre-wrap break-words">
                                              {a.detail}
                                            </div>
                                          ) : null}
                                        </div>
                                      </div>

                                      <div className="shrink-0 text-xs text-[var(--color-muted)]">
                                        {a.at.toLocaleString()}
                                      </div>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </section>
                      </section>
                    )}

                    {activeSection === "Payouts" && (
                      <section className="mt-0">
                        <MotionCard delay={0.1}>
                          {/* Left-aligned action */}
                          <div className="flex items-center justify-start">
                            <button
                              type="button"
                              onClick={() => setPayoutModalOpen(true)}
                              className="inline-flex items-center gap-2 cursor-pointer border border-[var(--color-border)] bg-[var(--color-surface)]/35 px-3 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-card-hover)] transition"
                              title="Add payout"
                            >
                              <Plus className="h-4 w-4" />
                              <span className="font-poppins text-md uppercase">
                                Add Payout
                              </span>
                            </button>
                          </div>

                          {/* Existing list */}
                          <div
                            className={`mt-1 section-scroll lg:section-scroll-lg max-w-[700px]  pr-1`}
                          >
                            <ul className="">
                              {(job?.expenses?.payouts ?? []).map((p) => (
                                <motion.li
                                  key={p.id}
                                  className="mb-3 flex items-center justify-between cursor-pointer hover:bg-[var(--color-card)] p-3 transition duration-300 ease-in-out"
                                  variants={item}
                                >
                                  <div className="flex min-w-0 items-center gap-6">
                                    <span className="text-sm font-semibold text-[var(--color-text)]">
                                      {p.payeeNickname}
                                    </span>

                                    {typeof p.sqft === "number" &&
                                      typeof p.ratePerSqFt === "number" && (
                                        <div className="text-[11px] text-[var(--color-muted)]">
                                          {p.sqft.toLocaleString()} sq @ $
                                          {p.ratePerSqFt}/sq.ft
                                        </div>
                                      )}

                                    {p.category && (
                                      <span className="rounded-full bg-black/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--color-text)]">
                                        {p.category}
                                      </span>
                                    )}

                                    <span className="ml-2 text-xs text-[var(--color-muted)]">
                                      {p.paidAt ? fmtDate(p.paidAt) : ""}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2 lg:gap-3">
                                    <CountMoney
                                      cents={p.amountCents}
                                      className="text-sm text-[var(--color-text)]"
                                    />

                                    {p.category !== "technician" && (
                                      <button
                                        type="button"
                                        onClick={() => openEditPayoutModal(p)}
                                        className="cursor-pointer border border-[var(--color-border)] bg-[var(--color-surface)]/35 px-2 py-1 text-xs text-[var(--color-text)] hover:bg-[var(--color-card-hover)]"
                                        title="Edit"
                                      >
                                        Edit
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => removePayout(p.id)}
                                      className="cursor-pointer border border-[var(--color-border)] bg-[var(--color-surface)]/35 px-2 py-1 text-xs text-[var(--color-muted)] hover:bg-[var(--color-card-hover)]"
                                      title="Delete"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </motion.li>
                              ))}

                              {(job?.expenses?.payouts ?? []).length === 0 && (
                                <li className="p-3 text-sm text-[var(--color-muted)]">
                                  No payouts yet.
                                </li>
                              )}
                            </ul>
                          </div>
                        </MotionCard>
                      </section>
                    )}

                    {activeSection === "Materials" && (
                      <section className="max-w-[800px]">
                        {/* Materials */}
                        <MotionCard>
                          <div className="flex items-center justify-start ">
                            <button
                              type="button"
                              onClick={() => setMaterialModalOpen(true)}
                              className="inline-flex items-center gap-2 cursor-pointer border border-[var(--color-border)] bg-[var(--color-surface)]/35 px-3 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-card-hover)] transition "
                              title="Add payout"
                            >
                              <Plus className="h-4 w-4" />
                              <span className="font-poppins text-md uppercase">
                                Add Materials
                              </span>
                            </button>
                          </div>
                          <div className="mt-3">
                            <ul className="rounded-lg mt-0">
                              {(job?.expenses?.materials ?? []).map((m) => (
                                <motion.li
                                  key={m.id}
                                  className="mb-2 flex items-center justify-between  p-3  hover:bg-[var(--color-card)] transition duration-300 ease-in-out"
                                  variants={item}
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm text-[var(--color-text)]">
                                        {getMaterialDisplayName(m)}
                                      </span>

                                      {m.vendor && (
                                        <span className="ml-2 text-xs text-[var(--color-muted)]">
                                          • {m.vendor}
                                        </span>
                                      )}
                                    </div>

                                    <div className="text-xs text-[var(--color-muted)]">
                                      {m.quantity} × $
                                      {(m.unitPriceCents / 100).toFixed(2)}
                                      {getMaterialDisplayUnit(m)
                                        ? ` / ${getMaterialDisplayUnit(m)}`
                                        : ""}
                                      {m.createdAt
                                        ? ` • ${fmtDate(m.createdAt)}`
                                        : ""}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-3">
                                    <CountMoney
                                      cents={m.amountCents}
                                      className="text-sm text-[var(--color-text)]"
                                    />
                                    <button
                                      onClick={() => removeMaterial(m.id)}
                                      className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/35 px-2 py-1 text-xs text-[var(--color-muted)] hover:bg-[var(--color-card-hover)]"
                                      title="Delete"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </motion.li>
                              ))}
                              {(job?.expenses?.materials ?? []).length ===
                                0 && (
                                <li className="p-3 text-sm text-[var(--color-muted)]">
                                  No materials added yet.
                                </li>
                              )}
                            </ul>
                          </div>
                        </MotionCard>
                      </section>
                    )}

                    {activeSection === "Notes" && (
                      <section className="">
                        <MotionCard delay={0.2}>
                          <div className="flex items-center justify-start">
                            <button
                              type="button"
                              onClick={() => setNoteModalOpen(true)}
                              className="inline-flex items-center gap-2 cursor-pointer border border-[var(--color-border)] bg-[var(--color-surface)]/35 px-3 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-card-hover)] transition"
                              title="Add note"
                            >
                              <Plus className="h-4 w-4" />
                              <span className="font-poppins text-md uppercase">
                                Add Note
                              </span>
                            </button>
                          </div>

                          <div
                            className={`mt-1 section-scroll lg:section-scroll-lg max-w-[700px] pr-1`}
                          >
                            <ul>
                              {(job?.notes ?? [])
                                .slice()
                                .reverse()
                                .map((n) => (
                                  <motion.li
                                    key={n.id}
                                    className="mb-2 flex items-start gap-3 rounded-xl bg-[var(--color-surface)]/30 p-3 ring-1 ring-white/10 hover:bg-[var(--color-surface)]/35 transition"
                                    variants={item}
                                  >
                                    <div className="min-w-0 flex-1">
                                      <p className="mr-3 whitespace-pre-wrap break-all text-sm text-[var(--color-text)]">
                                        {n.text}
                                      </p>
                                      <div className="mt-1 text-xs text-[var(--color-muted)]">
                                        {n.createdAt
                                          ? fmtDate(n.createdAt)
                                          : ""}
                                      </div>
                                    </div>

                                    <button
                                      onClick={() => removeNote(n.id)}
                                      className="shrink-0 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/35 px-2 py-1 text-xs text-[var(--color-muted)] hover:bg-[var(--color-card-hover)]"
                                      title="Delete"
                                    >
                                      Delete
                                    </button>
                                  </motion.li>
                                ))}

                              {(job?.notes ?? []).length === 0 && (
                                <li className="p-3 text-sm text-[var(--color-muted)]">
                                  No notes yet.
                                </li>
                              )}
                            </ul>
                          </div>
                        </MotionCard>
                      </section>
                    )}

                    {activeSection === "Photos" && (
                      <section className="">
                        <MotionCard delay={0.25}>
                          <div className="flex items-center justify-start">
                            <button
                              type="button"
                              onClick={() => setPhotoModalOpen(true)}
                              className="inline-flex items-center gap-2 cursor-pointer border border-[var(--color-border)] bg-[var(--color-surface)]/35 px-3 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-card-hover)] transition"
                              title="Add photo"
                            >
                              <Plus className="h-4 w-4" />
                              <span className="font-poppins text-md uppercase">
                                Add Photo
                              </span>
                            </button>
                          </div>

                          <div
                            className={`${LIST_MAX_H} mt-1 section-scroll lg:section-scroll-lg max-w-[700px] overflow-y-auto pr-1`}
                          >
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                              {photos.map((p, i) => (
                                <motion.div
                                  key={p.id}
                                  className="group relative"
                                  variants={item}
                                >
                                  <button
                                    type="button"
                                    onClick={() => openViewer(i)}
                                    className="block w-full focus:outline-none"
                                    aria-label="Open photo"
                                    title="Open"
                                  >
                                    <img
                                      src={
                                        p.thumbUrl ??
                                        p.previewUrl ??
                                        p.fullUrl ??
                                        p.url ??
                                        ""
                                      }
                                      alt={p.caption || ""}
                                      className="h-32 w-full rounded-lg object-cover"
                                      loading="lazy"
                                    />
                                  </button>

                                  <button
                                    onClick={() => deletePhoto(p.id)}
                                    className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-xs text-white opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100"
                                    title="Delete"
                                  >
                                    Delete
                                  </button>

                                  {p.caption && (
                                    <div className="absolute inset-x-0 bottom-0 rounded-b-lg bg-black/50 p-1 text-center text-[10px] text-white">
                                      {p.caption}
                                    </div>
                                  )}
                                </motion.div>
                              ))}

                              {photos.length === 0 && (
                                <div className="p-3 text-sm text-[var(--color-muted)]">
                                  No photos yet.
                                </div>
                              )}
                            </div>
                          </div>
                        </MotionCard>
                      </section>
                    )}
                  </div>
                </div>
              </main>
            </div>

            {/* Home Owner Edit Modal */}
            <ModalShell
              open={homeownerOpen}
              title="Homeowner Information"
              width="md"
              onClose={() => setHomeownerOpen(false)}
            >
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void saveHomeowner();
                }}
              >
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2">
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-primary)]" />
                    <div className="min-w-0">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                        Job address
                      </div>
                      <div className="mt-0.5 text-sm font-semibold leading-snug text-[var(--color-text)] break-words">
                        {headerAddress}
                      </div>
                    </div>
                  </div>
                </div>

                <label className="block">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                    Homeowner name
                  </div>
                  <input
                    value={homeownerDraft.name ?? ""}
                    onChange={(e) =>
                      setHomeownerDraft((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    placeholder="e.g. John Smith"
                    className={UI.input}
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                      Phone
                    </div>
                    <input
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={formatPhoneInput(homeownerDraft.phone ?? "")}
                      onChange={(e) =>
                        setHomeownerDraft((prev) => ({
                          ...prev,
                          phone: cleanPhoneInput(e.target.value),
                        }))
                      }
                      placeholder="(210) 555-1234"
                      className={UI.input}
                    />
                  </label>

                  <label className="block">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                      Email
                    </div>
                    <input
                      value={homeownerDraft.email ?? ""}
                      onChange={(e) =>
                        setHomeownerDraft((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                      placeholder="homeowner@email.com"
                      className={UI.input}
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setHomeownerOpen(false)}
                    className={`${UI.btnSoft} h-9 px-4`}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={homeownerSaving}
                    className={`${UI.btnPrimary} h-9 px-5`}
                  >
                    {homeownerSaving ? "Saving…" : "Save homeowner"}
                  </button>
                </div>
              </form>
            </ModalShell>

            {/* Billing Recipient Modal */}
            <ModalShell
              open={billingOpen}
              title="Billing Recipient"
              subtitle="Choose who invoices should be addressed to for this job."
              width="lg"
              bodyClassName="lg:overflow-y-auto"
              onClose={() => setBillingOpen(false)}
            >
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void saveBillingInformation();
                }}
              >
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2">
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-primary)]" />
                    <div className="min-w-0">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                        Job address
                      </div>
                      <div className="mt-0.5 text-sm font-semibold leading-snug text-[var(--color-text)] break-words">
                        {headerAddress}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                    Invoice recipient type
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {BILLING_RECIPIENT_OPTIONS.map((option) => {
                      const active = billingRecipientDraft === option.value;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            void selectBillingRecipientType(option.value);
                          }}
                          className={[
                            "rounded-xl border px-3 py-3 text-left transition",
                            active
                              ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 shadow-sm"
                              : "border-[var(--color-border)] bg-[var(--color-surface)]/35 hover:bg-[var(--color-card-hover)]",
                          ].join(" ")}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-[var(--color-text)]">
                                {option.label}
                              </div>
                              <div className="mt-1 text-xs leading-relaxed text-[var(--color-muted)]">
                                {option.description}
                              </div>
                            </div>

                            <span
                              className={[
                                "mt-0.5 inline-flex h-4 w-4 shrink-0 rounded-full border",
                                active
                                  ? "border-[var(--color-primary)] bg-[var(--color-primary)]"
                                  : "border-[var(--color-border)] bg-transparent",
                              ].join(" ")}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {billingRecipientDraft === "homeowner" ? (
                  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/35 px-4 py-3">
                    <div className="flex items-start gap-3">
                      <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-primary)]" />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[var(--color-text)]">
                          Using homeowner contact
                        </div>
                        <div className="mt-1 text-xs leading-relaxed text-[var(--color-muted)]">
                          Invoices for this job will use the homeowner info
                          saved on the job. Update the Homeowner button in the
                          header if the name, phone, or email needs to change.
                        </div>

                        <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-xs text-[var(--color-muted)]">
                          <div>
                            <span className="font-semibold text-[var(--color-text)]">
                              Name:
                            </span>{" "}
                            {job.homeowner?.name || "Not set"}
                          </div>
                          <div className="mt-1">
                            <span className="font-semibold text-[var(--color-text)]">
                              Phone:
                            </span>{" "}
                            {job.homeowner?.phone
                              ? formatPhoneInput(job.homeowner.phone)
                              : "Not set"}
                          </div>
                          <div className="mt-1">
                            <span className="font-semibold text-[var(--color-text)]">
                              Email:
                            </span>{" "}
                            {job.homeowner?.email || "Not set"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/25 p-4">
                    <div>
                      <div className="text-sm font-semibold text-[var(--color-text)]">
                        {billingRecipientLabel(billingRecipientDraft)} contact
                      </div>
                      <div className="mt-1 text-xs leading-relaxed text-[var(--color-muted)]">
                        These details are saved separately for this recipient
                        type and will prefill when this type is selected as the
                        active invoice recipient for this job.
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                          Company name
                        </div>
                        <input
                          value={billingContactDraft.companyName ?? ""}
                          onChange={(e) =>
                            setBillingContactDraft((prev) => ({
                              ...prev,
                              companyName: e.target.value,
                            }))
                          }
                          placeholder="e.g. ABC Homes"
                          className={UI.input}
                        />
                      </label>

                      <label className="block">
                        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                          Contact name
                        </div>
                        <input
                          value={billingContactDraft.name ?? ""}
                          onChange={(e) =>
                            setBillingContactDraft((prev) => ({
                              ...prev,
                              name: e.target.value,
                            }))
                          }
                          placeholder="e.g. Maria Lopez"
                          className={UI.input}
                        />
                      </label>

                      <label className="block">
                        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                          Email
                        </div>
                        <input
                          type="email"
                          value={billingContactDraft.email ?? ""}
                          onChange={(e) =>
                            setBillingContactDraft((prev) => ({
                              ...prev,
                              email: e.target.value,
                            }))
                          }
                          placeholder="billing@example.com"
                          className={UI.input}
                        />
                      </label>

                      <label className="block">
                        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                          Phone
                        </div>
                        <input
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          value={formatPhoneInput(
                            billingContactDraft.phone ?? ""
                          )}
                          onChange={(e) =>
                            setBillingContactDraft((prev) => ({
                              ...prev,
                              phone: cleanPhoneInput(e.target.value),
                            }))
                          }
                          placeholder="(210) 555-1234"
                          className={UI.input}
                        />
                      </label>
                    </div>

                    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3">
                      <div className="mb-3">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                          Mailing address
                        </div>
                        <div className="mt-1 text-xs text-[var(--color-muted)]">
                          Optional. Useful for printed invoices, insurance, or
                          builder billing.
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block sm:col-span-2">
                          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                            Address line
                          </div>
                          <input
                            value={
                              billingContactDraft.mailingAddress?.line1 ?? ""
                            }
                            onChange={(e) =>
                              setBillingContactDraft((prev) => ({
                                ...prev,
                                mailingAddress: {
                                  ...(prev.mailingAddress ?? {}),
                                  line1: e.target.value,
                                },
                              }))
                            }
                            placeholder="Street / mailing address"
                            className={UI.input}
                          />
                        </label>

                        <label className="block">
                          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                            City
                          </div>
                          <input
                            value={
                              billingContactDraft.mailingAddress?.city ?? ""
                            }
                            onChange={(e) =>
                              setBillingContactDraft((prev) => ({
                                ...prev,
                                mailingAddress: {
                                  ...(prev.mailingAddress ?? {}),
                                  city: e.target.value,
                                },
                              }))
                            }
                            placeholder="City"
                            className={UI.input}
                          />
                        </label>

                        <div className="grid grid-cols-2 gap-3">
                          <label className="block">
                            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                              State
                            </div>
                            <input
                              value={
                                billingContactDraft.mailingAddress?.state ?? ""
                              }
                              onChange={(e) =>
                                setBillingContactDraft((prev) => ({
                                  ...prev,
                                  mailingAddress: {
                                    ...(prev.mailingAddress ?? {}),
                                    state: e.target.value.toUpperCase(),
                                  },
                                }))
                              }
                              placeholder="TX"
                              className={UI.input}
                            />
                          </label>

                          <label className="block">
                            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                              Zip
                            </div>
                            <input
                              value={
                                billingContactDraft.mailingAddress?.zip ?? ""
                              }
                              onChange={(e) =>
                                setBillingContactDraft((prev) => ({
                                  ...prev,
                                  mailingAddress: {
                                    ...(prev.mailingAddress ?? {}),
                                    zip: e.target.value,
                                  },
                                }))
                              }
                              placeholder="78245"
                              className={UI.input}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setBillingOpen(false)}
                    className={`${UI.btnSoft} h-9 px-4`}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={billingSaving}
                    className={`${UI.btnPrimary} h-9 px-5`}
                  >
                    {billingSaving ? "Saving…" : "Save billing recipient"}
                  </button>
                </div>
              </form>
            </ModalShell>

            {/* Summary Notes Modal */}
            <ModalShell
              open={summaryNotesOpen}
              title="Edit summary notes"
              width="md"
              onClose={() => {
                setSummaryNotesDraft(job?.summaryNotes ?? "");
                setSummaryNotesOpen(false);
              }}
            >
              <form
                className="grid gap-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await saveSummaryNotes();
                }}
              >
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2">
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-primary)]" />
                    <div className="min-w-0">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                        Job address
                      </div>
                      <div className="mt-0.5 text-sm font-semibold leading-snug text-[var(--color-text)] break-words">
                        {headerAddress}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[var(--color-text)]">
                      Summary notes
                    </div>
                    <div className="text-xs text-[var(--color-muted)]">
                      These appear in the printed job report and should stay
                      concise and useful.
                    </div>
                  </div>

                  <div className="text-[11px] text-[var(--color-muted)] tabular-nums">
                    {summaryNotesDraft.length}/1200
                  </div>
                </div>

                <textarea
                  value={summaryNotesDraft}
                  onChange={(e) => {
                    const next = e.target.value;
                    setSummaryNotesDraft(
                      next.length > 1200 ? next.slice(0, 1200) : next
                    );
                  }}
                  placeholder="Add a concise summary of this job for reporting and bookkeeping..."
                  rows={8}
                  className={`${
                    (UI as any).textarea ?? UI.input
                  } min-h-[220px]`}
                />

                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setSummaryNotesDraft(job?.summaryNotes ?? "");
                      setSummaryNotesOpen(false);
                    }}
                    className={`${UI.btnSoft} h-8 px-4 inline-flex`}
                  >
                    Cancel
                  </button>

                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      type="button"
                      onClick={() => setSummaryNotesDraft("")}
                      disabled={!summaryNotesDraft.trim()}
                      className={`${UI.btnSoft} h-8 px-4 inline-flex`}
                    >
                      Clear
                    </button>

                    <button
                      type="submit"
                      className={`${UI.btnPrimary} h-8 px-5 inline-flex`}
                    >
                      Save summary
                    </button>
                  </div>
                </div>

                <div className="text-[11px] text-[var(--color-muted)]">
                  Tip: Use this for the clean narrative version of the job. Keep
                  raw running updates in regular Notes.
                </div>
              </form>
            </ModalShell>

            {/* Add Payout Modal */}
            <ModalShell
              open={payoutModalOpen}
              title="Add payout"
              onClose={() => setPayoutModalOpen(false)}
            >
              <form
                className="space-y-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await handleAddPayoutSubmit();
                }}
              >
                {/* Job address card */}
                <div className="rounded-xl border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-background-rgb)/0.14)] px-3 py-2.5">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/8">
                      <MapPin className="h-4 w-4 text-[var(--color-primary)]" />
                    </span>

                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.50)]">
                        Job address
                      </div>
                      <div className="mt-1 text-sm font-semibold leading-5 text-[rgb(var(--color-text-rgb)/0.94)]">
                        {job.address?.fullLine || "Address not available"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Payout type selector */}
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[var(--color-text)]">
                        Payout type
                      </div>
                      <div className="text-xs text-[var(--color-muted)]">
                        Choose the labor category for this payout.
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {(["shingles", "felt"] as PayoutTab[]).map((t) => {
                      const active = payoutTab === t;
                      const label = t === "felt" ? "Dry In" : "Shingles";
                      const Icon = t === "felt" ? Layers3 : Hammer;

                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setPayoutTab(t)}
                          className={[
                            "group rounded-xl border px-3 py-2.5 text-left transition",
                            active
                              ? "border-[var(--color-primary)]/45 bg-[var(--color-primary)]/12 shadow-sm"
                              : "border-[rgb(var(--color-border-rgb)/0.20)] bg-[rgb(var(--color-surface-rgb)/0.35)] hover:bg-[rgb(var(--color-surface-rgb)/0.55)]",
                          ].join(" ")}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span
                              className={[
                                "inline-flex h-8 w-8 items-center justify-center rounded-lg border transition",
                                active
                                  ? "border-[var(--color-primary)]/30 bg-[var(--color-primary)]/15"
                                  : "border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-background-rgb)/0.18)]",
                              ].join(" ")}
                            >
                              <Icon
                                className={[
                                  "h-5 w-5",
                                  active
                                    ? "text-[var(--color-primary)]"
                                    : "text-[rgb(var(--color-text-rgb)/0.55)]",
                                ].join(" ")}
                              />
                            </span>

                            {active && (
                              <span className="rounded-full border border-[var(--color-primary)]/25 bg-[var(--color-primary)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-primary)]">
                                Selected
                              </span>
                            )}
                          </div>

                          <div className="mt-2 text-sm font-semibold text-[var(--color-text)]">
                            {label}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Details card */}
                <div className="rounded-xl border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-surface-rgb)/0.22)] p-3">
                  <div className="mb-3 flex items-start gap-2">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[rgb(var(--color-border-rgb)/0.18)] bg-[rgb(var(--color-background-rgb)/0.22)]">
                      <UserRound className="h-4 w-4 text-[rgb(var(--color-text-rgb)/0.65)]" />
                    </span>

                    <div>
                      <div className="text-sm font-semibold text-[var(--color-text)]">
                        Payout details
                      </div>
                      <div className="text-xs text-[var(--color-muted)]">
                        Select the employee and enter the square count with the
                        agreed rate.
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.55)]">
                        Employee
                      </label>

                      <select
                        ref={payeeRef as any}
                        value={activePayout.employeeId ?? ""}
                        onChange={(e) => {
                          const id = e.target.value || undefined;
                          const emp = employees.find((x) => x.id === id);
                          setActivePayout({
                            employeeId: id,
                            payeeNickname: emp?.name ?? "",
                          });
                        }}
                        className={UI.select}
                      >
                        <option value="">
                          {activeEmployees.length
                            ? "Select active employee..."
                            : employees.length
                            ? "No active employees. Toggle status on Employees page."
                            : "No employees yet. Add one on Employees page."}
                        </option>
                        {activeEmployees.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.55)]">
                          Squares
                        </label>
                        <input
                          value={activePayout.sqft}
                          onChange={(e) =>
                            setActivePayout({ sqft: e.target.value })
                          }
                          type="number"
                          min={0}
                          step="1"
                          placeholder="0"
                          className={UI.input}
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.55)]">
                          Rate per square
                        </label>
                        <input
                          value={activePayout.rate}
                          onChange={(e) =>
                            setActivePayout({ rate: e.target.value })
                          }
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="0.00"
                          className={UI.input}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Total summary */}
                <div className="rounded-xl border border-[var(--color-primary)]/18 bg-[var(--color-primary)]/8 px-3 py-2.5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--color-primary)]/25 bg-[var(--color-primary)]/10">
                        <Calculator className="h-4 w-4 text-[var(--color-primary)]" />
                      </span>

                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--color-text-rgb)/0.55)]">
                          Calculated payout
                        </div>
                        <div className="mt-0.5 text-xl font-semibold tracking-tight text-[var(--color-text)]">
                          ${(payoutAmountCents / 100).toFixed(2)}
                        </div>
                      </div>
                    </div>

                    <div className="text-right text-xs text-[var(--color-muted)]">
                      <div>{payoutTab === "felt" ? "Dry In" : "Shingles"}</div>
                      <div className="mt-1">
                        {activePayout.sqft || 0} sq @ ${activePayout.rate || 0}
                        /sq
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer actions */}
                <div className="flex flex-col-reverse gap-2 border-t border-[rgb(var(--color-border-rgb)/0.12)] pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() => setPayoutModalOpen(false)}
                    className={`${UI.btnSoft} h-10 px-4 inline-flex`}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={!payoutCanSubmit}
                    className={[
                      UI.btnPrimary,
                      "h-10 px-5 text-sm font-semibold",
                      !payoutCanSubmit ? "opacity-60 cursor-not-allowed" : "",
                    ].join(" ")}
                  >
                    Add payout
                  </button>
                </div>
              </form>
            </ModalShell>

            {/* Edit Payouts Modal */}
            <ModalShell
              open={editPayoutModalOpen}
              title="Edit payout"
              onClose={() => {
                setEditPayoutModalOpen(false);
                setEditingPayoutId(null);
              }}
            >
              <div className="mb-3">
                <div className="text-xs text-[var(--color-muted)]">
                  Editing payout for
                </div>
                <div className="text-sm font-semibold text-[var(--color-text)]">
                  {editingPayout?.payeeNickname ?? "—"}
                </div>
              </div>

              <form
                className="grid gap-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await saveEditedPayout();
                }}
              >
                <div>
                  <label className="mb-1 block text-xs text-[var(--color-muted)]">
                    Material labor
                  </label>
                  <select
                    value={editPayoutCategory}
                    onChange={(e) =>
                      setEditPayoutCategory(
                        e.target.value as "shingles" | "felt"
                      )
                    }
                    className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-sm text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                  >
                    <option value="shingles">Shingles</option>
                    <option value="felt">Felt</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-[var(--color-muted)]">
                    Sq
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editPayoutSqft}
                    onChange={(e) => setEditPayoutSqft(e.target.value)}
                    className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-sm text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-[var(--color-muted)]">
                    Rate per sq
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editPayoutRate}
                    onChange={(e) => setEditPayoutRate(e.target.value)}
                    className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-sm text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                  />
                </div>

                <div className="mt-3 px-3 py-2">
                  <div className="text-xs md:text-lg text-[var(--color-muted)]">
                    Updated total
                  </div>
                  <div className="text-xs md:text-lg font-semibold text-[var(--color-text)]">
                    $
                    {(
                      (Number(editPayoutSqft) || 0) *
                      (Number(editPayoutRate) || 0)
                    ).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditPayoutModalOpen(false);
                      setEditingPayoutId(null);
                    }}
                    className="cursor-pointer border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-text)] hover:bg-[var(--color-card-hover)]"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="bg-[var(--color-done)] cursor-pointer px-3 py-2 text-sm font-medium text-[var(--btn-text)] "
                  >
                    Save
                  </button>
                </div>
              </form>
            </ModalShell>

            {/* Add Materials Modal */}
            <ModalShell
              open={materialModalOpen}
              eyebrow="Add materials"
              title={job.address?.fullLine || "Job"}
              subtitle="Build your material list and save it to this job."
              bodyClassName="lg:h-[calc(100vh-11rem)]"
              onClose={() => setMaterialModalOpen(false)}
            >
              <form
                className="grid gap-4 lg:h-full lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:items-stretch"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await handleAddMaterialsSubmit();
                }}
              >
                <div className="min-w-0 min-h-0 flex flex-col">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-muted)]">
                        Material entries
                      </div>
                      <div className="mt-1 text-sm text-[var(--color-text)]">
                        Build your material list, then save it to this job.
                      </div>
                    </div>

                    {materialDrafts.length > 0 ? (
                      <button
                        type="button"
                        onClick={addLineToList}
                        disabled={
                          !materialLineCanSubmit(
                            materialDrafts[materialDrafts.length - 1]
                          )
                        }
                        className="inline-flex py-1 shrink-0 items-center gap-2 rounded-lg border border-[rgb(var(--color-blue-rgb,59_130_246)/0.24)] bg-[rgb(var(--color-blue-rgb,59_130_246)/0.10)] px-4 text-sm font-semibold text-[var(--color-text)] shadow-[0_8px_24px_rgba(0,0,0,0.18)] transition-all duration-200 hover:bg-[rgb(var(--color-blue-rgb,59_130_246)/0.16)] hover:shadow-[0_12px_28px_rgba(0,0,0,0.24)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-[rgb(var(--color-blue-rgb,59_130_246)/0.10)]"
                        title="Complete the current item before adding another"
                      >
                        <Plus className="h-4 w-4" />
                        Add another
                      </button>
                    ) : null}
                  </div>

                  <div className="mb-2 h-px w-full bg-[rgb(var(--color-border-rgb)/0.14)]" />
                  {materialDrafts.length > 0 &&
                  !materialLineCanSubmit(
                    materialDrafts[materialDrafts.length - 1]
                  ) ? (
                    <div className="mb-2 text-xs text-[var(--color-muted)]">
                      Finish the current item with Done or Add another after
                      entering unit price and quantity. Vendor is optional.
                    </div>
                  ) : null}

                  <div
                    ref={materialListRef}
                    className="section-scroll-ui min-h-0 flex-1 overflow-y-auto space-y-2 pr-1 pb-28"
                  >
                    {materialDrafts.length === 0 ? (
                      <div className="flex min-h-[220px] items-center justify-center rounded-xl px-6 text-center">
                        <div>
                          <div className="text-sm font-medium text-[var(--color-text)]">
                            No materials added yet
                          </div>
                          <div className="mt-1 text-xs text-[var(--color-muted)]">
                            Start your first material entry to begin building
                            this submission.
                          </div>

                          <button
                            type="button"
                            onClick={addLineToList}
                            className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg border border-[rgb(var(--color-blue-rgb,59_130_246)/0.24)] bg-[rgb(var(--color-blue-rgb,59_130_246)/0.10)] px-4 text-sm font-semibold text-[var(--color-text)] shadow-[0_8px_24px_rgba(0,0,0,0.18)] transition-all duration-200 hover:bg-[rgb(var(--color-blue-rgb,59_130_246)/0.16)] hover:shadow-[0_12px_28px_rgba(0,0,0,0.24)] active:scale-[0.98]"
                            title="Start your first material item"
                          >
                            <Plus className="h-4 w-4" />
                            Start first item
                          </button>
                        </div>
                      </div>
                    ) : (
                      materialDrafts.map((m, idx) => {
                        const lineTotal = materialLineTotal(m);
                        const selectedUnit = getMaterialOptionUnit(m.category);
                        const canSubmitLine = materialLineCanSubmit(m);
                        const isCommitted = !!m.isCommitted;
                        const isExpanded =
                          expandedMaterialIndex === idx ||
                          (expandedMaterialIndex == null &&
                            !isCommitted &&
                            idx === materialDrafts.length - 1);

                        if (!isExpanded) {
                          return (
                            <div
                              key={idx}
                              className="rounded-lg border border-[rgb(var(--color-border-rgb)/0.10)] bg-[rgb(var(--color-surface-rgb)/0.12)] px-4 py-3"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)]">
                                      Item {idx + 1}
                                    </div>
                                    <span
                                      className={
                                        isCommitted
                                          ? "rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300"
                                          : "rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300"
                                      }
                                    >
                                      {isCommitted ? "Added" : "Draft"}
                                    </span>
                                  </div>

                                  <div className="mt-1 text-sm font-semibold text-[var(--color-text)]">
                                    {getMaterialOptionName(m.category)}
                                  </div>

                                  <div className="mt-1 text-xs text-[var(--color-muted)]">
                                    {m.quantity || 0} × $
                                    {Number(m.unitPrice || 0).toFixed(2)}
                                    {selectedUnit ? ` / ${selectedUnit}` : ""}
                                    {m.vendor?.trim()
                                      ? ` • ${m.vendor.trim()}`
                                      : ""}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <div className="text-right">
                                    <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-muted)]">
                                      Total
                                    </div>
                                    <div className="mt-0.5 text-sm font-semibold text-[var(--color-text)]">
                                      ${lineTotal.toFixed(2)}
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => beginEditingLine(idx)}
                                    className="inline-flex h-8 items-center rounded-md border border-[rgb(var(--color-border-rgb)/0.12)] bg-transparent px-3 text-[11px] font-medium text-[var(--color-text)] transition hover:bg-[var(--color-card-hover)]"
                                    title={
                                      isCommitted ? "Edit item" : "Resume item"
                                    }
                                  >
                                    {isCommitted ? "Edit" : "Resume"}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => removeLineFromList(idx)}
                                    className="inline-flex h-8 items-center rounded-md border border-[rgb(var(--color-border-rgb)/0.12)] bg-transparent px-3 text-[11px] font-medium text-[var(--color-muted)] transition hover:bg-[var(--color-card-hover)] hover:text-[var(--color-text)]"
                                    title="Remove item"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={idx}
                            className="rounded-lg border border-[rgb(var(--color-blue-rgb,59_130_246)/0.28)] bg-[rgb(var(--color-surface-rgb)/0.22)] px-4 py-3 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]"
                          >
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)]">
                                    Item {idx + 1}
                                  </div>
                                  <span className="rounded-full border border-[rgb(var(--color-blue-rgb,59_130_246)/0.24)] bg-[rgb(var(--color-blue-rgb,59_130_246)/0.10)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text)]">
                                    {canSubmitLine
                                      ? "Ready to finish"
                                      : "Currently editing"}
                                  </span>
                                </div>

                                <div className="mt-0.5 text-sm font-semibold text-[var(--color-text)]">
                                  {getMaterialOptionName(m.category)}
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <div className="text-right">
                                  <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-muted)]">
                                    Total
                                  </div>
                                  <div className="mt-0.5 text-sm font-semibold text-[var(--color-text)]">
                                    ${lineTotal.toFixed(2)}
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => finishEditingLine(idx)}
                                  disabled={!canSubmitLine}
                                  className="inline-flex h-8 items-center rounded-md border border-[rgb(var(--color-blue-rgb,59_130_246)/0.24)] bg-[rgb(var(--color-blue-rgb,59_130_246)/0.10)] px-3 text-[11px] font-medium text-[var(--color-text)] transition hover:bg-[var(--color-card-hover)] disabled:cursor-not-allowed disabled:opacity-45"
                                  title="Finish this item"
                                >
                                  Done
                                </button>

                                <button
                                  type="button"
                                  onClick={() => removeLineFromList(idx)}
                                  className="inline-flex h-7 items-center rounded-md border border-[rgb(var(--color-border-rgb)/0.12)] bg-transparent px-2.5 text-[11px] font-medium text-[var(--color-muted)] transition hover:bg-[var(--color-card-hover)] hover:text-[var(--color-text)]"
                                  title="Remove item"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>

                            <div className="grid gap-2 lg:grid-cols-12">
                              <div className="lg:col-span-12">
                                <label className="mb-1 block text-[11px] text-[var(--color-muted)]">
                                  Material
                                </label>

                                <div className="relative">
                                  <select
                                    value={m.category}
                                    onChange={(e) =>
                                      updateLine(
                                        idx,
                                        "category",
                                        e.target.value as
                                          | MaterialCategory
                                          | string
                                      )
                                    }
                                    className={UI.select}
                                  >
                                    {materialOptions.map((option) => {
                                      const unitLabel = formatMaterialUnit(
                                        option.unit
                                      );
                                      return (
                                        <option
                                          key={option.key}
                                          value={option.key}
                                        >
                                          {option.name}
                                          {unitLabel ? ` (${unitLabel})` : ""}
                                        </option>
                                      );
                                    })}
                                  </select>

                                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" />
                                </div>
                              </div>

                              <div className="lg:col-span-4">
                                <label className="mb-1 block text-[11px] text-[var(--color-muted)]">
                                  Unit price{" "}
                                  {selectedUnit
                                    ? `($ per ${selectedUnit})`
                                    : "($)"}
                                </label>
                                <input
                                  value={m.unitPrice}
                                  onChange={(e) =>
                                    updateLine(idx, "unitPrice", e.target.value)
                                  }
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  placeholder="0.00"
                                  className={UI.input}
                                />
                              </div>

                              <div className="lg:col-span-3">
                                <label className="mb-1 block text-[11px] text-[var(--color-muted)]">
                                  Quantity
                                </label>
                                <input
                                  value={m.quantity}
                                  onChange={(e) =>
                                    updateLine(idx, "quantity", e.target.value)
                                  }
                                  type="number"
                                  min={0}
                                  step="1"
                                  placeholder="1"
                                  className={UI.input}
                                />
                              </div>

                              <div className="lg:col-span-5">
                                <label className="mb-1 block text-[11px] text-[var(--color-muted)]">
                                  Vendor
                                </label>
                                <input
                                  value={m.vendor || ""}
                                  onChange={(e) =>
                                    updateLine(idx, "vendor", e.target.value)
                                  }
                                  placeholder="Optional"
                                  className={UI.input}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="mt-3 border-t border-[rgb(var(--color-border-rgb)/0.14)] pt-4 lg:sticky lg:bottom-0 lg:z-20 lg:mt-4 lg:-mx-1 lg:px-1 lg:pb-5">
                    <div className="rounded-2xl  py-2 px-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)]">
                            Submission total
                          </div>

                          <div className="mt-1 text-2xl font-semibold text-[var(--color-text)]">
                            ${materialsGrandTotal.toFixed(2)}
                          </div>
                        </div>

                        <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
                          <button
                            type="button"
                            onClick={clearLines}
                            disabled={materialDrafts.length === 0}
                            className="inline-flex h-10 items-center rounded-lg px-2 text-sm font-medium text-[var(--color-muted)] transition-all duration-200 hover:text-red-300 hover:translate-y-[-1px] disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Clear
                          </button>

                          <button
                            type="button"
                            onClick={() => setMaterialModalOpen(false)}
                            className="inline-flex h-10 items-center rounded-xl   px-4 text-sm font-semibold text-[var(--color-text)]/70 hover:text-[var(--color-text)]  transition-all duration-200 hover:border-[rgb(var(--color-border-rgb)/0.30)]   active:scale-[0.985]"
                          >
                            Cancel
                          </button>

                          <button
                            type="submit"
                            disabled={!anyMaterialValid}
                            className="inline-flex h-10 items-center rounded-xl border border-[rgb(var(--color-border-rgb)/0.18)] hover:border-[rgb(var(--color-border-rgb)/0.4)]  bg-[var(--btn-bg)] px-5 text-sm font-semibold text-[var(--btn-text)]  transition-all duration-200 hover:bg-[var(--btn-hover-bg)]   active:scale-[0.985] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                          >
                            Save materials
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="hidden lg:flex min-h-0 h-full flex-col rounded-tr-xl rounded-tl-xl border border-[rgb(var(--color-border-rgb)/0.14)] bg-[rgb(var(--color-surface-rgb)/0.18)] overflow-hidden">
                  <div className="flex items-center justify-between border-b border-[rgb(var(--color-border-rgb)/0.14)] px-4 py-3">
                    <div className="min-w-0">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-muted)]"></div>
                      <div className="mt-1 text-sm text-[var(--color-text)]">
                        Materials being added
                      </div>
                    </div>

                    <div className="text-xs text-[var(--color-muted)]">
                      {materialDraftPreviewItems.length} item
                      {materialDraftPreviewItems.length === 1 ? "" : "s"}
                    </div>
                  </div>

                  <div className="section-scroll-ui min-h-0 flex-1 overflow-y-auto p-3">
                    {materialDraftPreviewItems.length === 0 ? (
                      <div className="flex min-h-[220px] items-center justify-center text-center">
                        <div>
                          <div className="text-sm font-medium text-[var(--color-text)]">
                            Nothing to preview yet
                          </div>
                          <div className="mt-1 text-xs text-[var(--color-muted)]">
                            Finished items will appear here after you click Done
                            or Add another.
                          </div>
                        </div>
                      </div>
                    ) : (
                      <ul className="space-y-1.5">
                        {materialDraftPreviewItems.map((m) => {
                          const originalIndex = materialDrafts.findIndex(
                            (draft) =>
                              materialLineCanSubmit(draft) &&
                              draft.category === m.category &&
                              (Number(draft.unitPrice) || 0) ===
                                m.unitPriceCents / 100 &&
                              Math.floor(Number(draft.quantity) || 0) ===
                                m.quantity &&
                              (draft.vendor || "").trim() ===
                                (m.vendor || "").trim()
                          );

                          return (
                            <motion.li
                              key={m.id}
                              className="flex items-center justify-between rounded-md px-3 py-2.5 hover:bg-[var(--color-card)] transition duration-300 ease-in-out"
                              variants={item}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-[var(--color-text)]">
                                    {getMaterialDisplayName(m)}
                                  </span>

                                  {m.vendor && (
                                    <span className="ml-2 text-xs text-[var(--color-muted)]">
                                      • {m.vendor}
                                    </span>
                                  )}
                                </div>

                                <div className="text-xs text-[var(--color-muted)]">
                                  {m.quantity} × $
                                  {(m.unitPriceCents / 100).toFixed(2)}
                                  {getMaterialDisplayUnit(m)
                                    ? ` / ${getMaterialDisplayUnit(m)}`
                                    : ""}
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                <CountMoney
                                  cents={m.amountCents}
                                  className="text-sm text-[var(--color-text)]"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (originalIndex >= 0) {
                                      removeLineFromList(originalIndex);
                                    }
                                  }}
                                  className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/35 px-2 py-1 text-xs text-[var(--color-muted)] hover:bg-[var(--color-card-hover)]"
                                  title="Remove"
                                >
                                  Delete
                                </button>
                              </div>
                            </motion.li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              </form>
            </ModalShell>
            {/* Add Notes Modal */}
            <ModalShell
              open={noteModalOpen}
              title="Add note"
              onClose={() => setNoteModalOpen(false)}
            >
              <form
                className="grid gap-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await handleAddNoteSubmit();
                }}
              >
                {/* Label + helper */}
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[var(--color-text)]">
                      Note
                    </div>
                  </div>

                  <div className="text-[11px] text-[var(--color-muted)] tabular-nums">
                    {noteText?.length ?? 0}/600
                  </div>
                </div>

                {/* Textarea "writing surface" */}
                <textarea
                  ref={noteRef}
                  value={noteText}
                  onChange={(e) => {
                    // simple max length guard (optional)
                    const next = e.target.value;
                    setNoteText(next.length > 600 ? next.slice(0, 600) : next);
                  }}
                  placeholder="Type your note…"
                  rows={7}
                  className={`${
                    (UI as any).textarea ?? UI.input
                  } min-h-[180px]`}
                />

                {/* Footer actions (mobile-friendly) */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setNoteText("");
                      setNoteModalOpen(false);
                    }}
                    className={`${UI.btnSoft} h-8 px-4 inline-flex`}
                  >
                    Cancel
                  </button>

                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      type="button"
                      onClick={() => setNoteText("")}
                      className={`${UI.btnSoft} h-8 px-4 inline-flex`}
                      disabled={!noteText.trim()}
                      title="Clear note"
                    >
                      Clear
                    </button>

                    <button
                      type="submit"
                      className={`${UI.btnPrimary} h-8 px-5 inline-flex`}
                      disabled={!noteText.trim()}
                    >
                      Add note
                    </button>
                  </div>
                </div>
              </form>
            </ModalShell>
            {/* Add Photos Modal */}
            <ModalShell
              open={photoModalOpen}
              title="Upload photo"
              onClose={() => {
                setPhotoModalOpen(false);
                setPhotoFile(null);
                setPhotoCaption("");
              }}
            >
              <form
                className="grid gap-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await handleUploadPhotoSubmit();
                }}
              >
                {/* CAMERA ONLY input */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setPhotoFile(file);
                  }}
                  className="sr-only"
                />

                {/* GALLERY ONLY input */}
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    setPhotoFile(file);
                  }}
                  className="sr-only"
                />

                {/* Picker / Dropzone card */}
                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/35 shadow-sm">
                  <div className="flex flex-col gap-3 p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[var(--color-text)]">
                          Photo
                        </div>
                        <div className="text-xs text-[var(--color-muted)]">
                          Take a picture on-site or choose one from your
                          gallery.
                        </div>
                      </div>

                      {photoFile && (
                        <button
                          type="button"
                          onClick={() => {
                            setPhotoFile(null);
                            setPhotoCaption("");
                          }}
                          className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/35 px-3 py-1.5 text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-card-hover)]"
                          title="Remove selected photo"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    {/* Empty vs Selected state */}
                    {!previewUrl ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => cameraInputRef.current?.click()}
                          className="group relative flex min-h-[110px] items-center justify-center rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)]/35 p-4 text-left transition hover:bg-[var(--color-card-hover)]"
                        >
                          <div className="flex items-center gap-3">
                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-black/5">
                              <Camera className="h-5 w-5 text-[var(--color-primary)]" />
                            </span>
                            <div>
                              <div className="text-sm font-semibold text-[var(--color-text)]">
                                Use camera
                              </div>
                              <div className="text-xs text-[var(--color-muted)]">
                                Best for job-site photos
                              </div>
                            </div>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => galleryInputRef.current?.click()}
                          className="group relative flex min-h-[110px] items-center justify-center rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)]/35 p-4 text-left transition hover:bg-[var(--color-card-hover)]"
                        >
                          <div className="flex items-center gap-3">
                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-black/5">
                              <ImageIcon className="h-5 w-5 text-[var(--color-primary)]" />
                            </span>
                            <div>
                              <div className="text-sm font-semibold text-[var(--color-text)]">
                                Choose from gallery
                              </div>
                              <div className="text-xs text-[var(--color-muted)]">
                                Select an existing photo
                              </div>
                            </div>
                          </div>
                        </button>
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-[150px_minmax(0,1fr)] sm:items-start">
                        <img
                          src={previewUrl}
                          alt="Selected preview"
                          className="h-36 w-full rounded-xl object-cover ring-1 ring-white/10 sm:h-28"
                        />

                        <div className="min-w-0">
                          <div className="text-xs font-medium text-[var(--color-muted)]">
                            Selected
                          </div>

                          <div className="mt-1 flex items-center justify-between gap-2">
                            <div className="min-w-0 text-sm font-semibold text-[var(--color-text)] truncate">
                              {photoFile?.name ?? "Photo selected"}
                            </div>
                            <button
                              type="button"
                              onClick={() => galleryInputRef.current?.click()}
                              className="shrink-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/35 px-3 py-1.5 text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-card-hover)]"
                              title="Pick a different file"
                            >
                              Change
                            </button>
                          </div>

                          <div className="mt-1 text-xs text-[var(--color-muted)]">
                            Add a caption below if needed (optional).
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Caption */}
                <div className="space-y-2">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[var(--color-text)]">
                        Caption
                      </div>
                      <div className="text-xs text-[var(--color-muted)]">
                        Optional — helps identify what the photo shows.
                      </div>
                    </div>
                    <div className="text-[11px] text-[var(--color-muted)] tabular-nums">
                      {photoCaption?.length ?? 0}/200
                    </div>
                  </div>

                  <textarea
                    value={photoCaption}
                    onChange={(e) => {
                      const next = e.target.value;
                      setPhotoCaption(
                        next.length > 200 ? next.slice(0, 200) : next
                      );
                    }}
                    placeholder="e.g., ‘Rear valley before install’, ‘Warranty shingle batch label’, ‘Deck damage’…"
                    rows={4}
                    className={`${UI.input} min-h-[110px] resize-none py-3 leading-6`}
                  />
                </div>

                {/* Footer actions */}
                <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoModalOpen(false);
                      setPhotoFile(null);
                      setPhotoCaption("");
                    }}
                    className={`${UI.btnSoft} h-8 px-4 inline-flex`}
                  >
                    Cancel
                  </button>

                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoFile(null);
                        setPhotoCaption("");
                      }}
                      disabled={!photoFile && !photoCaption}
                      className={`${UI.btnSoft} h-8 px-4 inline-flex`}
                      title="Reset form"
                    >
                      Clear
                    </button>

                    <button
                      type="submit"
                      disabled={uploading || !photoFile}
                      className={`${UI.btnPrimary} h-8 px-5 inline-flex`}
                    >
                      {uploading ? "Uploading…" : "Upload photo"}
                    </button>
                  </div>
                </div>

                {/* Micro helper */}
                <div className="text-[11px] text-[var(--color-muted)]">
                  Tip: photos get attached to this job and can be used in
                  warranty packets later.
                </div>
              </form>
            </ModalShell>

            {/* ===== Schedule Felt Modal ===== */}
            {feltScheduleEditing && (
              <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
                <div className="w-full max-w-sm bg-[var(--color-card)] p-4 md:py-6 lg:py-10 md:px-8">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-[var(--color-text)]">
                      Schedule DRY IN
                    </h2>
                    <button
                      type="button"
                      onClick={() => setFeltScheduleEditing(false)}
                      className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
                      aria-label="Close"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <label className="mb-2 block text-xs text-[var(--color-muted)]">
                    DRY IN date
                  </label>
                  <input
                    type="date"
                    value={feltScheduleDate}
                    onChange={(e) => setFeltScheduleDate(e.target.value)}
                    className="w-full rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)]/35 px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                  />

                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setFeltScheduleEditing(false)}
                      className="  px-3 py-1.5 text-xs text-[var(--color-text)] hover:bg-[var(--color-card-hover)]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveFeltSchedule()}
                      className=" border border-[var(--color-border)] bg-[var(--color-surface)]/35 px-3 py-1.5 text-xs text-[var(--color-text)] hover:bg-[var(--color-card-hover)]"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ===== Schedule Shingles Modal ===== */}
            {shinglesScheduleEditing && (
              <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
                <div className="w-full max-w-sm bg-[var(--color-card)] p-4 md:py-6 lg:py-10 md:px-8">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-[var(--color-text)]">
                      Schedule shingles
                    </h2>
                    <button
                      type="button"
                      onClick={() => setShinglesScheduleEditing(false)}
                      className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
                      aria-label="Close"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <label className="mb-2 block text-xs text-[var(--color-muted)]">
                    Shingles date
                  </label>
                  <input
                    type="date"
                    value={shinglesScheduleDate}
                    onChange={(e) => setShinglesScheduleDate(e.target.value)}
                    className="w-full rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)]/35 px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                  />

                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShinglesScheduleEditing(false)}
                      className="px-3 py-1.5 text-xs text-[var(--color-text)] hover:bg-[var(--color-card-hover)]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveShinglesSchedule()}
                      className="border border-[var(--color-border)] bg-[var(--color-surface)]/35 px-3 py-1.5 text-xs text-[var(--color-text)] hover:bg-[var(--color-card-hover)]"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ===== Schedule Punch Modal ===== */}
            {schedulePunchOpen && (
              <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
                <div className="w-full max-w-sm bg-[var(--color-card)] p-4 md:py-6 lg:py-10 md:px-8">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-[var(--color-text)]">
                      Schedule PUNCH
                    </h2>
                    <button
                      type="button"
                      onClick={() => setSchedulePunchOpen(false)}
                      className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
                      aria-label="Close"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <label className="mb-2 block text-xs text-[var(--color-muted)]">
                    Punch date
                  </label>
                  <input
                    type="date"
                    value={schedulePunchDate}
                    onChange={(e) => setSchedulePunchDate(e.target.value)}
                    className="w-full rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)]/35 px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                  />

                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setSchedulePunchOpen(false)}
                      className="px-3 py-1.5 text-xs text-[var(--color-text)] hover:bg-[var(--color-card-hover)]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!job || !schedulePunchDate) return;

                        const [year, month, day] = schedulePunchDate
                          .split("-")
                          .map((x) => Number(x));
                        const scheduledDate = new Date(year, month - 1, day);

                        const wasScheduledBefore = !!job.punchScheduledFor;

                        await saveJob({
                          ...job,
                          punchScheduledFor: Timestamp.fromDate(scheduledDate),
                        });

                        setSchedulePunchOpen(false);

                        const label = fmtLongDate(scheduledDate);
                        setToast({
                          status: "success",
                          title: wasScheduledBefore
                            ? "Punch rescheduled"
                            : "Punch scheduled",
                          message: `Punch is now set for ${label}.`,
                        });
                      }}
                      className="border border-[var(--color-border)] bg-[var(--color-surface)]/35 px-3 py-1.5 text-xs text-[var(--color-text)] hover:bg-[var(--color-card-hover)]"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            )}
            {/* ===== Confirm Mark as Punched Modal ===== */}
            {confirmPunchedOpen && (
              <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-xs p-4">
                <div className="w-full max-w-sm bg-[var(--color-card)] p-4 md:py-6 lg:py-10 md:px-8">
                  <button
                    type="button"
                    onClick={() => setConfirmPunchedOpen(false)}
                    className="rounded-full p-2 text-gray-500 hover:bg-gray-100 absolute top-0 right-0"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>

                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm lg:text-lg font-semibold text-[var(--color-text)] p-0.5">
                      Mark <strong className="font-semibold">PUNCH</strong> as
                      completed?
                    </h2>
                  </div>

                  <p className="text-sm text-[var(--color-muted)]">
                    Are you sure this house has been fully punched and the job
                    is complete? This will mark the job as{" "}
                    <span className="font-semibold">completed</span>.
                  </p>

                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmPunchedOpen(false)}
                      className="cursor-pointer px-3 py-1.5 text-xs text-[var(--color-text)]/60 hover:bg-[var(--color-card-hover)]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={confirmMarkPunched}
                      className="px-3 py-1.5 text-xs text-[var(--color-text)]/85 hover:text-[var(--color-text)] font-bold! hover:bg-[var(--color-card-hover)] cursor-pointer"
                    >
                      Complete
                    </button>
                  </div>
                </div>
              </div>
            )}

            {confirmUndoPunchOpen && (
              <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-xs p-4">
                <div className="w-full max-w-sm bg-[var(--color-card)] p-4 md:py-6 lg:py-10 md:px-8">
                  <button
                    type="button"
                    onClick={() => setConfirmUndoPunchOpen(false)}
                    className="rounded-full p-2 text-gray-500 hover:bg-gray-100 absolute top-0 right-0"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>

                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm lg:text-lg font-semibold text-[var(--color-text)] p-0.5">
                      Undo <strong className="font-semibold">PUNCH</strong>{" "}
                      completion?
                    </h2>
                  </div>

                  <p className="text-sm text-[var(--color-muted)]">
                    This will reopen the job and remove the punch completion
                    timestamp. You’ll be able to reschedule punch again.
                  </p>

                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmUndoPunchOpen(false)}
                      className="cursor-pointer px-3 py-1.5 text-xs text-[var(--color-text)]/60 hover:bg-[var(--color-card-hover)]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={confirmUndoPunch}
                      className="px-3 py-1.5 text-xs text-[var(--color-text)]/85 hover:text-[var(--color-text)] font-bold! hover:bg-[var(--color-card-hover)] cursor-pointer"
                    >
                      Undo punch
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ===== Confirm Felt Completed Modal ===== */}
            {confirmFeltDoneOpen && (
              <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-xs p-4">
                <div className="w-full max-w-sm bg-[var(--color-card)] p-4 md:py-6 lg:py-10 md:px-8">
                  <button
                    type="button"
                    onClick={() => setConfirmFeltDoneOpen(false)}
                    className="rounded-full p-2 text-gray-500 hover:bg-gray-100 absolute top-0 right-0"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm lg:text-lg font-semibold text-[var(--color-text)]  p-0.5">
                      Mark <strong className="font-semibold">DRY IN</strong> as
                      completed?
                    </h2>
                  </div>

                  <p className="text-sm text-[var(--color-muted)]">
                    Are you sure the felt work for this job is fully completed?
                  </p>

                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmFeltDoneOpen(false)}
                      className=" cursor-pointer  px-3 py-1.5 text-xs text-[var(--color-text)]/60 hover:bg-[var(--color-card-hover)]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await markFeltCompleted();
                        setConfirmFeltDoneOpen(false);
                        setToast({
                          status: "success",
                          title: "DRY IN marked complete",
                          message:
                            "DRY IN has been marked as completed for this job.",
                        });
                      }}
                      className="  px-3 py-1.5 text-xs   text-[var(--color-text)]/85 hover:text-[var(--color-text)] font-bold! hover:bg-[var(--color-card-hover)]  cursor-pointer"
                    >
                      Complete
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ===== Confirm Shingles Completed Modal ===== */}
            {confirmShinglesDoneOpen && (
              <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-xs p-4">
                <div className="w-full max-w-sm bg-[var(--color-card)] p-4 md:py-6 lg:py-10 md:px-8">
                  <button
                    type="button"
                    onClick={() => setConfirmShinglesDoneOpen(false)}
                    className="rounded-full p-2 text-gray-500 hover:bg-gray-100 absolute top-0 right-0"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>

                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm lg:text-lg font-semibold text-[var(--color-text)] p-0.5">
                      Mark <strong className="font-semibold">SHINGLES</strong>{" "}
                      as completed?
                    </h2>
                  </div>

                  <p className="text-sm text-[var(--color-muted)]">
                    Are you sure the shingles work for this job is fully
                    completed?
                  </p>

                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmShinglesDoneOpen(false)}
                      className="cursor-pointer px-3 py-1.5 text-xs text-[var(--color-text)]/60 hover:bg-[var(--color-card-hover)]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await markShinglesCompleted();
                        setConfirmShinglesDoneOpen(false);
                        setToast({
                          status: "success",
                          title: "Shingles marked complete",
                          message:
                            "Shingles have been marked as completed for this job.",
                        });
                      }}
                      className="px-3 py-1.5 text-xs text-[var(--color-text)]/85 hover:text-[var(--color-text)] font-bold! hover:bg-[var(--color-card-hover)] cursor-pointer"
                    >
                      Complete
                    </button>
                  </div>
                </div>
              </div>
            )}
            <motion.div
              key={resolvedJobId}
              className="mx-auto w-full  overflow-x-hidden  py-8  md:px-10"
              {...fadeUp(0)}
            >
              {/* Quick edit / add panel */}

              {/* ===== Photo Lightbox ===== */}
              {typeof document !== "undefined" &&
                viewerOpen &&
                photos.length > 0 &&
                createPortal(
                  <div
                    className="lightbox-scroll fixed inset-0 z-[1000] bg-[var(--color-background)]/40 backdrop-blur-md"
                    aria-modal="true"
                    role="dialog"
                    onClick={(e) => {
                      if (e.target === e.currentTarget) closeViewer();
                    }}
                  >
                    <div className="min-h-screen w-full px-4 py-6 sm:px-6 sm:py-8">
                      {/* Close button */}
                      <button
                        type="button"
                        onClick={closeViewer}
                        className="absolute right-4 top-4 z-20 rounded-full bg-black/45 p-2 text-white transition hover:bg-black/65"
                        aria-label="Close viewer"
                        title="Close"
                      >
                        <X className="h-6 w-6" />
                      </button>

                      {/* Centered stage */}
                      <div
                        className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[1400px] items-center justify-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {(() => {
                          const p = photos[viewerIndex];
                          const src =
                            p.fullUrl ??
                            p.previewUrl ??
                            p.url ??
                            p.thumbUrl ??
                            "";

                          return (
                            <div className="relative w-full">
                              {/* Prev / Next controls */}
                              {photos.length > 1 && (
                                <>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      prevPhoto();
                                    }}
                                    className="group absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full
                      bg-[rgb(var(--color-card-rgb)/0.08)] backdrop-blur-md
                      border border-[rgb(var(--color-border-rgb)/0.08)]
                      p-3 shadow-[0_8px_30px_rgba(0,0,0,0.25)]
                      transition-all! duration-350
                      hover:scale-110 hover:bg-[rgb(var(--color-card-rgb)/0.75)]
                      active:scale-95
                      sm:left-2 lg:left-4"
                                    aria-label="Previous photo"
                                    title="Previous photo"
                                  >
                                    <ChevronLeft className="h-7 w-7 text-[var(--color-text)] opacity-80 transition group-hover:opacity-100" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      nextPhoto();
                                    }}
                                    className="group absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full
                      bg-[rgb(var(--color-card-rgb)/0.08)] backdrop-blur-md
                      border border-[rgb(var(--color-border-rgb)/0.08)]
                      p-3 shadow-[0_8px_30px_rgba(0,0,0,0.25)]
                      transition-all! duration-350
                      hover:scale-110 hover:bg-[rgb(var(--color-card-rgb)/0.75)]
                      active:scale-95
                      sm:right-2 lg:right-4"
                                    aria-label="Next photo"
                                    title="Next photo"
                                  >
                                    <ChevronRight className="h-7 w-7 text-[var(--color-text)] opacity-80 transition group-hover:opacity-100" />
                                  </button>
                                </>
                              )}

                              {/* Image + caption */}
                              <figure className="mx-auto flex w-full flex-col items-center px-12 sm:px-16 lg:px-20">
                                <img
                                  src={src}
                                  alt={p.caption || ""}
                                  className="max-h-[82vh] w-auto max-w-full rounded-xl object-contain shadow-2xl"
                                />

                                {p.caption && (
                                  <figcaption className="mt-3 text-center text-sm text-white/90">
                                    {p.caption}
                                  </figcaption>
                                )}

                                <div className="mt-1 text-xs text-white/60">
                                  {viewerIndex + 1} / {photos.length}
                                </div>
                              </figure>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>,
                  document.body
                )}

              {/* ===== Flashing Pay Modal ===== */}
              {flashingModalOpen && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
                  <div className="w-full max-w-sm rounded-md bg-[var(--color-surface)]/35 p-4 md:py-6 md:px-8 shadow-xl">
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-[var(--color-text)]">
                        Flashing (C/J/L) Pay
                      </h2>
                      <button
                        type="button"
                        onClick={() => setFlashingModalOpen(false)}
                        className="rounded-sm p-1 text-gray-500 hover:bg-gray-100"
                        aria-label="Close"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="text-xs text-[var(--color-muted)] mb-3">
                      Optional add-on that increases total job pay.
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-xs text-[var(--color-muted)]">
                          Units
                        </label>
                        <input
                          value={flashingUnits}
                          onChange={(e) => setFlashingUnits(e.target.value)}
                          type="number"
                          min={0}
                          step="1"
                          className={UI.input}
                          placeholder="1"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs text-[var(--color-muted)]">
                          $ / unit
                        </label>
                        <input
                          value={flashingUnitPrice}
                          onChange={(e) => setFlashingUnitPrice(e.target.value)}
                          type="number"
                          min={0}
                          step="0.01"
                          className={UI.input}
                          placeholder="10.00"
                        />
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-[var(--color-muted)]">
                      Preview: +{" "}
                      <CountMoney cents={flashingAmountCentsPreview} />
                    </div>

                    <div className="mt-4 flex justify-end gap-2">
                      {(job.earnings?.flashingPay?.amountCents ?? 0) > 0 && (
                        <button
                          type="button"
                          onClick={async () => {
                            await clearFlashingPay();
                            setFlashingModalOpen(false);
                          }}
                          className={UI.btnSoft}
                        >
                          Remove
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setFlashingModalOpen(false)}
                        className={UI.btnSoft}
                      >
                        Cancel
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          await saveFlashingPay();
                          setFlashingModalOpen(false);
                        }}
                        className={UI.btnPrimary}
                        disabled={
                          Number(flashingUnits) <= 0 ||
                          Number(flashingUnitPrice) <= 0
                        }
                      >
                        {(job.earnings?.flashingPay?.amountCents ?? 0) > 0
                          ? "Update"
                          : "Add"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ===== Danger zone ===== */}
              <motion.section
                className="mt-10 rounded-2xl p-4"
                {...fadeUp(0.27)}
              >
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    onClick={() => setConfirmDeleteOpen(true)}
                    className="rounded-md bg-red-700 px-3 py-2 text-sm text-white hover:bg-red-600"
                    title="Permanently delete this job"
                  >
                    Permanently delete job…
                  </button>
                </div>
              </motion.section>
              {/* ===== Confirm Permanently Delete Job Modal ===== */}
              {confirmDeleteOpen && job && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
                  <div className="w-full max-w-sm rounded-2xl bg-[var(--color-surface)] p-4 shadow-xl">
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-[var(--color-text)]">
                        Permanently delete this job?
                      </h2>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteOpen(false)}
                        className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
                        aria-label="Close"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <p className="text-sm text-[var(--color-muted)]">
                      This will permanently remove{" "}
                      <span className="font-semibold">
                        {job.address?.fullLine || job.id}
                      </span>{" "}
                      and all of its materials, notes, and photos.{" "}
                      <span className="font-semibold">
                        This cannot be undone.
                      </span>
                    </p>

                    <div className="mt-4 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteOpen(false)}
                        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/35 px-3 py-1.5 text-xs text-[var(--color-text)] hover:bg-[var(--color-card-hover)]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void permanentlyDeleteJob()}
                        disabled={deletingJob}
                        className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {deletingJob ? "Deleting…" : "Yes, delete job"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Warranty packet preview */}
              {/* Warranty center */}
              <WarrantyCenterModal
                open={warrantyCenterOpen}
                onClose={() => setWarrantyCenterOpen(false)}
                job={job}
                warranties={jobWarranties}
                onCreateType={(type) => {
                  setWarrantyCenterOpen(false);
                  setActiveWarrantyType(type);
                  setWarrantyEditOpen(true);
                }}
                onEditType={(type) => {
                  setWarrantyCenterOpen(false);
                  setActiveWarrantyType(type);
                  setWarrantyEditOpen(true);
                }}
                onPreviewType={(type) => {
                  setWarrantyCenterOpen(false);
                  setActiveWarrantyType(type);
                  setWarrantyReportOpen(true);
                }}
              />

              {/* Warranty editor */}
              {activeWarrantyType && (
                <WarrantyEditModal
                  open={warrantyEditOpen}
                  onClose={() => setWarrantyEditOpen(false)}
                  onOpenReport={() => setWarrantyReportOpen(true)}
                  job={job}
                  warrantyType={activeWarrantyType}
                  warranty={activeWarranty}
                  availablePhotos={photos}
                  onSave={saveWarranty}
                />
              )}
              {/* Warranty packet preview */}
              {warrantyReportOpen && activeWarrantyType && (
                <WarrantyReportModal
                  open={warrantyReportOpen}
                  onClose={() => setWarrantyReportOpen(false)}
                  job={job}
                  photos={photos}
                  selectedWarranty={activeWarranty}
                />
              )}

              {/* Internal job report */}
              {jobReportOpen && job && (
                <JobReportModal
                  open={jobReportOpen}
                  onClose={() => setJobReportOpen(false)}
                  job={job}
                  photos={photos}
                  totals={{
                    earnings: totals.earnings,
                    expenses: totals.expenses,
                    net: totals.net,
                  }}
                />
              )}

              {/* Invoice Modal */}
              {invoiceModalOpen && job && (
                <InvoiceCreateModal
                  job={job}
                  open={invoiceModalOpen}
                  onClose={() => setInvoiceModalOpen(false)}
                />
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </>
  );
}
// Stat pills
function Stat({ label, cents }: { label: string; cents: number }) {
  return (
    <motion.div className="shadow-md  p-5 lg:p-8" variants={item}>
      <div className="text-sm md:text-lg lg:text-xl text-[var(--color-text)]">
        {label}
      </div>
      <div className="text-lg lg:text-2xl font-semibold text-[var(--color-text)]">
        <CountMoney cents={cents} />
      </div>
    </motion.div>
  );
}

function MotionCard({
  title,
  children,
  delay = 0,
  right,
}: {
  title?: string;
  children: React.ReactNode;
  delay?: number;
  right?: React.ReactNode;
}) {
  return (
    <motion.section
      className="w-full max-w-full justify-self-stretch   backdrop-blur-md  transition duration-300 ease-out"
      {...fadeUp(delay)}
    >
      {(title || right) && (
        <>
          <div className="flex items-center justify-between px-4 sm:px-5 pt-4 gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-[var(--color-text)]">
              {title}
            </h2>

            {right ? <div className="shrink-0">{right}</div> : null}
          </div>

          <div className="mt-3 h-px w-full bg-black/5" />
        </>
      )}

      <div className="px-4 sm:px-5 pb-5 pt-4 flex flex-col gap-3">
        {children}
      </div>
    </motion.section>
  );
}

type ModalShellWidth = "sm" | "md" | "lg" | "xl";

const modalShellWidthClass: Record<ModalShellWidth, string> = {
  sm: "sm:max-w-md lg:max-w-md",
  md: "sm:max-w-xl lg:max-w-2xl",
  lg: "sm:max-w-lg lg:max-w-4xl",
  xl: "sm:max-w-lg lg:max-w-6xl",
};

function ModalShell({
  open,
  title,
  subtitle,
  eyebrow,
  bodyClassName,
  width = "xl",
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  eyebrow?: string;
  bodyClassName?: string;
  width?: ModalShellWidth;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[var(--color-background)]/60 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Sheet / Modal */}
      <div className="absolute inset-x-0 bottom-0 top-0 flex items-end justify-center p-0 sm:items-start sm:px-4 sm:pb-6 sm:pt-20 lg:pt-24">
        <div
          className={[
            // Mobile: bottom sheet
            "w-full sm:w-full lg:p-2",
            "bg-[var(--color-card)]",
            // Height behavior
            "max-h-[92vh] sm:max-h-[calc(100vh-6rem)] lg:max-h-[calc(100vh-7rem)]",
            // Width cap on larger screens
            modalShellWidthClass[width],
            // Prevent layout overflow
            "overflow-hidden",
          ].join(" ")}
          onClick={(e) => e.stopPropagation()} // prevent backdrop close when clicking inside
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-black/5 px-4 py-4 sm:px-6 sm:py-5">
            <div className="min-w-0">
              {eyebrow ? (
                <div className="mb-1 text-[11px] uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  {eyebrow}
                </div>
              ) : null}

              <h2 className="truncate text-lg font-semibold text-[var(--color-text)] sm:text-xl">
                {title}
              </h2>

              {subtitle ? (
                <div className="mt-1 truncate text-sm text-[rgb(var(--color-text-rgb)/0.62)]">
                  {subtitle}
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500 transition hover:bg-white/10 hover:text-[var(--color-text)] cursor-pointer"
              aria-label="Close"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body (scrollable) */}
          <div
            className={[
              "max-h-[calc(92vh-64px)] overflow-y-auto px-4 py-4 sm:max-h-[calc(100vh-10rem)] sm:px-6 sm:py-6 lg:max-h-[calc(100vh-11rem)] lg:overflow-hidden",
              bodyClassName ?? "",
            ].join(" ")}
          >
            {children}
          </div>

          {/* Mobile grab handle (nice touch) */}
          <div className="sm:hidden pb-3">
            <div className="mx-auto h-1 w-10 rounded-full bg-black/10" />
          </div>
        </div>
      </div>
    </div>
  );
}
