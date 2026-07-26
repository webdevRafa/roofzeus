import type { ReactNode } from "react";
import { Eyebrow } from "./MarketingPrimitives";

export type LegalSection = {
  title: string;
  content: ReactNode;
};

export default function LegalPage({
  eyebrow,
  title,
  summary,
  sections,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  sections: LegalSection[];
}) {
  return (
    <main className="rz-page">
      <section className="rz-container rz-page-section">
        <div className="rz-legal">
          <aside className="rz-legal__aside">
            <Eyebrow>{eyebrow}</Eyebrow>
            <h1>{title}</h1>
            <p>{summary}</p>
          </aside>
          <div className="rz-legal__content">
            {sections.map((section) => (
              <section className="rz-legal-section" key={section.title}>
                <h2>{section.title}</h2>
                <div>{section.content}</div>
              </section>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
