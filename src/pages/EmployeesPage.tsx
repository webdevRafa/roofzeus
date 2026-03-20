// src/pages/EmployeesPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import type { FieldValue } from "firebase/firestore";
import { useNavigate, useLocation } from "react-router-dom";
import { db } from "../firebase/firebaseConfig";
import type { Employee, EmployeeAddress } from "../types/types";
import { useOrg } from "../contexts/OrgContext";

import { AnimatePresence, motion, type Variants } from "framer-motion";
import CountUp from "react-countup";
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  Copy,
  Send,
  ChevronRight,
  BadgeCheck,
  BadgeAlert,
  BadgeX,
  Clock,
} from "lucide-react";

const ease = [0.16, 1, 0.3, 1] as const;

const pageIn: Variants = {
  hidden: { opacity: 0, y: 10, filter: "blur(8px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.6, ease },
  },
};

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 10, filter: "blur(8px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.55, ease },
  },
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type EmployeeRole =
  | "roofer"
  | "foreman"
  | "technician"
  | "laborer"
  | "office"
  | "other";

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const location = useLocation();

  const { orgId, loading: orgLoading } = useOrg();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<EmployeeRole>("roofer");

  /**
   * Create or resend an invite for the given employee.
   * This creates a new employeeInvites doc and updates the employee’s invite metadata,
   * including an inviteDocId.  If the employee lacks an email, an error message is shown.
   */
  async function sendInviteFor(employee: Employee) {
    if (!orgId) {
      setError("No organization selected.");
      return;
    }

    try {
      if (!employee.email) {
        setError(
          "Employee is missing an email address. Please edit the employee and add an email before sending an invite."
        );
        return;
      }
      setError(null);
      const inviteRef = doc(
        collection(db, "organizations", orgId, "employeeInvites")
      );
      const batch = writeBatch(db);
      const now = serverTimestamp() as FieldValue;
      // snapshot the current role/accessRole or fall back to sensible defaults
      const roleSnapshot = (employee.role || role) as any;
      const accessRoleSnapshot = (employee.accessRole || "crew") as any;

      // Create the invite document
      batch.set(inviteRef, {
        id: inviteRef.id,
        orgId,
        employeeId: employee.id,
        email: employee.email,
        status: "pending",
        roleSnapshot,
        accessRoleSnapshot,
        createdAt: now,
        createdByUserId: null,
        updatedAt: now,
      });

      // Update the employee’s invite metadata and save the inviteDocId
      batch.set(
        doc(db, "organizations", orgId, "employees", employee.id),
        {
          invite: {
            status: "pending",
            email: employee.email,
            invitedAt: now,
            invitedByUserId: null,
            lastSentAt: now,
            inviteDocId: inviteRef.id,
          },
          updatedAt: now,
        },
        { merge: true }
      );

      await batch.commit();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    }
  }

  /**
   * Copy the acceptance link for a pending invite to the clipboard.
   * The inviteDocId must be present on the employee’s invite metadata.
   * Displays a browser alert on success or error.
   */
  function copyInviteLink(employee: Employee) {
    const inviteId = (employee as any).invite?.inviteDocId;
    if (!inviteId) {
      setError(
        "No invite found for this employee. Please send an invite first."
      );
      return;
    }
    if (!orgId) {
      setError("No organization selected.");
      return;
    }
    const url = `${
      window.location.origin
    }/accept-invite?orgId=${encodeURIComponent(
      orgId
    )}&inviteId=${encodeURIComponent(inviteId)}`;

    navigator.clipboard
      .writeText(url)
      .then(() => {
        alert("Invite link copied to clipboard.");
      })
      .catch(() => {
        alert("Failed to copy invite link. Please copy manually: " + url);
      });
  }

  const successMessage =
    (location.state as { message?: string } | null)?.message ?? null;

  // Auto-clear message
  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => {
      if (orgId) {
        navigate(`/employees`, { replace: true, state: {} });
      } else {
        navigate("/", { replace: true, state: {} });
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [successMessage, navigate, orgId]);

  // Fetch employees
  useEffect(() => {
    setError(null);

    if (orgLoading) return;

    if (!orgId) {
      setEmployees([]);
      setError("No organization selected.");
      return;
    }

    const q = query(
      collection(db, "organizations", orgId, "employees"),
      orderBy("name", "asc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Employee[] = snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<Employee, "id">),
        }));
        setEmployees(list);
      },
      (err) => {
        console.error("Employees snapshot error:", err);
        setError(err.message || "Failed to load employees.");
        setEmployees([]);
      }
    );

    return () => unsub();
  }, [orgId, orgLoading]);

  async function createEmployee() {
    if (!name.trim()) return;
    if (!orgId) {
      setError("No organization selected.");
      return;
    }
    setCreating(true);
    setError(null);

    try {
      const employeeRef = doc(
        collection(db, "organizations", orgId, "employees")
      );
      const inviteEmail = email.trim().toLowerCase();
      const hasInvite = inviteEmail.length > 0;

      const batch = writeBatch(db);

      const invitedByUserId = null; // placeholder for now (auth.uid later)

      const employee: Employee = {
        id: employeeRef.id,
        orgId,
        name: name.trim(),
        email: hasInvite ? inviteEmail : null,
        role: role as any,
        accessRole: "crew" as any,
        userId: null,
        isActive: true,
        invite: hasInvite
          ? {
              status: "pending",
              email: inviteEmail,
              invitedAt: serverTimestamp() as FieldValue,
              invitedByUserId,
              lastSentAt: serverTimestamp() as FieldValue,
            }
          : ({ status: "none" } as any),
        createdAt: serverTimestamp() as FieldValue,
        updatedAt: serverTimestamp() as FieldValue,
      };

      batch.set(employeeRef, employee);

      if (hasInvite) {
        const inviteRef = doc(
          collection(db, "organizations", orgId, "employeeInvites")
        );
        batch.set(inviteRef, {
          id: inviteRef.id,
          orgId,
          employeeId: employeeRef.id,
          email: inviteEmail,
          status: "pending",
          roleSnapshot: role,
          accessRoleSnapshot: "crew",
          createdAt: serverTimestamp(),
          createdByUserId: invitedByUserId,
        });
        // Also store the inviteDocId on the employee’s invite metadata
        batch.set(
          employeeRef,
          {
            invite: {
              ...(employee.invite || {}),
              inviteDocId: inviteRef.id,
            },
          },
          { merge: true }
        );
      }

      await batch.commit();

      setName("");
      setEmail("");
      setRole("roofer");

      navigate(`/employees/${employeeRef.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  }

  const kpis = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((e) => e.isActive !== false).length;
    const invitedPending = employees.filter(
      (e) => ((e as any).invite?.status || "none") === "pending"
    ).length;
    const accepted = employees.filter(
      (e) => ((e as any).invite?.status || "none") === "accepted"
    ).length;
    return { total, active, invitedPending, accepted };
  }, [employees]);

  return (
    <motion.main
      variants={pageIn}
      initial="hidden"
      animate="show"
      className="min-h-screen"
    >
      <div className="mx-auto max-w-[1200px] py-10 px-4 md:px-0">
        {/* Header */}
        <motion.div variants={fadeUp} className="mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 flex items-center justify-center">
                  <Users
                    className="h-5 w-5"
                    style={{ color: "rgba(207,174,93,0.95)" }}
                  />
                </div>
                <div className="min-w-0">
                  <h1 className="text-sm md:text-lg font-semibold tracking-tight">
                    Members
                  </h1>
                  <p
                    className="mt-1 text-sm"
                    style={{ color: "var(--color-muted)" }}
                  >
                    Create employees, invite crew, and manage access.
                  </p>
                </div>
              </div>
            </div>

            {/* KPI chips */}
            <div className="flex flex-wrap gap-2">
              <KpiChip
                label="Total"
                value={kpis.total}
                icon={<Users className="h-4 w-4" />}
              />
              <KpiChip
                label="Active"
                value={kpis.active}
                icon={<BadgeCheck className="h-4 w-4" />}
                tone="good"
              />
              <KpiChip
                label="Pending invites"
                value={kpis.invitedPending}
                icon={<Clock className="h-4 w-4" />}
                tone="warn"
              />
              <KpiChip
                label="Accepted"
                value={kpis.accepted}
                icon={<BadgeCheck className="h-4 w-4" />}
              />
            </div>
          </div>
        </motion.div>

        {/* Add employee */}
        <motion.section
          variants={fadeUp}
          className="relative z-30 mb-6  p-4 md:p-5  "
        >
          <div className="flex items-center justify-between gap-3 flex-wrap mt-20">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9  flex items-center justify-center">
                <UserPlus
                  className="h-4 w-4"
                  style={{ color: "rgba(207,174,93,0.95)" }}
                />
              </div>
              <div>
                <div className="text-sm font-semibold text-[var(--color-text)]">
                  Add a new member
                </div>
                <div
                  className="text-[12px]"
                  style={{ color: "var(--color-muted)" }}
                >
                  Add now, invite later — or invite immediately by email.
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-4">
              <label className="text-[12px] text-white/55">Member name</label>
              <div className="mt-1 relative">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Jose Martinez"
                  className={`w-full bg-[var(--color-card)]  px-3 py-2.5 text-sm outline-none focus:ring-2`}
                />
              </div>
            </div>

            <div className="lg:col-span-4">
              <label className="text-[12px] text-white/55">
                Email (optional)
              </label>
              <div className="mt-1 relative">
                <Mail
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                  style={{ color: "rgba(245,246,248,0.40)" }}
                />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="for invites"
                  className="w-full bg-[var(--color-card)] pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2"
                />
              </div>
            </div>

            {/* ✅ Styled dropdown (matches JobsPage SortMenu) */}
            <div className="lg:col-span-3">
              <label className="text-[12px] text-white/55">Role</label>
              <div className="mt-1 relative">
                <Shield
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                  style={{ color: "rgba(245,246,248,0.40)" }}
                />

                <div className="pl-9">
                  <RoleMenu value={role} onChange={(v) => setRole(v)} />
                </div>
              </div>
            </div>

            <div className="lg:col-span-1 flex items-end">
              <motion.button
                whileTap={{ scale: 0.98 }}
                whileHover={{ y: -1 }}
                onClick={createEmployee}
                disabled={creating || !name.trim()}
                className={cx(
                  "w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition border",
                  creating || !name.trim()
                    ? "opacity-60 cursor-not-allowed"
                    : "cursor-pointer"
                )}
                style={{
                  backgroundColor: "var(--btn-bg)",
                  color: "var(--btn-text)",
                  borderColor: "rgba(0,0,0,0.25)",
                }}
              >
                {creating ? "Saving…" : "Add"}
              </motion.button>
            </div>
          </div>

          <AnimatePresence>
            {error ? (
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="mt-3 text-sm"
                style={{ color: "rgba(255,120,120,0.95)" }}
              >
                {error}
              </motion.p>
            ) : null}
          </AnimatePresence>

          <AnimatePresence>
            {successMessage ? (
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="mt-3 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"
                style={{
                  borderColor: "rgba(46, 204, 113, 0.25)",
                  backgroundColor: "rgba(46, 204, 113, 0.10)",
                  color: "rgba(200, 255, 225, 0.95)",
                }}
              >
                <BadgeCheck className="h-4 w-4" />
                {successMessage}
              </motion.p>
            ) : null}
          </AnimatePresence>
        </motion.section>

        {/* List */}
        <motion.section
          variants={fadeUp}
          className="relative z-0    hover:shadow-md overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-b-[var(--color-text)]/20 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">All members</h2>
              <p className="text-sm text-[var(--color-text)]/70">
                Active employees can be selected on jobs. Inactive stay for
                history only.
              </p>
            </div>
          </div>

          <div className="p-3 md:p-4">
            {employees.length === 0 ? (
              <div
                className="rounded-2xl border p-6 text-center"
                style={{
                  borderColor: "rgba(255,255,255,0.10)",
                  backgroundColor: "rgba(11,14,20,0.45)",
                }}
              >
                <div className="text-sm font-semibold">No employees yet.</div>
                <div
                  className="mt-1 text-sm"
                  style={{ color: "var(--color-muted)" }}
                >
                  Add your first crew member above — invite is optional.
                </div>
              </div>
            ) : (
              <motion.ul
                variants={stagger}
                initial="hidden"
                animate="show"
                className="space-y-2"
              >
                {employees.map((e) => {
                  const addr = normalizeEmployeeAddress(e.address);
                  const active = e.isActive !== false;

                  const invite = (e as any).invite || {};
                  const status = invite.status || "none";

                  return (
                    <motion.li
                      key={e.id}
                      variants={fadeUp}
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        navigate(`/org/${orgId}/employees/${e.id}`)
                      }
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter" || ev.key === " ") {
                          ev.preventDefault();
                          navigate(`/employees/${e.id}`);
                        }
                      }}
                      className={cx(
                        "group  p-4 cursor-pointer transition bg-[var(--color-card)] mb-3",
                        "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-gold)]/40"
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        {/* Left */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="text-sm font-semibold truncate">
                              {e.name}
                            </div>

                            <span
                              className={cx(
                                "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase",
                                active ? "text-emerald-200" : "text-white/60"
                              )}
                              style={{
                                borderColor: active
                                  ? "rgba(46, 204, 113, 0.25)"
                                  : "rgba(255,255,255,0.12)",
                                backgroundColor: active
                                  ? "rgba(46, 204, 113, 0.10)"
                                  : "rgba(255,255,255,0.06)",
                              }}
                            >
                              {active ? "Active" : "Inactive"}
                            </span>

                            <InvitePill status={status} />
                          </div>

                          {addr ? (
                            <div
                              className="mt-1 text-sm truncate"
                              style={{ color: "var(--color-muted)" }}
                            >
                              {addr.fullLine ||
                                [addr.line1, addr.city, addr.state, addr.zip]
                                  .filter(Boolean)
                                  .join(", ")}
                            </div>
                          ) : (
                            <div
                              className="mt-1 text-sm"
                              style={{ color: "rgba(245,246,248,0.45)" }}
                            >
                              No address on file
                            </div>
                          )}
                        </div>

                        {/* Right */}
                        <div className="shrink-0 flex items-center gap-2">
                          {/* Invite actions */}
                          <div className="hidden sm:flex items-center gap-2">
                            {(() => {
                              if (status === "pending") {
                                return (
                                  <>
                                    <ActionBtn
                                      icon={<Send className="h-4 w-4" />}
                                      label="Resend"
                                      onClick={(ev) => {
                                        ev.stopPropagation();
                                        sendInviteFor(e);
                                      }}
                                    />
                                    <ActionBtn
                                      icon={<Copy className="h-4 w-4" />}
                                      label="Copy link"
                                      onClick={(ev) => {
                                        ev.stopPropagation();
                                        copyInviteLink(e);
                                      }}
                                    />
                                  </>
                                );
                              }
                              if (status === "none" || !status) {
                                if (e.email) {
                                  return (
                                    <ActionBtn
                                      icon={<Send className="h-4 w-4" />}
                                      label="Invite"
                                      onClick={(ev) => {
                                        ev.stopPropagation();
                                        sendInviteFor(e);
                                      }}
                                    />
                                  );
                                }
                                return (
                                  <span
                                    className="text-[12px] italic"
                                    style={{ color: "rgba(245,246,248,0.45)" }}
                                  >
                                    Add email to invite
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </div>

                          <div
                            className="h-9 w-9 rounded-xl border flex items-center justify-center transition"
                            style={{
                              borderColor: "rgba(255,255,255,0.10)",
                              backgroundColor: "rgba(31,36,48,0.40)",
                            }}
                          >
                            <ChevronRight
                              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                              style={{ color: "rgba(245,246,248,0.70)" }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Mobile action row */}
                      <div className="sm:hidden mt-3 flex flex-wrap gap-2">
                        {(() => {
                          if (status === "pending") {
                            return (
                              <>
                                <ActionBtn
                                  icon={<Send className="h-4 w-4" />}
                                  label="Resend"
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    sendInviteFor(e);
                                  }}
                                  compact
                                />
                                <ActionBtn
                                  icon={<Copy className="h-4 w-4" />}
                                  label="Copy link"
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    copyInviteLink(e);
                                  }}
                                  compact
                                />
                              </>
                            );
                          }
                          if (status === "none" || !status) {
                            if (e.email) {
                              return (
                                <ActionBtn
                                  icon={<Send className="h-4 w-4" />}
                                  label="Invite"
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    sendInviteFor(e);
                                  }}
                                  compact
                                />
                              );
                            }
                            return (
                              <span
                                className="text-[12px] italic"
                                style={{ color: "rgba(245,246,248,0.45)" }}
                              >
                                Add email to invite
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </motion.li>
                  );
                })}
              </motion.ul>
            )}
          </div>
        </motion.section>
      </div>
    </motion.main>
  );
}

function KpiChip({
  label,
  value,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone?: "neutral" | "good" | "warn";
}) {
  const palette =
    tone === "good"
      ? {
          bg: "rgba(46, 204, 113, 0.10)",
          br: "rgba(46, 204, 113, 0.22)",
          tx: "rgba(200, 255, 225, 0.95)",
        }
      : tone === "warn"
      ? {
          bg: "rgba(255, 193, 7, 0.10)",
          br: "rgba(255, 193, 7, 0.22)",
          tx: "rgba(255, 235, 180, 0.95)",
        }
      : {
          bg: "rgba(207,174,93,0.10)",
          br: "rgba(207,174,93,0.22)",
          tx: "rgba(207,174,93,0.95)",
        };

  return (
    <div
      className="inline-flex items-center gap-2  px-3 py-1"
      style={{
        color: palette.tx,
      }}
    >
      <span className="opacity-90">{icon}</span>
      <span className="text-[12px]">{label}</span>
      <span className="text-[12px] font-semibold text-white/90">
        <CountUp start={0} end={value} duration={0.75} />
      </span>
    </div>
  );
}

function InvitePill({ status }: { status: string }) {
  const s = String(status || "none");

  const base =
    "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase";

  if (s === "pending") {
    return (
      <span
        className={base}
        style={{
          borderColor: "rgba(255,193,7,0.22)",
          backgroundColor: "rgba(255,193,7,0.10)",
          color: "rgba(255,235,180,0.95)",
        }}
      >
        <Clock className="h-3 w-3" />
        Pending
      </span>
    );
  }
  if (s === "accepted") {
    return (
      <span
        className={base}
        style={{
          borderColor: "rgba(46,204,113,0.22)",
          backgroundColor: "rgba(46,204,113,0.10)",
          color: "rgba(200,255,225,0.95)",
        }}
      >
        <BadgeCheck className="h-3 w-3" />
        Accepted
      </span>
    );
  }
  if (s === "revoked") {
    return (
      <span
        className={base}
        style={{
          borderColor: "rgba(255,120,120,0.22)",
          backgroundColor: "rgba(255,120,120,0.10)",
          color: "rgba(255,170,170,0.95)",
        }}
      >
        <BadgeX className="h-3 w-3" />
        Revoked
      </span>
    );
  }
  if (s === "expired") {
    return (
      <span
        className={base}
        style={{
          borderColor: "rgba(255,255,255,0.14)",
          backgroundColor: "rgba(255,255,255,0.06)",
          color: "rgba(245,246,248,0.70)",
        }}
      >
        <BadgeAlert className="h-3 w-3" />
        Expired
      </span>
    );
  }

  return (
    <span
      className={base}
      style={{
        borderColor: "rgba(255,255,255,0.14)",
        backgroundColor: "rgba(255,255,255,0.06)",
        color: "rgba(245,246,248,0.70)",
      }}
    >
      <BadgeAlert className="h-3 w-3" />
      No Invite
    </span>
  );
}

function ActionBtn({
  icon,
  label,
  onClick,
  compact,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: (ev: React.MouseEvent<HTMLButtonElement>) => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "inline-flex items-center gap-2 rounded-xl border transition",
        compact ? "px-3 py-2 text-[12px]" : "px-3 py-2 text-[12px]"
      )}
      style={{
        borderColor: "rgba(255,255,255,0.10)",
        backgroundColor: "rgba(31,36,48,0.35)",
        color: "rgba(245,246,248,0.82)",
      }}
    >
      <span style={{ color: "rgba(207,174,93,0.90)" }}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function normalizeEmployeeAddress(
  a: Employee["address"]
): EmployeeAddress | null {
  if (!a) return null;
  if (typeof a === "string") {
    return { fullLine: a, line1: a };
  }
  return a as EmployeeAddress;
}

/**
 * ✅ Styled dropdown copied from JobsPage SortMenu behavior,
 * but adapted for Employee roles.
 *
 * - Same animation/blur
 * - Same click-outside + escape handling
 * - Same gold-selected row styling
 */
function RoleMenu({
  value,
  onChange,
}: {
  value: EmployeeRole;
  onChange: (v: EmployeeRole) => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const options: Array<{
    value: EmployeeRole;
    label: string;
    hint: string;
  }> = [
    { value: "roofer", label: "Roofer", hint: "Standard crew member" },
    { value: "foreman", label: "Foreman", hint: "Leads crews & jobs" },
    {
      value: "technician",
      label: "Technician",
      hint: "Specialty work / repairs",
    },
    { value: "laborer", label: "Laborer", hint: "General support labor" },
    { value: "office", label: "Office", hint: "Admin / coordination" },
    { value: "other", label: "Other", hint: "Custom role" },
  ];

  const active = options.find((o) => o.value === value) ?? options[0];

  // close on click outside
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!open) return;
      const t = e.target as Node | null;
      if (!t) return;
      if (btnRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  // close on escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className={cx("relative", open && "z-[200]")}>
      <motion.button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((s) => !s)}
        whileTap={{ scale: 0.98 }}
        className="group w-full inline-flex items-center justify-between gap-2  focus:ring-1  px-3 py-2.5 text-sm font-semibold outline-none transition bg-[var(--color-card)]"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="truncate">{active.label}</span>

        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.18, ease }}
          className="text-white/60 shrink-0"
          aria-hidden="true"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
              clipRule="evenodd"
            />
          </svg>
        </motion.span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: 8, scale: 0.985, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 10, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 8, scale: 0.985, filter: "blur(6px)" }}
            transition={{ duration: 0.18, ease }}
            className="absolute left-0 right-0 z-[210] mt-2 overflow-hidden  pointer-events-auto bg-[var(--color-card)]"
            role="menu"
          >
            <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-white/45">
              Select role
            </div>

            <div className="pb-2">
              {options.map((opt) => {
                const selected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left transition hover:bg-[var(--color-card-hover)] ${
                      selected ? "bg-[var(--color-primary)]/10" : "transparent"
                    }`}
                    role="menuitem"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div
                          className="text-xs font-semibold"
                          style={{
                            color: selected
                              ? "rgba(207,174,93,0.95)"
                              : "rgba(245,246,248,0.88)",
                          }}
                        >
                          {opt.label}
                        </div>
                        <div className="mt-0.5 text-[11px] text-white/45">
                          {opt.hint}
                        </div>
                      </div>

                      {selected && (
                        <span
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full border"
                          style={{
                            borderColor: "rgba(207,174,93,0.45)",
                            backgroundColor: "rgba(207,174,93,0.12)",
                            color: "rgba(207,174,93,0.95)",
                          }}
                          aria-hidden="true"
                        >
                          ✓
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
