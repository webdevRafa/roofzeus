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
      "Roof Zeus is software for roofing contractors who want jobs, finances, workers, and documents in one system.",
  },
  {
    question: "Is the trial really free? Do I need a card?",
    answer:
      "Yes. The complete platform is free for 30 days and no card is required.",
  },
  {
    question: "Do I have to assign jobs to workers?",
    answer:
      "No. Assignments are optional. When you do assign a job, workers only receive access to what they need for the work.",
  },
  {
    question: "What financial information can I track?",
    answer:
      "Track job pricing, material and labor expenses, payouts, revenue, and profit. The Financial page adds charts and date-range breakdowns.",
  },
  {
    question: "How does Roof Zeus help at tax time?",
    answer:
      "Because job income and costs are recorded throughout the year, you can generate cleaner reports for the period your tax work requires.",
  },
  {
    question: "Which documents can I create?",
    answer:
      "Create professional invoices, warranty packets, pay stubs, and financial reports from information already in Roof Zeus.",
  },
  {
    question: "Do invoices and warranties stay with the job?",
    answer:
      "Yes. Invoices and warranty packets remain attached to the job, including historical jobs you reopen later.",
  },
  {
    question: "How are worker payouts handled?",
    answer:
      "A dedicated Payouts page keeps the payment history organized and makes it easy to create pay stubs.",
  },
  {
    question: "Can I cancel at any time?",
    answer:
      "Yes. You can cancel whenever you choose. During a paid period, access generally continues through the end of that billing period.",
  },
];

const reveal = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.12 },
  transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const },
};

export default function FaqPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <main className="rz-page">
      <section className="rz-container rz-page-section">
        <div className="rz-faq-layout">
          <motion.aside className="rz-faq-layout__aside" {...reveal}>
            <Eyebrow>FAQ</Eyebrow>
            <h1>Questions, answered simply.</h1>
            <p>
              The essentials about jobs, money, workers, documents, and pricing.
            </p>
            <TrialActions
              secondaryTo="/pricing"
              secondaryLabel="View pricing"
            />
          </motion.aside>

          <div className="rz-faq-list">
            {faqs.map((faq, index) => {
              const open = openIndex === index;
              const answerId = `faq-answer-${index}`;
              return (
                <motion.article
                  className="rz-faq-item"
                  key={faq.question}
                  {...reveal}
                >
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
                </motion.article>
              );
            })}
          </div>
        </div>
      </section>
      <FinalCta
        title="The best answer is your first job."
        copy="Try the complete platform free for 30 days."
      />
    </main>
  );
}
