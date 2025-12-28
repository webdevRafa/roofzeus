// src/pages/FaqPage.tsx
import { Link } from "react-router-dom";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  Minus,
  Plus,
  ShieldCheck,
} from "lucide-react";

const ease = [0.16, 1, 0.3, 1] as const;

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.06 } },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.7, ease },
  },
};

const cardIn: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.99, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 0.65, ease },
  },
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[#3a3f4b] bg-[#0b0e14]/55 px-2.5 py-1 text-[11px] text-[#cfae5d]/80">
      {children}
    </span>
  );
}

function FaqItem({
  q,
  a,
  defaultOpen = false,
}: {
  q: string;
  a: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl border border-[#3a3f4b] bg-[#1f2430]/55 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 sm:px-5 py-4 flex items-start justify-between gap-4 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <div className="text-sm sm:text-[15px] font-semibold text-[#f5f6f8] leading-snug">
            {q}
          </div>
        </div>

        <div className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition">
          {open ? (
            <Minus className="h-4 w-4 text-white/80" />
          ) : (
            <Plus className="h-4 w-4 text-white/80" />
          )}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease }}
            className="overflow-hidden"
          >
            <div className="px-4 sm:px-5 pb-5 text-sm text-white/65 leading-relaxed">
              {a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FaqPage() {
  const faqs = useMemo(
    () => [
      {
        q: "Is the trial really free — do I need a card?",
        a: (
          <>
            The trial is{" "}
            <span className="text-white/80 font-semibold">14 days</span> with
            full access. No card up front. After the trial, you’ll be prompted
            to add payment details if you want to keep using ROOFZEUS.
          </>
        ),
        defaultOpen: true,
      },
      {
        q: "Who is ROOFZEUS built for?",
        a: (
          <>
            Roofing contractors who want one system to run jobs clean: job
            pages, stage scheduling (dry-in / shingles / punch), crew updates,
            payout tracking, pay stubs, notes/photos, and financial visibility —
            without spreadsheets and scattered texts.
          </>
        ),
      },
      {
        q: "Can my crew use it? What can they see?",
        a: (
          <>
            Yes. Crew accounts are designed to be role-aware. Owners/admins stay
            in control. Crew can be limited to assigned jobs and job updates
            (photos/notes) while keeping sensitive financial details protected.
          </>
        ),
      },
      {
        q: "How does scheduling work?",
        a: (
          <>
            ROOFZEUS is built around roofing stages. You can schedule key phases
            like
            <span className="text-white/80 font-semibold"> dry-in</span>,
            <span className="text-white/80 font-semibold"> shingles</span>, and
            <span className="text-white/80 font-semibold"> punch</span>, so your
            pipeline is visible across jobs and your team knows what’s next.
          </>
        ),
      },
      {
        q: "Can I track materials, expenses, and profit per job?",
        a: (
          <>
            Yes. Each job can store your key inputs (sq ft, rate, fees) plus
            material/expense entries and documentation. The goal is simple:
            clear margins and fewer “rough estimates.”
          </>
        ),
      },
      {
        q: "Do you handle payouts and pay stubs?",
        a: (
          <>
            Yes. ROOFZEUS supports payout tracking and pay stub history so you
            can keep a clean record of who got paid, what it was for, and when.
            This is especially helpful when you need to look back later.
          </>
        ),
      },
      {
        q: "Can I attach photos and notes to jobs?",
        a: (
          <>
            Yes. Photos and notes are first-class and tied to the job — so
            progress documentation stays where it belongs (not buried in
            someone’s camera roll).
          </>
        ),
      },
      {
        q: "Can I run multiple crews or a larger operation?",
        a: (
          <>
            ROOFZEUS is built to support real teams. Whether you’re running a
            small crew or scaling up, the workflow stays the same: organized
            jobs, staged scheduling, and clear payout records.
          </>
        ),
      },
      {
        q: "Is my company’s data separated from other companies?",
        a: (
          <>
            Yes. ROOFZEUS is built as a multi-tenant SaaS with org-scoped
            access. Your workspace is isolated by organization membership so
            your jobs and records don’t mix with anyone else.
          </>
        ),
      },
      {
        q: "Can I cancel any time?",
        a: (
          <>
            Yes. You can cancel whenever you want. If you cancel during a paid
            period, you keep access through the end of that period.
          </>
        ),
      },
      {
        q: "Will this work on mobile?",
        a: (
          <>
            Yes — the experience is designed to work well on mobile for field
            updates (photos/notes) and quick job checks. Desktop is ideal for
            deeper admin work (payouts, stubs, reporting).
          </>
        ),
      },
      {
        q: "Can I export my records?",
        a: (
          <>
            Export and reporting are part of a healthy business system. ROOFZEUS
            is structured so your data stays clean for reporting and future
            export options (PDF/CSV) as the platform expands.
          </>
        ),
      },
    ],
    []
  );

  return (
    <main className="min-h-[calc(100vh-64px)] text-[#f5f6f8] overflow-x-hidden">
      {/* HERO */}
      <section className="max-w-7xl mx-auto px-6 pt-14 pb-10">
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="space-y-6"
        >
          <motion.div
            variants={fadeUp}
            className="flex flex-wrap items-center gap-3"
          >
            <Pill>FAQ</Pill>
            <Pill>14-day trial</Pill>
            <Pill>No card required</Pill>
            <Pill>Cancel anytime</Pill>
          </motion.div>

          <motion.h1
            variants={fadeUp}
            className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.05]"
          >
            Questions contractors actually ask —
            <span className="text-[#cfae5d]"> answered</span>.
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="max-w-2xl text-white/70 leading-relaxed"
          >
            If you’re trying to decide whether ROOFZEUS fits your workflow, this
            is the straight version: what it does, how teams use it, and what to
            expect from the trial.
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="flex flex-col sm:flex-row gap-3"
          >
            <Link
              to="/see-it-in-action"
              className={cx(
                "inline-flex items-center justify-center gap-2 rounded-xl",
                "bg-[#cfae5d] px-5 py-3 text-sm font-semibold text-black",
                "hover:bg-[#cfae5d]/90 transition"
              )}
            >
              Start free trial
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              to="/features"
              className={cx(
                "inline-flex items-center justify-center gap-2 rounded-xl",
                "border border-[#3a3f4b] bg-white/5 px-5 py-3",
                "text-sm font-semibold text-white hover:bg-white/10 transition"
              )}
            >
              View features
            </Link>

            <Link
              to="/security"
              className={cx(
                "inline-flex items-center justify-center gap-2 rounded-xl",
                "border border-[#3a3f4b] bg-[#0b0e14]/35 px-5 py-3",
                "text-sm font-semibold text-white/80 hover:border-[#cfae5d] hover:text-white transition"
              )}
            >
              <ShieldCheck className="h-4 w-4 text-[#cfae5d]" />
              Security & data
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* FAQ LIST */}
      <section className="max-w-7xl mx-auto px-6 pb-14">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
          className="grid gap-3"
        >
          {faqs.map((f) => (
            <motion.div key={f.q} variants={cardIn}>
              <FaqItem q={f.q} a={f.a} defaultOpen={f.defaultOpen} />
            </motion.div>
          ))}
        </motion.div>

        {/* Bottom reassurance */}
        <motion.div
          variants={cardIn}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          className="mt-10 rounded-2xl border border-[#3a3f4b] bg-[#0b0e14]/45 p-6"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5">
              <HelpCircle className="h-5 w-5 text-[#cfae5d]" />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-bold">Still have a question?</div>
              <div className="mt-1 text-sm text-white/65 leading-relaxed">
                Start the trial and put it against your real workflow. You’ll
                know fast whether it’s cleaner than what you’re using now.
              </div>

              <div className="mt-4 flex flex-col sm:flex-row gap-3">
                <Link
                  to="/see-it-in-action"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#cfae5d] px-5 py-3 text-sm font-semibold text-black hover:bg-[#cfae5d]/90 transition"
                >
                  Start free trial
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <Link
                  to="/pricing"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#3a3f4b] bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition"
                >
                  <CheckCircle2 className="h-4 w-4 text-[#cfae5d]" />
                  See pricing
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      </section>
    </main>
  );
}
