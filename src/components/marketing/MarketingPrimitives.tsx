import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";

export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="rz-eyebrow">{children}</div>;
}

export function SectionHeading({
  eyebrow,
  title,
  copy,
  align = "left",
}: {
  eyebrow: string;
  title: ReactNode;
  copy?: ReactNode;
  align?: "left" | "center";
}) {
  return (
    <div
      className={`rz-section-heading ${
        align === "center" ? "rz-section-heading--center" : ""
      }`}
    >
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2>{title}</h2>
      {copy ? <p>{copy}</p> : null}
    </div>
  );
}

export function TrialActions({
  secondaryTo = "/see-it-in-action",
  secondaryLabel = "See it in action",
  centered = false,
}: {
  secondaryTo?: string;
  secondaryLabel?: string;
  centered?: boolean;
}) {
  return (
    <div className={`rz-actions ${centered ? "rz-actions--centered" : ""}`}>
      <Link className="rz-button rz-button--primary" to="/signup">
        Start your free trial
        <ArrowRight aria-hidden="true" />
      </Link>
      <Link className="rz-button rz-button--secondary" to={secondaryTo}>
        {secondaryLabel}
      </Link>
    </div>
  );
}

export function OperationsBoard() {
  const metrics = [
    ["Job price", "$18,420"],
    ["Expenses", "$5,180"],
    ["Payouts", "$4,650"],
    ["Profit", "$8,590"],
  ];

  return (
    <div
      className="rz-operations-board"
      aria-label="A conceptual roofing job record with pricing, expenses, payouts, profit, crew, and documents"
    >
      <div className="rz-operations-board__header">
        <span>Job record</span>
        <span className="rz-operations-board__status">
          <i />
          Active
        </span>
      </div>
      <div className="rz-operations-board__body">
        <div className="rz-operations-board__job">
          <span>545 Summer Lane</span>
          <strong>Roof replacement</strong>
        </div>
        <div className="rz-operations-board__metrics">
          {metrics.map(([label, value]) => (
            <div key={label}>
              <small>{label}</small>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <div className="rz-operations-board__links">
          <span>Optional crew assignment</span>
          <span>Invoice ready</span>
          <span>Warranty saved</span>
        </div>
      </div>
      <div className="rz-operations-board__footer">
        Everything stays with the job
        <span>Now and years from now</span>
      </div>
    </div>
  );
}

export function ProfitEquation() {
  return (
    <div
      className="rz-profit-equation"
      aria-label="A conceptual financial report showing revenue, materials, payouts, and tax-ready totals"
    >
      <div className="rz-profit-equation__header">Financial reporting</div>
      <div className="rz-profit-equation__formula">
        <div>
          <span>All jobs</span>
          <strong>Revenue</strong>
        </div>
        <b aria-hidden="true">+</b>
        <div>
          <span>Job costs</span>
          <strong>Materials</strong>
        </div>
        <b aria-hidden="true">+</b>
        <div>
          <span>Crew records</span>
          <strong>Payouts</strong>
        </div>
      </div>
      <div className="rz-profit-equation__result">
        <span>Filter any date range</span>
        <strong>Tax-ready totals</strong>
      </div>
    </div>
  );
}

export function DocumentsBoard() {
  const documents = [
    ["Invoice", "Ready to send"],
    ["Warranty packet", "Saved to job"],
    ["Pay stub", "Linked to payout"],
  ];

  return (
    <div
      className="rz-documents-board"
      aria-label="Invoices, warranty packets, and pay stubs organized with their records"
    >
      <div className="rz-documents-board__header">
        <span>Professional documents</span>
        <span>Ready</span>
      </div>
      <div className="rz-documents-board__body">
        {documents.map(([name, status], index) => (
          <div className="rz-documents-board__row" key={name}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{name}</strong>
            <small>{status}</small>
          </div>
        ))}
      </div>
      <div className="rz-documents-board__footer">
        Clean records without rebuilding the paperwork
      </div>
    </div>
  );
}

export function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="rz-check-list">
      {items.map((item) => (
        <li key={item}>
          <CheckCircle2 aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function FinalCta({
  title = "Put your next job in one clear place.",
  copy = "Try every Roof Zeus feature free for 30 days. No card required.",
}: {
  title?: string;
  copy?: string;
}) {
  return (
    <motion.section
      className="rz-final-cta rz-container"
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="rz-final-cta__inner">
        <div>
          <Eyebrow>Built for the next job</Eyebrow>
          <h2>{title}</h2>
          <p>{copy}</p>
        </div>
        <TrialActions
          secondaryTo="/pricing"
          secondaryLabel="View simple pricing"
        />
      </div>
    </motion.section>
  );
}
