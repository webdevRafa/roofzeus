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

export function ProductFrame({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <div className={`rz-product-frame ${className}`}>
      <div className="rz-product-frame__bar" aria-hidden="true">
        <span />
        <span />
        <span />
        <div>app.roofzeus.com</div>
      </div>
      <img src={src} alt={alt} loading="lazy" />
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
