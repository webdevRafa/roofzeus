// src/pages/FaqPage.tsx

import { AnimatePresence, motion, type Variants } from "framer-motion";
import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";

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
    <div
      className={` mb-4  overflow-hidden group py-3 ${
        open ? "bg-[#14223b]" : "bg-[#14223b]/50"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 sm:px-5 py-4 flex items-start justify-between gap-4 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0 ">
          <div
            className={`text-md  text-[#fae2a4] leading-snug ${
              open
                ? "text-[#e5c26a]"
                : "text-white/50 group-hover:text-white cursor-pointer"
            }`}
          >
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
            <div className="px-4 sm:px-5 pb-5 text-lg text-white/80 leading-relaxed">
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
        q: "Who is ROOFZEUS built for?",
        a: (
          <>
            ROOFZEUS is designed specifically for roofing contractors — whether
            you're just getting started or already running a growing roofing
            company.
          </>
        ),
        defaultOpen: true,
      },
      {
        q: "Is the trial really free — do I need a card to get started?",
        a: (
          <>
            No card is needed to start. The trial is{" "}
            <span className="text-white/80 font-semibold">30 days</span> with
            full access. After the trial, you’ll be prompted to add payment
            details if you want to continue using ROOFZEUS.
          </>
        ),
      },

      {
        q: "Can my crew use it? What can they see?",
        a: (
          <>
            While adding your crew is optional, crew members can only see jobs
            they have been assigned and are allowed to add notes & photos. Crew
            members will also have access to their own paystubs.{" "}
          </>
        ),
      },
      {
        q: "How does scheduling work?",
        a: (
          <>
            ROOFZEUS provides scheduling for the key phases like
            <span className="text-white/80 font-semibold"> dry-in</span>,
            <span className="text-white/80 font-semibold"> shingles</span>, and
            <span className="text-white/80 font-semibold"> punch</span>, so your
            pipeline is clear and you always know what's next.
          </>
        ),
      },
      {
        q: "Can I track materials, expenses, and profit per job?",
        a: (
          <>
            Yes. ROOFZEUS allows you to track everything about the job such as
            sq's, rate per sq, material expenses, payouts, notes, photos and
            reports.
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
            Yes. You and your crew members are able to attach photos and notes
            to jobs. No need to involve your camera roll. Take photos directly
            from the app.
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
      <section className="max-w-5xl mx-auto px-6 pt-14 pb-10">
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="space-y-6"
        >
          <motion.h1
            variants={fadeUp}
            className="text-3xl  tracking-tight leading-[1.05] mt-20 text-white"
          >
            Frequently asked questions
          </motion.h1>
        </motion.div>
      </section>

      {/* FAQ LIST */}
      <section className="max-w-5xl mx-auto px-6 pb-14">
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
      </section>
    </main>
  );
}
