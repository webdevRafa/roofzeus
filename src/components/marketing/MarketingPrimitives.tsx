import type { ReactNode } from "react";
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
  const rows = [
    ["01", "Production", "Roofs moving today", "On track"],
    ["02", "Crew", "Assignments and field updates", "Connected"],
    ["03", "Money", "Costs, payouts, and profit", "Clear"],
    ["04", "Closeout", "Invoices and warranties", "Ready"],
  ];

  return (
    <div
      className="rz-operations-board"
      aria-label="A conceptual overview of an organized roofing operation"
    >
      <div className="rz-operations-board__header">
        <span>Roofing day / organized</span>
        <span className="rz-operations-board__status">
          <i />
          Business in view
        </span>
      </div>
      <div className="rz-operations-board__body">
        {rows.map(([number, label, copy, status]) => (
          <div className="rz-operations-board__row" key={number}>
            <span className="rz-operations-board__number">{number}</span>
            <div>
              <small>{label}</small>
              <strong>{copy}</strong>
            </div>
            <span className="rz-operations-board__tag">{status}</span>
          </div>
        ))}
      </div>
      <div className="rz-operations-board__footer">
        One connected operating rhythm
        <span>From schedule to closeout</span>
      </div>
    </div>
  );
}

export function ProfitEquation() {
  return (
    <div
      className="rz-profit-equation"
      aria-label="Revenue minus crew payouts and materials equals clear job profit"
    >
      <div className="rz-profit-equation__header">
        Know the job before closeout
      </div>
      <div className="rz-profit-equation__formula">
        <div>
          <span>Contract value</span>
          <strong>Revenue</strong>
        </div>
        <b aria-hidden="true">&minus;</b>
        <div>
          <span>Labor</span>
          <strong>Payouts</strong>
        </div>
        <b aria-hidden="true">&minus;</b>
        <div>
          <span>Job costs</span>
          <strong>Materials</strong>
        </div>
      </div>
      <div className="rz-profit-equation__result">
        <span>Equals</span>
        <strong>Clear job profit</strong>
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
  title = "Trade the busywork for a business you can see clearly.",
  copy = "Start with every Roof Zeus feature for 30 days. No card required.",
}: {
  title?: string;
  copy?: string;
}) {
  return (
    <section className="rz-final-cta rz-container">
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
    </section>
  );
}
