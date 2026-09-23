import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { campaigns, type LandingVariant } from "./campaigns";

export default function LandingDetails({
  variant,
  demo,
}: {
  variant: LandingVariant;
  demo: boolean;
}) {
  const copy = campaigns[variant];
  const route = (path: string) => `${path}${demo ? "?preview=1" : ""}`;
  return (
    <>
      <section
        className="rz-project-section rz-container"
        aria-labelledby="project-guide"
      >
        <div className="rz-campaign-heading">
          <p className="rz-eyebrow">YOUR HOME. YOUR DECISION.</p>
          <h2 id="project-guide">{copy.title}</h2>
          <p>{copy.explanation}</p>
        </div>
        <div className="rz-project-cards">
          {copy.cards.map(([title, text, href], i) => (
            <article key={title}>
              <span className="rz-card-number">0{i + 1}</span>
              <h3>{title}</h3>
              <p>{text}</p>
              {href &&
                (href.startsWith("#") ? (
                  <a href={href}>
                    Start here <ArrowRight size={16} />
                  </a>
                ) : (
                  <Link to={route(href)}>
                    Explore {i === 0 ? "repairs" : "replacement"}{" "}
                    <ArrowRight size={16} />
                  </Link>
                ))}
            </article>
          ))}
        </div>
      </section>
      <section className="rz-prepare-section">
        <div className="rz-container rz-prepare-grid">
          <div>
            <p className="rz-eyebrow">BEFORE YOU CHOOSE</p>
            <h2>
              A few good questions
              <br />
              go a long way.
            </h2>
            <p>
              Keep these handy when you talk with a contractor. A clear
              conversation now helps you know what to expect later.
            </p>
          </div>
          <ul>
            {copy.checklist.map((text) => (
              <li key={text}>
                <Check size={20} aria-hidden="true" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section
        className="rz-faq-section rz-container"
        aria-labelledby="roof-questions"
      >
        <div className="rz-campaign-heading">
          <p className="rz-eyebrow">LET’S CLEAR A FEW THINGS UP</p>
          <h2 id="roof-questions">Questions on your mind?</h2>
        </div>
        <div className="rz-faq-list">
          {copy.faqs.map(([question, answer]) => (
            <details key={question}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="rz-next-section rz-container">
        <div>
          <p className="rz-eyebrow">ONE STEP AT A TIME</p>
          <h2>
            Start with your home.
            <br />
            Decide from there.
          </h2>
          <p>No obligation to hire. You choose what happens next.</p>
        </div>
        <a href="#estimate-funnel" className="rz-button">
          {demo ? "Preview the form" : "Explore your options"}{" "}
          <ArrowRight size={18} />
        </a>
      </section>
      <nav
        className="rz-project-links rz-container"
        aria-label="Roofing projects"
      >
        {Object.entries(campaigns)
          .filter(([key]) => key !== variant)
          .map(([key, item]) => (
            <Link key={key} to={route(item.path)}>
              {item.name} <ArrowRight size={16} />
            </Link>
          ))}
      </nav>
    </>
  );
}
