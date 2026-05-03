import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import type { FieldValue } from "firebase/firestore";

import { db } from "../firebase/firebaseConfig";
import { useOrg } from "../contexts/OrgContext";
import type { Employee, PayoutDoc } from "../types/types";

export type PayoutFilter = "all" | "pending" | "paid";

function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim().length > 0) return v;
  }
  return "";
}

function addr(a: unknown) {
  if (typeof a === "string") {
    return { display: a, line1: a, city: "", state: "", zip: "" };
  }

  const obj: Record<string, unknown> =
    (a as Record<string, unknown>) ?? {};

  const line1 = pickString(obj, [
    "fullLine",
    "line1",
    "street",
    "address1",
    "address",
    "full",
    "formatted",
    "text",
    "label",
    "line",
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

function payoutEmployeeName(p: PayoutDoc): string {
  const snap = (p as any).employeeNameSnapshot;
  if (!snap) return "";
  if (typeof snap === "string") return snap;

  if (typeof snap === "object") {
    return pickString(snap as Record<string, unknown>, [
      "name",
      "fullName",
      "displayName",
    ]);
  }

  return "";
}

export function useDashboardPayoutsData() {
  const { orgId } = useOrg();

  const [payouts, setPayouts] = useState<PayoutDoc[]>([]);
  const [payoutsLoading, setPayoutsLoading] = useState(true);
  const [payoutsError, setPayoutsError] = useState<string | null>(null);

  const [payoutFilter, setPayoutFilter] = useState<PayoutFilter>("pending");
  const [payoutSearch, setPayoutSearch] = useState("");

  const [payoutsPage, setPayoutsPage] = useState(1);
  const PAYOUTS_PER_PAGE = 20;

  const [selectedPayoutIds, setSelectedPayoutIds] = useState<string[]>([]);
  const [stubOpen, setStubOpen] = useState(false);
  const [stubSaving, setStubSaving] = useState(false);
  const [stubEmployee, setStubEmployee] = useState<Employee | null>(null);

  useEffect(() => {
    if (!orgId) return;

    const payoutsQuery = query(
      collection(db, "organizations", orgId, "payouts"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      payoutsQuery,
      (snap) => {
        setPayouts(
          snap.docs.map((d) => {
            const data = d.data() as PayoutDoc;
    
            return {
              ...data,
              id: data.id || d.id,
            };
          })
        );
    
        setPayoutsLoading(false);
        setPayoutsError(null);
      },
      (err) => {
        console.error(err);
        setPayoutsError(err.message || String(err));
        setPayoutsLoading(false);
      }
    );

    return () => unsub();
  }, [orgId]);

  const filteredPayouts = useMemo(() => {
    const term = payoutSearch.trim().toLowerCase();

    return payouts.filter((p) => {
      if (payoutFilter === "pending" && p.paidAt) return false;
      if (payoutFilter === "paid" && !p.paidAt) return false;

      if (term.length > 0) {
        const a = addr((p as any).jobAddressSnapshot);
        const employeeName = payoutEmployeeName(p);

        const haystack = [
          a.display,
          a.line1,
          a.city,
          a.state,
          a.zip,
          employeeName,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(term)) return false;
      }

      return true;
    });
  }, [payouts, payoutFilter, payoutSearch]);

  useEffect(() => {
    setPayoutsPage(1);
  }, [payoutFilter, payoutSearch, payouts.length]);

  const payoutsTotalPages = Math.max(
    1,
    Math.ceil(filteredPayouts.length / PAYOUTS_PER_PAGE)
  );

  const pagedPayouts = useMemo(() => {
    const start = (payoutsPage - 1) * PAYOUTS_PER_PAGE;
    const end = start + PAYOUTS_PER_PAGE;
    return filteredPayouts.slice(start, end);
  }, [filteredPayouts, payoutsPage]);

  const selectedPayouts = useMemo(
    () => payouts.filter((p) => selectedPayoutIds.includes(p.id)),
    [payouts, selectedPayoutIds]
  );

  const selectedEmployeeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of selectedPayouts) {
      const id = (p as any).employeeId as string | undefined;
      if (id) ids.add(id);
    }
    return Array.from(ids);
  }, [selectedPayouts]);

  const canCreateStub =
    payoutFilter === "pending" &&
    selectedPayoutIds.length > 0 &&
    selectedEmployeeIds.length === 1;

  function togglePayoutSelected(id: string) {
    setSelectedPayoutIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function clearSelectedPayouts() {
    setSelectedPayoutIds([]);
  }

  useEffect(() => {
    if (!stubOpen) {
      setStubEmployee(null);
      return;
    }

    if (selectedEmployeeIds.length !== 1) {
      setStubEmployee(null);
      return;
    }

    const employeeId = selectedEmployeeIds[0];
    let cancelled = false;

    (async () => {
      try {
        if (!orgId) return;

        const ref = doc(
          collection(db, "organizations", orgId, "employees"),
          employeeId
        );

        const snap = await getDoc(ref);
        if (!snap.exists()) return;

        if (!cancelled) {
          setStubEmployee({
            id: snap.id,
            ...(snap.data() as Omit<Employee, "id">),
          });
        }
      } catch (err) {
        console.error("Failed to load employee for stub", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [stubOpen, selectedEmployeeIds, orgId]);

  async function markSelectedPayoutsAsPaid() {
    if (selectedPayoutIds.length === 0) return;

    const payoutsToMark = selectedPayouts.filter((p) => !p.paidAt);
    if (payoutsToMark.length === 0) {
      setStubOpen(false);
      return;
    }

    setStubSaving(true);

    try {
      if (!orgId) throw new Error("Missing orgId.");
      if (!stubEmployee) throw new Error("Missing employee.");
      if (!stubEmployee.id) throw new Error("Employee missing id.");

      const stubRef = doc(collection(db, "organizations", orgId, "payoutStubs"));

      const now = new Date();
      const y = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      const shortId = stubRef.id.slice(0, 6).toUpperCase();
      const number = `STUB-${y}${mm}${dd}-${shortId}`;

      const lines = payoutsToMark.map((p) => ({
        payoutId: p.id,
        category: p.category,
        sqft: p.sqft,
        ratePerSqFt: p.ratePerSqFt,
        amountCents:
          typeof (p as any).amountCents === "number"
            ? (p as any).amountCents
            : 0,
        ...((p as any).jobId ? { jobId: (p as any).jobId } : {}),
        ...((p as any).jobAddressSnapshot
          ? { jobAddressSnapshot: (p as any).jobAddressSnapshot }
          : {}),
      }));

      const totalCents = lines.reduce((sum, l) => sum + (l.amountCents || 0), 0);

      const jobIds = Array.from(
        new Set(lines.map((l) => l.jobId).filter(Boolean))
      ) as string[];

      const employeeAddr = (() => {
        const raw = stubEmployee.address;
      
        if (!raw) return null;
      
        if (typeof raw === "string") {
          const fullLine = raw.trim();
          return fullLine ? { fullLine, line1: fullLine } : null;
        }
      
        const fullLine = raw.fullLine?.trim() || "";
        const line1 = raw.line1?.trim() || "";
        const city = raw.city?.trim() || "";
        const state = raw.state?.trim() || "";
        const zip = raw.zip?.trim() || "";
      
        const cityStateZip = [city, state, zip].filter(Boolean).join(", ");
        const displayLine = fullLine || [line1, cityStateZip].filter(Boolean).join(", ");
      
        if (!displayLine && !line1 && !city && !state && !zip) return null;
      
        return {
          ...(displayLine ? { fullLine: displayLine } : {}),
          ...(line1 ? { line1 } : {}),
          ...(city ? { city } : {}),
          ...(state ? { state } : {}),
          ...(zip ? { zip } : {}),
        };
      })();

      await setDoc(stubRef, {
        id: stubRef.id,
        number,
        employeeId: stubEmployee.id,
        orgId,
        employeeNameSnapshot: stubEmployee.name,
        ...(employeeAddr ? { employeeAddressSnapshot: employeeAddr } : {}),
        payoutIds: lines.map((l) => l.payoutId),
        jobIds,
        lines,
        totalCents,
        createdAt: serverTimestamp() as unknown as FieldValue,
        paidAt: serverTimestamp() as unknown as FieldValue,
        status: "paid",
      });

      await Promise.all(
        payoutsToMark.map((p) =>
          setDoc(
            doc(collection(db, "organizations", orgId, "payouts"), p.id),
            {
              paidAt: serverTimestamp(),
              payoutStubId: stubRef.id,
            },
            { merge: true }
          )
        )
      );

      setSelectedPayoutIds([]);
      setStubOpen(false);
    } catch (e) {
      console.error("Failed to mark payouts as paid + create stub", e);
      throw e;
    } finally {
      setStubSaving(false);
    }
  }

  return {
    payouts,
    payoutsLoading,
    payoutsError,
    payoutFilter,
    setPayoutFilter,
    payoutSearch,
    setPayoutSearch,
    payoutsPage,
    setPayoutsPage,
    PAYOUTS_PER_PAGE,
    filteredPayouts,
    payoutsTotalPages,
    pagedPayouts,
    selectedPayoutIds,
    selectedEmployeeIds,
    selectedPayouts,
    canCreateStub,
    togglePayoutSelected,
    clearSelectedPayouts,
    stubOpen,
    setStubOpen,
    stubSaving,
    stubEmployee,
    markSelectedPayoutsAsPaid,
  };
}