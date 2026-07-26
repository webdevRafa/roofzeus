import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus } from "lucide-react";
import {
  Eyebrow,
  FinalCta,
  TrialActions,
} from "../components/marketing/MarketingPrimitives";

const faqs = [
  {
    question: "Who is Roof Zeus built for?",
    answer:
      "Roof Zeus is designed specifically for roofing contractors—from owners starting their first crew to growing companies that need a clearer way to run jobs, people, money, and documents.",
  },
  {
    question: "Is the trial really free? Do I need a card?",
    answer:
      "The trial is free for 30 days and no card is required. You get full access during the trial. Add payment details only if you decide to continue.",
  },
  {
    question: "What can my crew see and update?",
    answer:
      "Crew members focus on the jobs assigned to them. They can review the work, add notes and photos, and access their own pay stubs without seeing the owner's full company financial picture.",
  },
  {
    question: "How does production scheduling work?",
    answer:
      "Roof Zeus tracks the stages roofing companies actually use, including dry-in, shingles, and punch. You can see what is scheduled, what is complete, and what needs the next move.",
  },
  {
    question: "Can I track materials, payouts, and profit per job?",
    answer:
      "Yes. Each job can hold its pricing, material expenses, crew payouts, and other records so you can understand the job's actual cost and net profit.",
  },
  {
    question: "Does Roof Zeus create pay stubs and invoices?",
    answer:
      "Yes. Roof Zeus supports payout history and professional pay stubs, invoices, warranty reports, and job reports so records are easier to create and revisit.",
  },
  {
    question: "Can crews add photos from the field?",
    answer:
      "Yes. Team members can capture photos and notes from the job workflow, keeping the update attached to the right property instead of buried in a camera roll or text thread.",
  },
  {
    question: "Is each company's data kept separate?",
    answer:
      "Yes. Workspaces are scoped by organization membership. Roles determine which parts of the workspace a person can access, helping keep company and crew data separated appropriately.",
  },
  {
    question: "Does Roof Zeus work on mobile?",
    answer:
      "Yes. The experience supports field-friendly updates and quick job checks on mobile, while desktop gives owners more room for reporting, payouts, documents, and administration.",
  },
  {
    question: "Can I cancel at any time?",
    answer:
      "Yes. You can cancel whenever you choose. During a paid period, access generally continues through the end of that billing period.",
  },
];

export default function FaqPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <main className="rz-page">
      <section className="rz-container rz-page-section">
        <div className="rz-faq-layout">
          <aside className="rz-faq-layout__aside">
            <Eyebrow>Frequently asked</Eyebrow>
            <h1>Clear answers before you start.</h1>
            <p>
              Learn how the free trial, crew access, roofing schedule, financial
              tracking, and subscription work.
            </p>
            <TrialActions
              secondaryTo="/pricing"
              secondaryLabel="View pricing"
            />
          </aside>

          <div className="rz-faq-list">
            {faqs.map((faq, index) => {
              const open = openIndex === index;
              const answerId = `faq-answer-${index}`;
              return (
                <article className="rz-faq-item" key={faq.question}>
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={answerId}
                    onClick={() => setOpenIndex(open ? null : index)}
                  >
                    <span>{faq.question}</span>
                    {open ? (
                      <Minus aria-hidden="true" />
                    ) : (
                      <Plus aria-hidden="true" />
                    )}
                  </button>
                  <AnimatePresence initial={false}>
                    {open ? (
                      <motion.div
                        id={answerId}
                        className="rz-faq-item__answer"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div>{faq.answer}</div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </article>
              );
            })}
          </div>
        </div>
      </section>
      <FinalCta
        title="The easiest way to answer the rest is to see it on your jobs."
        copy="Try the complete platform for 30 days with no card required."
      />
    </main>
  );
}
