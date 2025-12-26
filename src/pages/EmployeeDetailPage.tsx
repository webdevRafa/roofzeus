// src/pages/EmployeeDetailPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import type { FieldValue } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import type {
  Employee,
  EmployeeAddress,
  PayoutDoc,
  PayoutStubDoc,
  PayoutStubLine,
} from "../types/types";
import { ChevronDown, ChevronLeft, Search, ReceiptText } from "lucide-react";
import { GlobalPayoutStubModal } from "../components/GlobalPayoutStubModal";
import { PayoutStubViewerModal } from "../components/PayoutStubViewerModal";
import { useOrg } from "../contexts/OrgContext";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import CountUp from "react-countup";

// ---------- Small helpers ----------
function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function money(cents: number | undefined | null): string {
  const v = typeof cents === "number" ? cents : 0;
  return (v / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

type AnyAddress = unknown;

function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim().length > 0) return v;
  }
  return "";
}

function normalizeJobAddress(a: AnyAddress) {
  if (typeof a === "string") {
    return {
      display: a,
      line1: a,
      city: "",
      state: "",
      zip: "",
    };
  }

  const obj: Record<string, unknown> = (a ?? {}) as Record<string, unknown>;
  const line1 = pickString(obj, [
    "fullLine",
    "line1",
    "street",
    "address1",
    "address",
    "formatted",
    "text",
    "label",
    "street1",
  ]);
  const city = pickString(obj, ["city", "town"]);
  const state = pickString(obj, ["state", "region", "province"]);
  const zip = pickString(obj, ["zip", "postalCode", "postcode", "zipCode"]);
  const display =
    pickString(obj, ["fullLine", "full", "formatted", "label", "text"]) ||
    line1;

  return { display, line1, city, state, zip };
}

type FsTimestampLike = { toDate: () => Date };
function isFsTimestamp(x: unknown): x is FsTimestampLike {
  return typeof (x as FsTimestampLike)?.toDate === "function";
}
function fmtDate(x: unknown): string {
  if (x == null) return "—";
  if (isFsTimestamp(x)) return x.toDate().toLocaleString();
  if (x instanceof Date) return x.toLocaleString();
  if (typeof x === "string" || typeof x === "number") {
    const d = new Date(x);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
  }
  return "—";
}

type PayoutFilter = "all" | "pending" | "paid";

const ease = [0.16, 1, 0.3, 1] as const;

const pageVariants: Variants = {
  hidden: { opacity: 0, y: 10, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.5, ease },
  },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease } },
};

function StatMoney({
  label,
  cents,
  hint,
}: {
  label: string;
  cents: number;
  hint?: string;
}) {
  const dollars = cents / 100;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-wide text-white/55">
          {label}
        </p>
      </div>

      <div className="mt-2 text-xl font-semibold text-white">
        <CountUp
          key={`${label}-${cents}`}
          end={dollars}
          prefix="$"
          decimals={2}
          separator=","
          duration={0.8}
        />
      </div>

      {hint ? <p className="mt-1 text-xs text-white/45">{hint}</p> : null}
    </div>
  );
}

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [address, setAddress] = useState<EmployeeAddress>({
    fullLine: "",
    line1: "",
    city: "",
    state: "",
    zip: "",
  });
  const [isActive, setIsActive] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [payoutsOpen, setPayoutsOpen] = useState(true);

  // ---- Payouts state ----
  const [payouts, setPayouts] = useState<PayoutDoc[]>([]);
  const [payoutsLoading, setPayoutsLoading] = useState(true);
  const [payoutsError, setPayoutsError] = useState<string | null>(null);
  const [payoutFilter, setPayoutFilter] = useState<PayoutFilter>("pending");
  const [searchTerm, setSearchTerm] = useState("");

  // For "Create stub" flow
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [stubOpen, setStubOpen] = useState(false);
  const [stubSaving, setStubSaving] = useState(false);

  const [stubs, setStubs] = useState<PayoutStubDoc[]>([]);
  const [stubsLoading, setStubsLoading] = useState(true);
  const [stubsError, setStubsError] = useState<string | null>(null);
  const [stubSearch, setStubSearch] = useState("");
  const [viewStubId, setViewStubId] = useState<string | null>(null);

  const { orgId, loading: orgLoading } = useOrg();

  // ---------- Load employee ----------
  useEffect(() => {
    if (!id) return;
    if (orgLoading) return; // wait for org context to resolve

    (async () => {
      try {
        if (!orgId) throw new Error("No organization selected.");

        const ref = doc(collection(db, "employees"), id);
        const snap = await getDoc(ref);

        if (!snap.exists()) throw new Error("Employee not found");

        // IMPORTANT: include the document id on the object
        const data = {
          id: snap.id,
          ...(snap.data() as Omit<Employee, "id">),
        } as Employee;

        // ✅ Step B: guard against cross-org access
        const employeeOrgId = (snap.data() as any).orgId as string | undefined;
        if (employeeOrgId && employeeOrgId !== orgId) {
          throw new Error(
            "This employee does not belong to the active organization."
          );
        }

        setEmployee(data);
        setName(data.name);
        setIsActive(data.isActive !== false); // default to active when missing

        const addr = normalizeEmployeeAddress(data.address);
        setAddress({
          fullLine: addr?.fullLine ?? "",
          line1: addr?.line1 ?? "",
          city: addr?.city ?? "",
          state: addr?.state ?? "",
          zip: addr?.zip ?? "",
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [id, orgId, orgLoading]);

  // ---------- Live payouts for this employee (ORG SCOPED) ----------
  useEffect(() => {
    if (!id) return;
    if (orgLoading) return;

    if (!orgId) {
      setPayouts([]);
      setPayoutsLoading(false);
      setPayoutsError("No organization selected.");
      return;
    }

    const ref = collection(db, "payouts");
    const q = query(
      ref,
      where("orgId", "==", orgId),
      where("employeeId", "==", id),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: PayoutDoc[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<PayoutDoc, "id">),
        }));

        setPayouts(list);
        setPayoutsLoading(false);
        setPayoutsError(null);
      },
      (err) => {
        console.error(err);
        setPayoutsError(err.message || String(err));
        setPayoutsLoading(false);
        setPayoutsLoading(false);
      }
    );

    return () => unsub();
  }, [id, orgId, orgLoading]);

  // Clear selection when leaving "pending" tab
  useEffect(() => {
    if (payoutFilter !== "pending") {
      setSelectedIds([]);
    }
  }, [payoutFilter]);

  async function save() {
    if (!employee) return;
    setSaving(true);
    setError(null);

    try {
      const ref = doc(collection(db, "employees"), employee.id);
      const next: Employee = {
        ...employee,
        name: name.trim(),
        address,
        isActive,
        updatedAt: serverTimestamp() as FieldValue,
      };

      await setDoc(ref, next, { merge: true });

      navigate("/employees", {
        replace: true,
        state: { message: "Employee details saved successfully." },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  // subscribe to payoutStubs for this employee (ORG SCOPED)
  useEffect(() => {
    if (!id) return;
    if (orgLoading) return;

    if (!orgId) {
      setStubs([]);
      setStubsLoading(false);
      setStubsError("No organization selected.");
      return;
    }

    const ref = collection(db, "payoutStubs");
    const q = query(
      ref,
      where("orgId", "==", orgId),
      where("employeeId", "==", id),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: PayoutStubDoc[] = snap.docs.map((d) => ({
          ...(d.data() as PayoutStubDoc),
          id: d.id,
        }));

        setStubs(list);
        setStubsLoading(false);
        setStubsError(null);
      },
      (err) => {
        console.error(err);
        setStubsError(err.message || String(err));
        setStubsLoading(false);
      }
    );

    return () => unsub();
  }, [id, orgId, orgLoading]);

  // ---- Filtered payouts (by tab + search) ----
  const filteredPayouts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return payouts.filter((p) => {
      if (payoutFilter === "pending" && p.paidAt) return false;
      if (payoutFilter === "paid" && !p.paidAt) return false;

      if (term.length > 0) {
        const a = normalizeJobAddress(p.jobAddressSnapshot);
        const haystack = [a.display, a.line1, a.city, a.state, a.zip]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(term)) return false;
      }

      return true;
    });
  }, [payouts, payoutFilter, searchTerm]);

  // filtered list for stub seaarch (address + stub number)
  const filteredStubs = useMemo(() => {
    const term = stubSearch.trim().toLowerCase();
    if (!term) return stubs;

    return stubs.filter((s) => {
      const number = s.number?.toLowerCase() ?? "";
      const employeeName = s.employeeNameSnapshot?.toLowerCase() ?? "";
      const addrHaystack = (s.lines ?? [])
        .map((l) => {
          const a = l.jobAddressSnapshot;
          return [a?.fullLine, a?.line1, a?.city, a?.state, a?.zip]
            .filter(Boolean)
            .join(" ");
        })
        .join(" ")
        .toLowerCase();

      return (
        number.includes(term) ||
        employeeName.includes(term) ||
        addrHaystack.includes(term)
      );
    });
  }, [stubs, stubSearch]);

  const stubToView = useMemo(() => {
    if (!viewStubId) return null;
    return stubs.find((s) => s.id === viewStubId) ?? null;
  }, [stubs, viewStubId]);

  const selectedPayouts = useMemo(
    () => payouts.filter((p) => selectedIds.includes(p.id)),
    [payouts, selectedIds]
  );

  const stats = useMemo(() => {
    const pending = payouts.filter((p) => !p.paidAt);
    const paid = payouts.filter((p) => !!p.paidAt);

    const pendingTotal = pending.reduce(
      (sum, p) => sum + (typeof p.amountCents === "number" ? p.amountCents : 0),
      0
    );
    const paidTotal = paid.reduce(
      (sum, p) => sum + (typeof p.amountCents === "number" ? p.amountCents : 0),
      0
    );

    const latestPaidAt = paid.map((p) => p.paidAt).filter(Boolean)[0];

    return {
      pendingCount: pending.length,
      paidCount: paid.length,
      pendingTotal,
      paidTotal,
      latestPaidAt,
      stubCount: stubs.length,
    };
  }, [payouts, stubs.length]);

  async function markSelectedAsPaid() {
    if (!employee) return;

    const payoutsToMark = selectedPayouts.filter((p) => !p.paidAt);
    if (payoutsToMark.length === 0) {
      setStubOpen(false);
      return;
    }

    setStubSaving(true);

    try {
      // 1) Create stub doc
      const stubRef = doc(collection(db, "payoutStubs"));
      const now = new Date();

      // Simple, stable stub number (no extra counters needed)
      const y = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      const shortId = stubRef.id.slice(0, 6).toUpperCase();
      const number = `STUB-${y}${mm}${dd}-${shortId}`;

      // Build lines WITHOUT undefined fields (Firestore rejects undefined anywhere)
      const lines: PayoutStubLine[] = payoutsToMark.map((p) => ({
        payoutId: p.id,
        category: p.category,
        sqft: p.sqft,
        ratePerSqFt: p.ratePerSqFt,
        amountCents: typeof p.amountCents === "number" ? p.amountCents : 0,
        ...(p.jobId ? { jobId: p.jobId } : {}),
        ...(p.jobAddressSnapshot
          ? { jobAddressSnapshot: p.jobAddressSnapshot }
          : {}),
      }));

      const totalCents = lines.reduce(
        (sum, l) => sum + (l.amountCents || 0),
        0
      );

      const jobIds = Array.from(
        new Set(lines.map((l) => l.jobId).filter(Boolean) as string[])
      );

      // Normalize employee address, but store null (or omit) — never undefined
      const employeeAddr = normalizeEmployeeAddress(employee.address);

      // IMPORTANT: if orgId can ever be missing, fail fast (don’t write invalid stub)
      if (!orgId) throw new Error("Missing orgId (cannot create payout stub).");

      const stubDoc: PayoutStubDoc = {
        id: stubRef.id,
        number,
        employeeId: employee.id,
        orgId,
        employeeNameSnapshot: employee.name,
        ...(employeeAddr ? { employeeAddressSnapshot: employeeAddr } : {}),
        payoutIds: lines.map((l) => l.payoutId),
        jobIds,
        lines,
        totalCents,
        createdAt: serverTimestamp() as unknown as FieldValue,
        paidAt: serverTimestamp() as unknown as FieldValue,
        status: "paid",
      };

      await setDoc(stubRef, stubDoc);
      setViewStubId(stubRef.id);

      // 2) Mark payouts paid + backref stub id
      await Promise.all(
        payoutsToMark.map((p) =>
          setDoc(
            doc(collection(db, "payouts"), p.id),
            {
              paidAt: serverTimestamp(),
              payoutStubId: stubRef.id,
            },
            { merge: true }
          )
        )
      );

      // 3) UI cleanup
      setSelectedIds([]);
      setStubOpen(false);
    } catch (err) {
      console.error(err);
      alert("Failed to mark payouts as paid + create stub. See console.");
    } finally {
      setStubSaving(false);
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  if (error) {
    return (
      <div className="min-h-[70vh] bg-[#070A10]">
        <div className="mx-auto w-[min(1100px,94vw)] py-10">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm text-red-200">
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="min-h-[70vh] bg-[#070A10]">
        <div className="mx-auto w-[min(1100px,94vw)] py-10">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm text-white/70">
            Not found.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-72px)] bg-[#070A10]">
      {/* ambient gradient */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(900px_500px_at_20%_15%,rgba(252,181,0,0.12),transparent_60%),radial-gradient(900px_500px_at_80%_20%,rgba(177,7,8,0.16),transparent_55%),radial-gradient(900px_600px_at_50%_90%,rgba(25,182,217,0.10),transparent_60%)]" />
      </div>

      <motion.div
        variants={pageVariants}
        initial="hidden"
        animate="show"
        className="mx-auto w-[min(1100px,94vw)] py-8"
      >
        {/* Back */}
        <div className="mb-6">
          <button
            onClick={() => navigate("/employees")}
            className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-white/75 shadow-sm hover:bg-white/[0.06] hover:text-white transition"
          >
            <ChevronLeft className="h-4 w-4 opacity-80 group-hover:opacity-100" />
            Back to Members
          </button>
        </div>

        {/* Header */}
        <motion.div variants={fadeUp} className="mb-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/[0.04]">
                <ReceiptText className="h-5 w-5 text-[var(--color-accent)]" />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold text-white">
                    {employee.name}
                  </h1>
                  <span
                    className={cx(
                      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      isActive
                        ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
                        : "border-white/10 bg-white/5 text-white/60"
                    )}
                  >
                    {isActive ? "Active" : "Inactive"}
                  </span>
                </div>

                <p className="mt-1 text-sm text-white/55">
                  Employee profile, payouts, and pay stub history — scoped per
                  organization.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-white/70">
                <span className="text-white/45">Pending:</span>
                <span className="font-semibold text-white">
                  {stats.pendingCount}
                </span>
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-white/70">
                <span className="text-white/45">Paid:</span>
                <span className="font-semibold text-white">
                  {stats.paidCount}
                </span>
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-white/70">
                <span className="text-white/45">Stubs:</span>
                <span className="font-semibold text-white">
                  {stats.stubCount}
                </span>
              </span>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <StatMoney
              label="Pending payouts"
              cents={stats.pendingTotal}
              hint="Unpaid payouts currently on this employee."
            />
            <StatMoney
              label="Paid payouts"
              cents={stats.paidTotal}
              hint="Total paid out (all time) for this employee."
            />
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
              <p className="text-[11px] uppercase tracking-wide text-white/55">
                Last paid
              </p>
              <div className="mt-2 text-sm font-semibold text-white">
                {stats.latestPaidAt
                  ? fmtDate(stats.latestPaidAt as unknown)
                  : "—"}
              </div>
              <p className="mt-1 text-xs text-white/45">
                Helpful for checking recent payroll activity.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Employee profile card (collapsible) */}
        <motion.div
          variants={fadeUp}
          className="rounded-3xl border border-white/10 bg-white/[0.04] shadow-[0_25px_80px_rgba(0,0,0,0.35)]"
        >
          <button
            type="button"
            onClick={() => setProfileOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
          >
            <div>
              <h2 className="text-lg font-semibold text-white">
                Employee profile
              </h2>
              <p className="mt-1 text-xs text-white/50">
                Click to {profileOpen ? "hide" : "view / edit"} employee
                details.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span
                className={cx(
                  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  isActive
                    ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
                    : "border-white/10 bg-white/5 text-white/60"
                )}
              >
                {isActive ? "Active" : "Inactive"}
              </span>

              <ChevronDown
                className={cx(
                  "h-5 w-5 text-white/60 transition-transform",
                  profileOpen ? "rotate-180" : ""
                )}
              />
            </div>
          </button>

          <AnimatePresence initial={false}>
            {profileOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{
                  height: "auto",
                  opacity: 1,
                  transition: { duration: 0.35, ease },
                }}
                exit={{
                  height: 0,
                  opacity: 0,
                  transition: { duration: 0.25, ease },
                }}
                className="overflow-hidden"
              >
                <div className="border-t border-white/10 px-6 pb-6">
                  <div className="mt-4 grid gap-4">
                    {/* Name */}
                    <div>
                      <label className="text-xs text-white/60">Name</label>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none focus:border-[var(--color-accent)]/40 focus:ring-2 focus:ring-[var(--color-accent)]/15"
                      />
                    </div>

                    {/* Status */}
                    <div>
                      <label className="text-xs text-white/60">Status</label>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsActive(true)}
                          className={cx(
                            "rounded-full px-3 py-1 text-xs font-semibold uppercase transition",
                            isActive
                              ? "bg-emerald-500/20 text-emerald-100 border border-emerald-400/25"
                              : "bg-white/[0.03] text-white/60 border border-white/10 hover:bg-white/[0.06]"
                          )}
                        >
                          Active
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsActive(false)}
                          className={cx(
                            "rounded-full px-3 py-1 text-xs font-semibold uppercase transition",
                            !isActive
                              ? "bg-white/10 text-white border border-white/15"
                              : "bg-white/[0.03] text-white/60 border border-white/10 hover:bg-white/[0.06]"
                          )}
                        >
                          Inactive
                        </button>
                      </div>
                      <p className="mt-1 text-[11px] text-white/45">
                        Inactive employees stay for history, but won’t be
                        selectable on new jobs.
                      </p>
                    </div>

                    {/* Address */}
                    <div>
                      <label className="text-xs text-white/60">
                        Address (optional, for your own records)
                      </label>
                      <input
                        value={address.fullLine}
                        onChange={(e) =>
                          setAddress((s) => ({
                            ...s,
                            fullLine: e.target.value,
                          }))
                        }
                        placeholder="Full address line"
                        className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none focus:border-[var(--color-accent)]/40 focus:ring-2 focus:ring-[var(--color-accent)]/15"
                      />
                    </div>

                    <div className="grid gap-2 sm:grid-cols-3">
                      <input
                        value={address.city}
                        onChange={(e) =>
                          setAddress((s) => ({ ...s, city: e.target.value }))
                        }
                        placeholder="City"
                        className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none focus:border-[var(--color-accent)]/40 focus:ring-2 focus:ring-[var(--color-accent)]/15"
                      />
                      <input
                        value={address.state}
                        onChange={(e) =>
                          setAddress((s) => ({ ...s, state: e.target.value }))
                        }
                        placeholder="State"
                        className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none focus:border-[var(--color-accent)]/40 focus:ring-2 focus:ring-[var(--color-accent)]/15"
                      />
                      <input
                        value={address.zip}
                        onChange={(e) =>
                          setAddress((s) => ({ ...s, zip: e.target.value }))
                        }
                        placeholder="ZIP"
                        className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none focus:border-[var(--color-accent)]/40 focus:ring-2 focus:ring-[var(--color-accent)]/15"
                      />
                    </div>

                    <div className="pt-1">
                      <button
                        onClick={save}
                        disabled={saving}
                        className="inline-flex items-center justify-center rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white shadow hover:bg-[var(--color-primary-600)] disabled:opacity-60 transition"
                      >
                        {saving ? "Saving…" : "Save changes"}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Payouts section */}
        <motion.section
          variants={fadeUp}
          className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.35)]"
        >
          {/* HEADER */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-semibold text-white">
                  Payouts for {employee.name}
                </h2>

                <button
                  type="button"
                  onClick={() => setPayoutsOpen((v) => !v)}
                  className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-semibold text-white/75 hover:bg-white/[0.06] transition"
                >
                  <ChevronDown
                    className={cx(
                      "mr-1 h-4 w-4 transition-transform",
                      payoutsOpen ? "rotate-0" : "-rotate-90"
                    )}
                  />
                  <span className="hidden sm:inline">
                    {payoutsOpen ? "Collapse" : "Expand"}
                  </span>
                </button>
              </div>

              <p className="mt-1 text-xs text-white/50">
                Pending payouts can be selected to create a pay stub (which also
                marks them as paid).
              </p>
            </div>

            {/* Search by address */}
            <div className="w-full sm:w-auto">
              <label className="text-[10px] uppercase tracking-wide text-white/45">
                Search by address
              </label>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                <Search className="h-4 w-4 text-white/45" />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Address, city, state, or ZIP…"
                  className="w-full bg-transparent text-sm text-white placeholder:text-white/35 outline-none"
                />
              </div>
            </div>
          </div>

          {/* ✅ START: COLLAPSIBLE BODY */}
          <AnimatePresence initial={false}>
            {payoutsOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.25, ease },
                }}
                exit={{ opacity: 0, y: 6, transition: { duration: 0.2, ease } }}
              >
                {/* Tabs */}
                <div className="mb-4 inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1 text-xs">
                  {(["all", "pending", "paid"] as PayoutFilter[]).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setPayoutFilter(f)}
                      className={cx(
                        "px-3 py-1 rounded-full capitalize transition",
                        payoutFilter === f
                          ? "bg-[var(--color-accent)]/20 text-[var(--color-accent)] border border-[var(--color-accent)]/25"
                          : "text-white/70 hover:bg-white/[0.06]"
                      )}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                {/* Pending tab actions */}
                {payoutFilter === "pending" && selectedIds.length > 0 && (
                  <div className="mb-4 flex items-center justify-between">
                    <div className="text-xs text-white/50">
                      Selected:{" "}
                      <span className="font-semibold text-white">
                        {selectedIds.length}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setStubOpen(true)}
                        className="rounded-xl bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-100 border border-emerald-400/25 hover:bg-emerald-500/25 transition"
                      >
                        Create stub ({selectedIds.length})
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedIds([])}
                        className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-white/75 hover:bg-white/[0.06] transition"
                      >
                        Clear all
                      </button>
                    </div>
                  </div>
                )}

                {/* List states */}
                {payoutsLoading && (
                  <p className="text-sm text-white/60">Loading payouts…</p>
                )}
                {payoutsError && (
                  <p className="text-sm text-red-200">{payoutsError}</p>
                )}
                {!payoutsLoading &&
                  !payoutsError &&
                  filteredPayouts.length === 0 && (
                    <p className="text-sm text-white/60">
                      No payouts match the current filters.
                    </p>
                  )}

                {!payoutsLoading &&
                  !payoutsError &&
                  filteredPayouts.length > 0 && (
                    <div className="mt-2 max-h-[55vh] md:max-h-[440px] overflow-y-auto overscroll-contain pr-1">
                      <ul className="space-y-2">
                        {filteredPayouts.map((p) => {
                          const addr = normalizeJobAddress(
                            p.jobAddressSnapshot
                          );
                          const isChecked = selectedIds.includes(p.id);

                          return (
                            <li
                              key={p.id}
                              className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 hover:bg-white/[0.05] transition"
                            >
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="flex items-start gap-3">
                                  {payoutFilter === "pending" && (
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => toggleSelected(p.id)}
                                      className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent text-[var(--color-accent)]"
                                    />
                                  )}

                                  <div>
                                    <div className="font-semibold text-white">
                                      {addr.display || "—"}
                                    </div>

                                    {(addr.city || addr.state || addr.zip) && (
                                      <div className="text-xs text-white/55">
                                        {[addr.city, addr.state, addr.zip]
                                          .filter(Boolean)
                                          .join(", ")}
                                      </div>
                                    )}

                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/60">
                                      <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/70">
                                        {p.category || "payout"}
                                      </span>

                                      {typeof p.sqft === "number" &&
                                        typeof p.ratePerSqFt === "number" && (
                                          <span>
                                            {p.sqft.toLocaleString()} sq.ft @ $
                                            {p.ratePerSqFt.toFixed(2)}/sq.ft
                                          </span>
                                        )}
                                    </div>

                                    <div className="mt-1 text-[11px] text-white/45">
                                      Created: {fmtDate(p.createdAt as unknown)}
                                      {p.paidAt && (
                                        <>
                                          {" "}
                                          • Paid: {fmtDate(p.paidAt as unknown)}
                                        </>
                                      )}
                                      {!p.paidAt && (
                                        <span className="ml-2 inline-flex items-center rounded-full border border-yellow-400/25 bg-yellow-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-yellow-200">
                                          Pending
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                                  <div className="text-right">
                                    <div className="text-[11px] text-white/45">
                                      Total
                                    </div>
                                    <div className="text-base font-semibold text-white">
                                      {money(p.amountCents)}
                                    </div>
                                  </div>

                                  {p.jobId && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        navigate(`/job/${p.jobId}`)
                                      }
                                      className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-white/75 hover:bg-white/[0.06] transition"
                                    >
                                      View Job
                                    </button>
                                  )}

                                  {p.paidAt ? (
                                    <span className="inline-flex items-center rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-200">
                                      Paid
                                    </span>
                                  ) : payoutFilter !== "pending" ? (
                                    <span className="inline-flex items-center rounded-full border border-yellow-400/25 bg-yellow-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-yellow-200">
                                      Pending
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
              </motion.div>
            )}
          </AnimatePresence>
          {/* ✅ END: COLLAPSIBLE BODY */}
        </motion.section>

        {/* Pay stubs history */}
        <motion.section
          variants={fadeUp}
          className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.35)]"
        >
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Pay Stubs History
              </h2>
              <p className="mt-1 text-xs text-white/50">
                Saved pay stubs created when you mark payouts as paid.
              </p>
            </div>

            <div className="w-full sm:w-auto">
              <label className="text-[10px] uppercase tracking-wide text-white/45">
                Search stubs
              </label>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                <Search className="h-4 w-4 text-white/45" />
                <input
                  value={stubSearch}
                  onChange={(e) => setStubSearch(e.target.value)}
                  placeholder="Stub #, address, city, state, ZIP…"
                  className="w-full bg-transparent text-sm text-white placeholder:text-white/35 outline-none"
                />
              </div>
            </div>
          </div>

          {stubsLoading && (
            <div className="text-sm text-white/60">Loading stubs…</div>
          )}
          {stubsError && (
            <div className="text-sm text-red-200">{stubsError}</div>
          )}

          {!stubsLoading && !stubsError && filteredStubs.length === 0 && (
            <div className="text-sm text-white/60">No stubs yet.</div>
          )}

          {!stubsLoading && !stubsError && filteredStubs.length > 0 && (
            <div className="space-y-2">
              {filteredStubs.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 hover:bg-white/[0.05] transition sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {s.number}
                    </div>
                    <div className="text-[11px] text-white/50">
                      {s.lines.length} payouts • Created {fmtDate(s.createdAt)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <div className="text-sm font-semibold text-white">
                      {money(s.totalCents)}
                    </div>
                    <button
                      type="button"
                      onClick={() => setViewStubId(s.id)}
                      className="rounded-xl bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15 transition"
                    >
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.section>

        {/* Stub modal */}
        {stubOpen && employee && selectedPayouts.length > 0 && (
          <GlobalPayoutStubModal
            employee={employee}
            payouts={selectedPayouts}
            onClose={() => setStubOpen(false)}
            onConfirmPaid={markSelectedAsPaid}
            saving={stubSaving}
          />
        )}

        {stubToView && (
          <PayoutStubViewerModal
            stub={stubToView}
            employeeNameOverride={employee?.name}
            onClose={() => setViewStubId(null)}
          />
        )}
      </motion.div>
    </div>
  );
}

function normalizeEmployeeAddress(
  a: Employee["address"]
): EmployeeAddress | null {
  if (!a) return null;
  if (typeof a === "string") return { fullLine: a, line1: a };
  return a as EmployeeAddress;
}
