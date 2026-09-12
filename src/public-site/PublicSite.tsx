import { useEffect, useRef, useState } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router-dom";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  ClipboardCheck,
  CloudLightning,
  House,
  MapPin,
  Menu,
  ShieldCheck,
  Wrench,
  X,
} from "lucide-react";
import { faqs, guides, pages, services, SITE_URL } from "./content";
import { contractorUrl } from "./integrations";
import { structuredData } from "./seo";
import { LocationInsight, ZipStart } from "./Widgets";
import RequestForm, { PartnerForm } from "./RequestForm";
import "./public.css";

const icons = {
  repair: Wrench,
  home: House,
  storm: CloudLightning,
  inspect: ClipboardCheck,
};
function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <Link to="/" className="rz-brand" aria-label="RoofZeus home">
      <img
        src={`/brand/roof-zeus-logo-${dark ? "dark" : "light"}.webp?v=6`}
        alt="RoofZeus"
        width={800}
        height={192}
      />
    </Link>
  );
}
function Header() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);
  return (
    <>
      <div className="rz-topline">
        <div className="rz-container">
          <span>A clearer way to care for the roof over your head.</span>
          <Link to="/for-contractors">
            For roofing professionals <ArrowUpRight size={13} />
          </Link>
        </div>
      </div>
      <header className="rz-header">
        <div className="rz-container rz-nav-row">
          <Brand />
          <nav className="rz-desktop-nav" aria-label="Main navigation">
            <NavLink to="/how-it-works">How it works</NavLink>
            <NavLink to="/services">Roofing services</NavLink>
            <NavLink to="/guides">Homeowner guides</NavLink>
          </nav>
          <Link className="rz-button rz-nav-cta" to="/find-a-roofer">
            Start your project <ArrowUpRight size={17} />
          </Link>
          <button
            ref={toggle}
            className="rz-menu-toggle"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close navigation" : "Open navigation"}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
        {open && (
          <nav
            id="mobile-nav"
            className="rz-mobile-nav"
            aria-label="Mobile navigation"
          >
            {[
              ["/how-it-works", "How it works"],
              ["/services", "Roofing services"],
              ["/guides", "Homeowner guides"],
              ["/locations", "Locations"],
              ["/for-contractors", "For contractors"],
              ["/find-a-roofer", "Start your project"],
            ].map(([url, text]) => (
              <Link key={url} to={url}>
                {text}
                <ArrowUpRight size={18} />
              </Link>
            ))}
          </nav>
        )}
      </header>
    </>
  );
}
function Footer() {
  return (
    <footer className="rz-footer">
      <div className="rz-container">
        <div className="rz-footer-grid">
          <div>
            <Brand dark />
            <p>
              A clearer path from roofing questions
              <br />
              to your next conversation.
            </p>
            <span className="rz-footer-caption">BUILT AROUND YOUR HOME.</span>
          </div>
          <div>
            <h2>For homeowners</h2>
            <Link to="/find-a-roofer">Start a roofing request</Link>
            <Link to="/how-it-works">How it works</Link>
            <Link to="/services">Roofing services</Link>
            <Link to="/locations">Our growing network</Link>
          </div>
          <div>
            <h2>A little guidance</h2>
            <Link to="/guides">Homeowner guides</Link>
            <Link to="/faq">Common questions</Link>
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/terms">Terms of Use</Link>
          </div>
          <div>
            <h2>For professionals</h2>
            <Link to="/for-contractors">Join the network</Link>
            <Link to="/for-contractors#software">Contractor software</Link>
            <a href={contractorUrl()}>
              Contractor log in <ArrowUpRight size={14} />
            </a>
          </div>
        </div>
        <div className="rz-footer-bottom">
          <span>© {new Date().getFullYear()} RoofZeus</span>
          <p>
            RoofZeus is a request and introduction service, not a roofing
            contractor. Contractor availability is not guaranteed.
          </p>
        </div>
      </div>
    </footer>
  );
}
function Metadata() {
  const { pathname } = useLocation();
  useEffect(() => {
    const path = pathname.replace(/\/$/, "") || "/";
    const meta = pages.find((p) => p.path === path) || pages[pages.length - 1];
    document.title = meta.title;
    const setMeta = (
      selector: string,
      key: string,
      name: string,
      value: string,
    ) => {
      let el = document.head.querySelector(selector);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(key, name);
        document.head.append(el);
      }
      el.setAttribute("content", value);
    };
    setMeta(
      'meta[name="description"]',
      "name",
      "description",
      meta.description,
    );
    setMeta(
      'meta[name="robots"]',
      "name",
      "robots",
      meta.index === false ? "noindex,follow" : "index,follow",
    );
    for (const [name, value] of [
      ["og:title", meta.title],
      ["og:description", meta.description],
      ["og:url", `${SITE_URL}${meta.path}`],
    ])
      setMeta(`meta[property="${name}"]`, "property", name, value);
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.append(canonical);
    }
    canonical.setAttribute("href", `${SITE_URL}${meta.path}`);
    document
      .querySelectorAll('script[type="application/ld+json"]')
      .forEach((el) => el.remove());
    const schema = document.createElement("script");
    schema.type = "application/ld+json";
    schema.textContent = JSON.stringify(structuredData(meta));
    document.head.append(schema);
    if (!window.location.hash) window.scrollTo(0, 0);
    else
      requestAnimationFrame(() =>
        document
          .getElementById(window.location.hash.slice(1))
          ?.scrollIntoView(),
      );
  }, [pathname]);
  return null;
}
function ServiceCards() {
  return (
    <div className="rz-service-grid">
      {services.map((s, i) => {
        const Icon = icons[s.icon];
        return (
          <Link
            className="rz-service-card"
            to={`/services/${s.slug}`}
            key={s.slug}
          >
            <span className="rz-card-top">
              <Icon size={30} strokeWidth={1.4} />
              <span>0{i + 1}</span>
            </span>
            <h3>{s.name}</h3>
            <p>{s.short}</p>
            <ArrowUpRight className="rz-card-arrow" size={21} />
          </Link>
        );
      })}
    </div>
  );
}
function Process({ standalone = false }: { standalone?: boolean }) {
  return (
    <section
      className={`rz-process ${standalone ? "standalone" : ""}`}
      id="how-it-works"
    >
      <div className="rz-container">
        <div className="rz-section-heading">
          <div>
            <p className="rz-eyebrow">A SIMPLE WAY FORWARD</p>
            <h2>
              Less guesswork.
              <br />
              <em>More clarity.</em>
            </h2>
          </div>
          <p>
            A roof is a big part of your home.
            <br />
            Getting started shouldn’t feel complicated.
          </p>
        </div>
        <div className="rz-process-grid">
          {[
            [
              "Tell us about your roof.",
              "Share your location, what you need, and when you would like to get started. It’s okay if you’re not sure yet.",
            ],
            [
              "We review your request.",
              "RoofZeus checks your project details and whether an introduction is possible in your area.",
            ],
            [
              "Choose your next step.",
              "We ask before sharing your details with a named contractor. You discuss the work and decide whether to move forward.",
            ],
          ].map(([title, body], i) => (
            <article key={title}>
              <div className="rz-step-number">
                0{i + 1}
                <span />
              </div>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
        <div className="rz-process-foot">
          <ShieldCheck size={20} />
          <span>
            Free to request. No obligation to hire. Your decision, always.
          </span>
          <Link to="/find-a-roofer">
            Start your project <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </section>
  );
}
function GuideCards() {
  return (
    <div className="rz-guide-grid">
      {guides.map((g, i) => (
        <Link key={g.slug} to={`/guides/${g.slug}`} className="rz-guide-card">
          <div className={`rz-guide-art art-${i}`} aria-hidden="true">
            {i === 0 ? (
              <House />
            ) : i === 1 ? (
              <ShieldCheck />
            ) : (
              <ClipboardCheck />
            )}
            <span>
              THE HOMEOWNER
              <br />
              FIELD NOTES
            </span>
            <b>0{i + 1}</b>
          </div>
          <p className="rz-eyebrow">{g.category}</p>
          <h3>{g.title}</h3>
          <span className="rz-guide-read">
            {g.read}
            <ArrowUpRight size={18} />
          </span>
        </Link>
      ))}
    </div>
  );
}
function FAQs({ limit }: { limit?: number }) {
  return (
    <div className="rz-faq-list">
      {faqs.slice(0, limit).map(([q, a]) => (
        <details key={q}>
          <summary>
            {q}
            <ChevronDown size={20} />
          </summary>
          <p>{a}</p>
        </details>
      ))}
    </div>
  );
}
function FinalCTA() {
  return (
    <section className="rz-final">
      <div className="rz-container">
        <p className="rz-eyebrow">LET’S START WITH YOUR HOME</p>
        <h2>
          Your roof deserves
          <br />
          <em>a little attention.</em>
        </h2>
        <p>Tell us what you have in mind. We’ll help you take the next step.</p>
        <ZipStart compact />
        <span className="rz-fine">Free to submit · No obligation to hire</span>
      </div>
    </section>
  );
}
function Home() {
  return (
    <>
      <section className="rz-hero rz-container">
        <div className="rz-hero-copy">
          <p className="rz-eyebrow">
            <span /> FOR THE PLACE YOU CALL HOME
          </p>
          <h1>
            A better roof
            <br />
            starts with a<br />
            <em>clear next step.</em>
          </h1>
          <p className="rz-hero-description">
            From a small repair to a fresh start. Tell us about your roof, and
            we’ll help you explore what comes next.
          </p>
          <ZipStart />
          <div className="rz-hero-checks">
            <span>
              <Check size={15} /> Free to request
            </span>
            <span>
              <Check size={15} /> No obligation to hire
            </span>
          </div>
        </div>
        <div className="rz-hero-visual">
          <img
            src="/images/roof-home.webp"
            srcSet="/images/roof-home-small.webp 800w, /images/roof-home.webp 1400w"
            sizes="(max-width: 800px) 100vw, 52vw"
            alt="Illustration of a welcoming limestone home with a charcoal shingle roof"
            width={1400}
            height={933}
            fetchPriority="high"
          />
          <div className="rz-image-tag">
            <span className="rz-tag-icon">
              <House size={22} />
            </span>
            <div>
              <strong>More than a roof.</strong>
              <span>It’s what’s underneath that matters.</span>
            </div>
          </div>
          <span className="rz-hero-side-note">
            A STRONGER START, FROM THE TOP DOWN.
          </span>
        </div>
      </section>
      <div className="rz-container">
        <LocationInsight />
        <div className="rz-intro-strip">
          <span>REPAIR. REPLACE. RETHINK.</span>
          <p>
            Whatever brought you here,
            <br className="rz-mobile-break" /> you don’t have to have it all
            figured out.
          </p>
          <a href="#roofing-services" aria-label="Explore roofing services">
            <ArrowDown size={23} />
          </a>
        </div>
      </div>
      <section className="rz-section rz-container" id="roofing-services">
        <div className="rz-section-heading">
          <div>
            <p className="rz-eyebrow">WHAT’S ON YOUR MIND?</p>
            <h2>
              Every roof has a story.
              <br />
              <em>Where are you in yours?</em>
            </h2>
          </div>
          <Link className="rz-text-link" to="/services">
            Explore roofing services <ArrowUpRight size={18} />
          </Link>
        </div>
        <ServiceCards />
        <p className="rz-small-note">
          Not sure what you need?{" "}
          <Link to="/find-a-roofer">
            Start with what you’ve noticed <ArrowRight size={14} />
          </Link>
        </p>
      </section>
      <Process />
      <section className="rz-section rz-container rz-coverage">
        <div className="rz-coverage-art">
          <div className="rz-map-grid" />
          <div className="rz-orbit orbit-one" />
          <div className="rz-orbit orbit-two" />
          <div className="rz-map-pin">
            <MapPin size={30} fill="currentColor" />
          </div>
          <div className="rz-map-label">
            <span className="rz-status-dot" /> OUR FIRST CHAPTER
            <strong>San Antonio, Texas</strong>
            <span>Local roots. Room to grow.</span>
          </div>
          <span className="rz-map-caption">
            BUILDING CONNECTIONS, COMMUNITY BY COMMUNITY.
          </span>
        </div>
        <div>
          <p className="rz-eyebrow">LOCAL STARTS HERE</p>
          <h2>
            A growing network.
            <br />
            <em>An honest beginning.</em>
          </h2>
          <p>
            We’re starting in San Antonio and building from there. Wherever you
            call home in the U.S., you can tell us about your project.
          </p>
          <p>
            We’ll review your request and check what’s possible locally. Our
            network is new, so a contractor introduction isn’t guaranteed.
          </p>
          <Link className="rz-text-link" to="/locations">
            See where we’re growing <ArrowUpRight size={18} />
          </Link>
        </div>
      </section>
      <section className="rz-guides-section">
        <div className="rz-container">
          <div className="rz-section-heading">
            <div>
              <p className="rz-eyebrow">A LITTLE KNOWLEDGE GOES A LONG WAY</p>
              <h2>
                Feel more at home
                <br />
                <em>with your next decision.</em>
              </h2>
            </div>
            <Link className="rz-text-link" to="/guides">
              All homeowner guides <ArrowUpRight size={18} />
            </Link>
          </div>
          <GuideCards />
        </div>
      </section>
      <section className="rz-section rz-container rz-faq-section">
        <div>
          <p className="rz-eyebrow">GOOD QUESTIONS. CLEAR ANSWERS.</p>
          <h2>
            Before you
            <br />
            <em>get started.</em>
          </h2>
          <Link className="rz-text-link" to="/faq">
            More questions, answered <ArrowUpRight size={18} />
          </Link>
        </div>
        <FAQs limit={4} />
      </section>
      <FinalCTA />
      <div className="rz-contractor-strip rz-container">
        <Wrench size={24} />
        <div>
          <strong>You build great roofs. Let’s build a connection.</strong>
          <p>We’re looking for roofing professionals as our network grows.</p>
        </div>
        <Link to="/for-contractors" className="rz-text-link">
          For contractors <ArrowUpRight size={18} />
        </Link>
      </div>
    </>
  );
}
function PageIntro({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <section className="rz-page-intro rz-container">
      <p className="rz-eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{text}</p>
    </section>
  );
}
function ServicePage() {
  const { slug } = useParams();
  const s = services.find((s) => s.slug === slug);
  if (!s) return <NotFound />;
  const Icon = icons[s.icon];
  return (
    <>
      <PageIntro
        eyebrow="ROOFING SERVICES"
        title={s.name}
        text={s.description}
      />
      <section className="rz-container rz-detail-layout">
        <article className="rz-prose">
          <Icon size={42} strokeWidth={1.2} />
          <h2>A little preparation makes a difference.</h2>
          <p>{s.detail}</p>
          <h2>What to share in your request</h2>
          <ul>
            {s.questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
          <h2>What happens next?</h2>
          <p>
            RoofZeus reviews your project and checks whether a contractor
            introduction is possible. We ask before sharing your details with a
            named contractor. Any assessment, quote, or work is agreed directly
            with the independent contractor you choose.
          </p>
          <p>
            Availability is limited while our network grows. We do not guarantee
            an introduction, price, or response time.
          </p>
          <Link to="/guides/choosing-a-roofer" className="rz-text-link">
            Questions to ask a contractor <ArrowRight size={17} />
          </Link>
        </article>
        <aside className="rz-side-cta">
          <p className="rz-eyebrow">LET’S START HERE</p>
          <h2>
            Tell us what
            <br />
            you have in mind.
          </h2>
          <p>Share your project details for a local availability review.</p>
          <Link className="rz-button" to={`/find-a-roofer?service=${s.slug}`}>
            Start a request <ArrowRight size={18} />
          </Link>
          <small>Free to submit. No obligation to hire.</small>
        </aside>
      </section>
      <section className="rz-section rz-container">
        <h2>Other ways we can help</h2>
        <ServiceCards />
      </section>
    </>
  );
}
function GuidePage() {
  const { slug } = useParams();
  const g = guides.find((g) => g.slug === slug);
  if (!g) return <NotFound />;
  return (
    <>
      <PageIntro
        eyebrow={`${g.category} · ${g.read}`}
        title={g.title}
        text={g.intro}
      />
      <article className="rz-article rz-container">
        <Link to="/guides" className="rz-text-link">
          ← All homeowner guides
        </Link>
        {g.sections.map(([title, text]) => (
          <section key={title}>
            <h2>{title}</h2>
            <p>{text}</p>
          </section>
        ))}
        <div className="rz-note">
          These guides help you prepare a conversation. Property-specific
          decisions require an assessment by a qualified professional.
        </div>
        <Link to="/find-a-roofer" className="rz-button">
          Tell us about your project <ArrowRight size={18} />
        </Link>
      </article>
    </>
  );
}
function Locations() {
  return (
    <>
      <PageIntro
        eyebrow="LOCAL ROOTS. ROOM TO GROW."
        title="Good connections start somewhere."
        text="San Antonio is our first pilot market. We welcome project requests from across the U.S. as we work to build local contractor relationships."
      />
      <section className="rz-container rz-detail-layout">
        <article className="rz-market-card">
          <span className="rz-pill">PILOT MARKET</span>
          <MapPin size={40} />
          <h2>San Antonio, Texas</h2>
          <p>
            Our starting point. Explore local planning resources and submit your
            roofing project for review. A contractor introduction is subject to
            availability.
          </p>
          <Link className="rz-text-link" to="/roofers/tx/san-antonio">
            Explore San Antonio <ArrowUpRight size={18} />
          </Link>
        </article>
        <div className="rz-prose">
          <h2>Somewhere else?</h2>
          <p>
            You can still submit a request. We’ll review your details and let
            you know whether an introduction is possible. We do not advertise a
            nationwide contractor network we haven’t built yet.
          </p>
          <ZipStart />
          <p>
            Are you a contractor?{" "}
            <Link to="/for-contractors">Help us grow in your area.</Link>
          </p>
        </div>
      </section>
    </>
  );
}
function SanAntonio() {
  return (
    <>
      <PageIntro
        eyebrow="TEXAS / SAN ANTONIO · PILOT MARKET"
        title="A clearer start for your San Antonio roof."
        text="From a repair to a replacement, start with your property, your priorities, and a few local resources. Contractor availability is confirmed after your request is reviewed."
      />
      <section className="rz-container rz-detail-layout">
        <article className="rz-prose">
          <h2>Start with the property’s jurisdiction.</h2>
          <p>
            A San Antonio mailing address does not by itself tell you which
            permitting authority applies to your property. Confirm the address
            and project scope with the appropriate local department before work
            begins.
          </p>
          <h2>Useful local starting points</h2>
          <p>
            <a
              href="https://www.sa.gov/Directory/Departments/DSD"
              target="_blank"
              rel="noreferrer"
            >
              San Antonio Development Services ↗
            </a>
            <br />
            Use the city’s official department for current permitting
            information and project questions.
          </p>
          <p>
            <a
              href="https://www.weather.gov/ewx/"
              target="_blank"
              rel="noreferrer"
            >
              National Weather Service Austin / San Antonio ↗
            </a>
            <br />
            Check official current weather information directly. This page does
            not display live storm or damage reports.
          </p>
          <h2>Give the next conversation some context.</h2>
          <p>
            Include the type of roofing if you know it, previous repairs, and
            when you first noticed a concern. For a storm-related request, share
            your own observations and dates without assuming the cause or
            insurance coverage.
          </p>
          <h2>Our first market, still growing.</h2>
          <p>
            We’re developing contractor relationships in San Antonio. A project
            request goes into review; it does not mean a roofer has been
            assigned. We will ask for your permission before introducing a named
            contractor.
          </p>
        </article>
        <aside className="rz-side-cta">
          <p className="rz-eyebrow">SAN ANTONIO, TX</p>
          <h2>
            Your project
            <br />
            starts here.
          </h2>
          <ZipStart />
        </aside>
      </section>
      <section className="rz-section rz-container">
        <ServiceCards />
      </section>
    </>
  );
}
function Contractors() {
  return (
    <>
      <PageIntro
        eyebrow="FOR ROOFING PROFESSIONALS"
        title="Good roofs start with good people."
        text="We’re building a network of roofing professionals, starting in San Antonio. Tell us about your business and the communities you serve."
      />
      <section className="rz-container rz-detail-layout" id="join">
        <div className="rz-prose">
          <h2>Let’s build this together.</h2>
          <p>
            Register your interest in future homeowner introductions. We will
            review service areas, business details, and project fit before
            discussing participation.
          </p>
          <ul>
            <li>Tell us the ZIP codes you actually serve.</li>
            <li>Discuss the project types your team handles.</li>
            <li>Agree on lead terms before any paid participation.</li>
          </ul>
          <div className="rz-note">
            No subscription or payment is required to register interest.
            Registration does not approve your business, reserve a territory, or
            guarantee leads.
          </div>
        </div>
        <div className="rz-form-card">
          <h2>Join the conversation.</h2>
          <PartnerForm />
        </div>
      </section>
      <section className="rz-software rz-container" id="software">
        <div>
          <p className="rz-eyebrow">ALREADY RUNNING A ROOFING BUSINESS?</p>
          <h2>
            The tools behind
            <br />
            <em>the work are still here.</em>
          </h2>
          <p>
            Keep jobs, expenses, crews, invoices, and project documents
            organized in the RoofZeus contractor app.
          </p>
          <div className="rz-button-row">
            <a className="rz-button" href={contractorUrl()}>
              Open contractor app <ArrowUpRight size={18} />
            </a>
            <a className="rz-text-link" href={contractorUrl("/signup")}>
              Create an account <ArrowRight size={18} />
            </a>
          </div>
        </div>
        <div className="rz-software-note">
          <ClipboardCheck size={42} />
          <span>JOBS · PEOPLE · MONEY</span>
          <h3>
            Your business.
            <br />
            All in one place.
          </h3>
          <p>
            The contractor app is separate from homeowner requests and network
            registration.
          </p>
        </div>
      </section>
    </>
  );
}
function Legal({ terms = false }: { terms?: boolean }) {
  return (
    <>
      <PageIntro
        eyebrow="CLEAR FROM THE START · SEPTEMBER 12, 2026"
        title={
          terms ? "How this service works." : "Your home. Your information."
        }
        text={
          terms
            ? "Terms for the public RoofZeus request and contractor-interest service."
            : "Privacy information for the public RoofZeus request and contractor-interest service."
        }
      />
      <article className="rz-article rz-container rz-prose">
        {terms ? (
          <>
            <h2>Our role</h2>
            <p>
              RoofZeus is a roofing request and introduction service, not a
              roofing contractor, insurer, or emergency dispatch service. We do
              not perform roofing work, provide binding quotes, determine
              insurance coverage, or guarantee contractor availability or
              response times.
            </p>
            <h2>Your request</h2>
            <p>
              Submit accurate details and request work only for property you own
              or are authorized to represent. Submitting a request is free and
              creates no obligation to hire. A request is received only after
              the site displays a confirmation reference.
            </p>
            <h2>Independent contractors</h2>
            <p>
              We ask for your agreement before sharing information with a named
              contractor. You are responsible for evaluating the business,
              confirming applicable credentials and insurance, and agreeing
              directly on scope, fees, scheduling, and warranties. Any contract
              for work is between you and that contractor.
            </p>
            <h2>Network registration</h2>
            <p>
              Contractor registration expresses interest only. It does not
              approve a business, guarantee leads, or create an exclusive
              territory. Any paid lead arrangement requires a separate
              agreement. RoofZeus may be compensated by participating
              contractors when a future introduction is made; homeowners are not
              charged to submit a request.
            </p>
            <h2>Questions</h2>
            <p>
              For questions about these terms or a request, contact{" "}
              <a href="mailto:privacy@roofzeus.com">privacy@roofzeus.com</a>.
              The contractor app has its own account and service terms.
            </p>
          </>
        ) : (
          <>
            <h2>What we collect</h2>
            <p>
              Homeowner requests include project details, property address, ZIP
              code, contact information, contact preference, and the permission
              you provide. Contractor interest forms include business details,
              service ZIP codes, and contact information. We also retain
              submission timestamps, request references, and consent records.
            </p>
            <h2>How we use it</h2>
            <p>
              We use this information to review requests, check possible local
              availability, follow up, and prevent abuse. We store an
              irreversible daily hash of the requesting IP address for rate
              limiting, rather than putting the raw IP address in the lead
              record. Infrastructure providers may separately process network
              information for security.
            </p>
            <h2>Sharing and contractor introductions</h2>
            <p>
              We use service providers for hosting, private data storage,
              security checks, and optional operational email notifications. We
              do not publish your contact details. Your initial consent permits
              RoofZeus to contact you. Before sending your project to a named
              contractor, we ask for your agreement. A future contractor
              introduction may result in compensation to RoofZeus.
            </p>
            <h2>Location and third-party tools</h2>
            <p>
              The site remembers only a ZIP code on your device when you enter
              it on the homepage. ZIP lookup sends that code to Zippopotam.us.
              If address search is enabled, Google processes what you type into
              its address search field. Cloudflare Turnstile processes security
              signals to help prevent spam. Manual address entry is always
              available. We do not request your device’s precise location
              automatically.
            </p>
            <h2>Retention and choices</h2>
            <p>
              You can ask us to correct or delete your request, withdraw
              permission for future contact or sharing, or ask about your
              information by emailing{" "}
              <a href="mailto:privacy@roofzeus.com">privacy@roofzeus.com</a>.
              Include your request reference if you have it. Some records may
              need to be retained for security or to document previously
              completed transactions. Clearing browser storage removes the
              remembered ZIP code.
            </p>
            <h2>Analytics and the contractor app</h2>
            <p>
              This version does not load advertising trackers or transmit form
              details to analytics. The contractor app uses separate account and
              business data flows. These public-site privacy details apply to
              homeowner requests and network interest registration.
            </p>
          </>
        )}
      </article>
    </>
  );
}
function NotFound() {
  return (
    <div className="rz-confirmation rz-container">
      <p className="rz-eyebrow">404 / A LITTLE OFF COURSE</p>
      <h1>
        Let’s get you
        <br />
        back home.
      </h1>
      <p>We couldn’t find this page.</p>
      <Link to="/" className="rz-button">
        Back to RoofZeus <ArrowRight size={18} />
      </Link>
    </div>
  );
}
function AppRedirect() {
  const location = useLocation();
  useEffect(() => {
    window.location.replace(
      contractorUrl(`${location.pathname}${location.search}${location.hash}`),
    );
  }, [location]);
  return (
    <div className="rz-confirmation">
      <p>Opening the contractor app…</p>
      <a href={contractorUrl(location.pathname + location.search)}>
        Continue to contractor app
      </a>
    </div>
  );
}
export default function PublicSite() {
  return (
    <div className="rz-public">
      <a className="rz-skip" href="#main-content">
        Skip to content
      </a>
      <Metadata />
      <Header />
      <main id="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/find-a-roofer" element={<RequestForm />} />
          <Route
            path="/how-it-works"
            element={
              <>
                <PageIntro
                  eyebrow="YOUR PROJECT, AT YOUR PACE"
                  title="A clear path to the next conversation."
                  text="Share what you need. We review your request, check local availability, and ask before making a contractor introduction."
                />
                <Process standalone />
                <section className="rz-section rz-container">
                  <FAQs />
                </section>
                <FinalCTA />
              </>
            }
          />
          <Route
            path="/services"
            element={
              <>
                <PageIntro
                  eyebrow="START WITH WHAT YOU NEED"
                  title="A little repair. A new beginning. Or just a closer look."
                  text="You don’t have to know all the answers. Choose the closest project type and start with what you’ve noticed."
                />
                <section className="rz-container rz-section-small">
                  <ServiceCards />
                </section>
                <FinalCTA />
              </>
            }
          />
          <Route path="/services/:slug" element={<ServicePage />} />
          <Route path="/locations" element={<Locations />} />
          <Route path="/roofers/tx/san-antonio" element={<SanAntonio />} />
          <Route
            path="/guides"
            element={
              <>
                <PageIntro
                  eyebrow="THE HOMEOWNER FIELD NOTES"
                  title="Know a little more. Feel a lot more ready."
                  text="Practical reading for a decision that matters. No roofing vocabulary required."
                />
                <section className="rz-container rz-section-small">
                  <GuideCards />
                </section>
                <FinalCTA />
              </>
            }
          />
          <Route path="/guides/:slug" element={<GuidePage />} />
          <Route path="/for-contractors" element={<Contractors />} />
          <Route
            path="/faq"
            element={
              <>
                <PageIntro
                  eyebrow="LET’S CLEAR A FEW THINGS UP"
                  title="Good questions deserve clear answers."
                  text="What to expect from your request, how your information is handled, and what happens next."
                />
                <section className="rz-section-small rz-container">
                  <FAQs />
                </section>
              </>
            }
          />
          <Route path="/privacy" element={<Legal />} />
          <Route path="/terms" element={<Legal terms />} />
          {[
            "/login",
            "/signup",
            "/dashboard",
            "/crew",
            "/accept-invite",
            "/complete-signup",
            "/verify-email",
          ].map((path) => (
            <Route key={path} path={path} element={<AppRedirect />} />
          ))}
          {["/pricing", "/features", "/see-it-in-action", "/security"].map(
            (path) => (
              <Route
                key={path}
                path={path}
                element={<Navigate to="/for-contractors#software" replace />}
              />
            ),
          )}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
