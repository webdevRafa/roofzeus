import { Link } from "react-router-dom";
import { ArrowRight, Download, Check } from "lucide-react";
import { campaigns, creativeConcepts } from "./campaigns";
import { SUPPORT_EMAIL } from "./content";

export default function PartnerPreview() {
  return (
    <div className="rz-partner-page">
      <section className="rz-partner-intro">
        <div className="rz-container">
          <p className="rz-eyebrow">ROOFZEUS · PUBLISHER PREVIEW</p>
          <h1>
            Real roofing projects.
            <br />
            <span>A thoughtful first step.</span>
          </h1>
          <p>
            Owned-and-operated landing pages and original campaign concepts from
            RoofZeus, a brand owned and operated by Devnetiks LLC.
          </p>
          <div className="rz-review-status">
            <span /> Pre-launch · For partner review
          </div>
          <p className="rz-partner-fine">
            These are proposed campaigns, not results from live advertising.
            Consumer delivery is closed. Networx integration, approved consent,
            and launch terms are pending.
          </p>
        </div>
      </section>
      <section className="rz-container rz-project-section">
        <div className="rz-campaign-heading">
          <p className="rz-eyebrow">01 / THE HOMEOWNER EXPERIENCE</p>
          <h2>
            Three reasons to start.
            <br />
            One clear form.
          </h2>
          <p>
            Each page speaks to a different project. Homeowners can review and
            change their project selection before continuing.
          </p>
        </div>
        <div className="rz-review-pages">
          {Object.entries(campaigns).map(([key, item]) => (
            <article key={key}>
              <img
                src={item.image}
                alt="Illustrative residential roofing"
                width={600}
                height={400}
                loading="lazy"
              />
              <div>
                <h3>{item.name}</h3>
                <p>{item.intro}</p>
                <Link to={item.path}>
                  View landing page <ArrowRight size={16} />
                </Link>
                <Link to={`${item.path}?preview=1`}>
                  Try sample-only flow <ArrowRight size={16} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="rz-review-process">
        <div className="rz-container">
          <div className="rz-campaign-heading">
            <p className="rz-eyebrow">02 / BUILT AROUND THE PROJECT</p>
            <h2>
              A useful request starts
              <br />
              with useful details.
            </h2>
          </div>
          <ol>
            {[
              ["Property", "ZIP and address, with editable fields."],
              ["Project", "Repair or replacement, material, and timeframe."],
              [
                "Permission",
                "Homeowner confirmation and a separate contact-permission step when live.",
              ],
              ["Delivery", "Buyer-specific setup and testing before launch."],
            ].map(([title, body]) => (
              <li key={title}>
                <h3>{title}</h3>
                <p>{body}</p>
              </li>
            ))}
          </ol>
          <p className="rz-review-process-note">
            The sample flow does not record TrustedForm sessions, store contact
            details, or deliver leads. Consent-recording infrastructure exists;
            live verification and the buyer’s required wording still need
            review.
          </p>
        </div>
      </section>
      <section
        className="rz-container rz-project-section"
        id="creative-samples"
      >
        <div className="rz-campaign-heading">
          <p className="rz-eyebrow">03 / PROPOSED PAID SOCIAL</p>
          <h2>
            The ad and the page
            <br />
            tell the same story.
          </h2>
          <p>
            Three original concepts for Facebook and Instagram review. No
            insurance promises, invented savings, or claims of completed roofing
            work.
          </p>
          <a
            className="rz-text-link"
            href="/creatives/roofzeus-review-kit.zip"
            download
          >
            <Download size={17} /> Download the creative kit
          </a>
        </div>
        <div className="rz-creative-grid">
          {creativeConcepts.map((item) => (
            <article key={item.id}>
              <img
                src={`/creatives/${item.id}-square.webp`}
                alt={`${item.headline} — proposed RoofZeus ad`}
                width={1080}
                height={1080}
                loading="lazy"
              />
              <div>
                <p className="rz-eyebrow">{item.id} · PROPOSED</p>
                <h3>{item.headline}</h3>
                <p>{item.copy}</p>
                <p className="rz-creative-destination">
                  Destination: {campaigns[item.variant].path}
                </p>
                <div className="rz-creative-downloads">
                  {["square", "feed", "story"].map((format) => (
                    <a
                      key={format}
                      href={`/creatives/${item.id}-${format}.png`}
                      download
                    >
                      {format === "square"
                        ? "1:1"
                        : format === "feed"
                          ? "4:5"
                          : "9:16"}{" "}
                      PNG <Download size={14} />
                    </a>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
        <p className="rz-asset-note">
          Illustrative imagery, including AI-generated roof photographs. Not
          customer projects, testimonials, or evidence of roof condition.
          Placement, copy, geography, and traffic sources require approval
          before advertising begins.
        </p>
      </section>
      <section className="rz-prepare-section">
        <div className="rz-container rz-prepare-grid">
          <div>
            <p className="rz-eyebrow">04 / READY FOR THE CONVERSATION</p>
            <h2>
              A clear starting point
              <br />
              for a partnership.
            </h2>
            <p>
              We’re preparing an initial paid-social launch. There is no
              historical lead volume or campaign performance to report yet.
            </p>
          </div>
          <ul>
            {[
              "Owned-and-operated pages on roofzeus.com",
              "Project and contact validation; duplicate safeguards",
              "Campaign and landing-page attribution support",
              "API transport to be adapted to Networx’s specification",
            ].map((text) => (
              <li key={text}>
                <Check size={20} />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="rz-container rz-next-section">
        <div>
          <p className="rz-eyebrow">LET’S GET THE DETAILS RIGHT</p>
          <h2>
            Have requirements
            <br />
            for us to build around?
          </h2>
          <p>
            We’d welcome your approved wording, buying areas, traffic
            guidelines, and publisher API documentation.
          </p>
        </div>
        <a className="rz-button" href={`mailto:${SUPPORT_EMAIL}`}>
          Contact RoofZeus <ArrowRight size={18} />
        </a>
      </section>
    </div>
  );
}
