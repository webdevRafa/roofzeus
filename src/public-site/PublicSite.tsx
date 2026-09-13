import { useEffect } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { pages, SITE_URL } from "./content";
import { contractorUrl } from "./integrations";
import { structuredData } from "./seo";
import LandingPage from "./LandingPage";
import TrustedFormTest from "./TrustedFormTest";
import { modernizeMode } from "./modernize";
import "./public.css";
import "./landing.css";
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
              {modernizeMode
                ? "If partner matching is enabled, your request is sent to Modernize according to the contact permission shown on the form. Modernize manages its contractor matching. "
                : "We ask for your agreement before sharing information with a named contractor. "}
              You are responsible for evaluating the business, confirming
              applicable credentials and insurance, and agreeing directly on
              scope, fees, scheduling, and warranties. Any contract for work is
              between you and that contractor.
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
            {modernizeMode && (
              <>
                <h2>Referral partners</h2>
                <p>
                  RoofZeus may receive compensation for qualifying referrals to
                  Modernize. A referral does not guarantee the lowest price, an
                  appointment, or an available contractor. Where a link takes
                  you to Modernize, you complete its form under its terms and
                  privacy notice. Following the link is not a RoofZeus form
                  submission.
                </p>
              </>
            )}
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
              availability, follow up, and prevent abuse. We store an keyed
              daily hash of the requesting IP address for rate limiting, rather
              than putting the raw IP address in the lead record. Infrastructure
              providers may separately process network information for security.
            </p>
            <h2>Sharing and contractor introductions</h2>
            <p>
              We use service providers for hosting, private data storage,
              security checks, and optional operational email notifications. We
              do not publish your contact details.{" "}
              {modernizeMode
                ? "When Modernize matching is enabled, the form displays the applicable contact permission. After you agree and submit, we send project information to Modernize to check availability and, if available, send contact details and your consent certificate. Modernize may share the request with contractors under that permission. RoofZeus may be compensated for qualifying referrals. Earlier requests collected with a promise of a separately approved introduction remain subject to that original permission."
                : "Your initial consent permits RoofZeus to contact you. Before sending your project to a named contractor, we ask for your agreement. A future contractor introduction may result in compensation to RoofZeus."}
            </p>
            {modernizeMode && (
              <>
                <h2>Form verification and external referrals</h2>
                <p>
                  When direct partner matching is enabled, ActiveProspect
                  TrustedForm documents the form interaction and consent,
                  including information entered and browser/session data. Its
                  certificate is sent with the lead to Modernize for
                  verification. These tools remain off while matching is
                  disabled. If you instead follow a hosted Modernize referral
                  link, RoofZeus does not append your address or contact
                  details; Modernize handles information you enter on its site.
                  See{" "}
                  <a
                    href="https://activeprospect.com/trustedform-privacy-notice/"
                    target="_blank"
                    rel="noopener"
                  >
                    ActiveProspect’s privacy policy
                  </a>{" "}
                  and{" "}
                  <a
                    href="https://modernize.com/privacy-policy"
                    target="_blank"
                    rel="noopener"
                  >
                    Modernize’s privacy policy
                  </a>
                  .
                </p>
              </>
            )}
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
              We do not transmit form details to analytics. Enabled form
              verification is described above. The contractor app uses separate
              account and business data flows. These public-site privacy details
              apply to homeowner requests and network interest registration.
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
function LegacyFunnel() {
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  query.set("estimate", "1");
  return <Navigate replace to={"/?" + query.toString()} />;
}
export default function PublicSite() {
  const location = useLocation();
  // A standalone local test has no SPA links to other forms while the SDK runs.
  if (import.meta.env.DEV && location.pathname === "/trustedform-test")
    return (
      <div className="rz-public rz-estimates">
        <TrustedFormTest />
      </div>
    );
  return (
    <div className="rz-public rz-estimates">
      <a className="rz-skip" href="#main-content">
        Skip to content
      </a>
      <Metadata />
      <header className="rz-estimate-header">
        <div className="rz-container">
          <Brand />
          <span>
            <ShieldCheck size={16} /> Free to get started. No obligation.
          </span>
        </div>
      </header>
      <main id="main-content">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/demo" element={<LandingPage key="demo" demo />} />
          <Route path="/find-a-roofer" element={<LegacyFunnel />} />
          <Route
            path="/for-contractors"
            element={<Navigate to="/" replace />}
          />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/privacy" element={<Legal />} />
          <Route path="/terms" element={<Legal terms />} />
          {[
            "/signup",
            "/dashboard",
            "/crew",
            "/accept-invite",
            "/complete-signup",
            "/verify-email",
          ].map((path) => (
            <Route key={path} path={path} element={<AppRedirect />} />
          ))}
          {[
            "/services/*",
            "/guides/*",
            "/locations",
            "/roofers/*",
            "/how-it-works",
            "/faq",
          ].map((path) => (
            <Route
              key={path}
              path={path}
              element={<Navigate to="/" replace />}
            />
          ))}
          {["/pricing", "/features", "/see-it-in-action", "/security"].map(
            (path) => (
              <Route
                key={path}
                path={path}
                element={<Navigate to="/" replace />}
              />
            ),
          )}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer className="rz-estimate-footer">
        <div className="rz-container">
          <div>
            <Brand />
            <p>
              RoofZeus helps homeowners explore roofing estimates. We do not
              perform roofing work. Contractor availability varies by location;
              an estimate or introduction is not guaranteed.
            </p>
          </div>
          <nav aria-label="Footer">
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
          </nav>
          <small>© {new Date().getFullYear()} RoofZeus</small>
        </div>
      </footer>
    </div>
  );
}
