import { useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { pages, SITE_URL, SITE_OPERATOR, SUPPORT_EMAIL } from "./content";
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
        src={`/brand/v8/logo-${dark ? "dark" : "light"}.svg`}
        alt="RoofZeus"
        width={dark ? 686 : 1420}
        height={dark ? 230 : 500}
      />
    </Link>
  );
}

function EstimateHeader() {
  const [hidden, setHidden] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    // Clamp elastic overscroll so bouncing at either edge isn't a direction change.
    const scrollPosition = () =>
      Math.max(
        0,
        Math.min(
          window.scrollY,
          document.documentElement.scrollHeight - window.innerHeight,
        ),
      );
    let previousY = scrollPosition();
    let direction = 0;
    let travel = 0;
    const resetTracking = () => {
      previousY = scrollPosition();
      direction = 0;
      travel = 0;
    };
    const resetScroll = () => {
      resetTracking();
      setHidden(false);
    };
    const syncResize = () => {
      // Mobile browser chrome resizing must not reveal a deliberately hidden bar.
      resetTracking();
      if (previousY <= 8) setHidden(false);
    };
    const syncScroll = () => {
      const y = scrollPosition();
      const delta = y - previousY;
      previousY = y;
      if (y <= 8) {
        resetScroll();
        return;
      }
      if (delta === 0) return;
      const nextDirection = Math.sign(delta);
      // Accumulate deliberate movement, including small trackpad/touch events.
      travel =
        nextDirection === direction
          ? travel + Math.abs(delta)
          : Math.abs(delta);
      direction = nextDirection;
      if (travel >= 12) {
        setHidden(direction > 0);
        travel = 0;
      }
    };
    resetScroll();
    window.addEventListener("scroll", syncScroll, { passive: true });
    window.addEventListener("pageshow", resetScroll);
    window.addEventListener("resize", syncResize);
    return () => {
      window.removeEventListener("scroll", syncScroll);
      window.removeEventListener("pageshow", resetScroll);
      window.removeEventListener("resize", syncResize);
    };
  }, [pathname]);

  return (
    <div className="rz-estimate-header-space">
      <header className={`rz-estimate-header${hidden ? " is-hidden" : ""}`}>
        <div className="rz-container">
          <Brand />
          <span>
            <ShieldCheck size={16} /> Free to get started. No obligation.
          </span>
        </div>
      </header>
    </div>
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
        eyebrow="LAST UPDATED · SEPTEMBER 13, 2026"
        title={terms ? "Terms of Use" : "Privacy Policy"}
        text={
          terms
            ? "How the RoofZeus roofing estimate request service works."
            : "How we handle your information, referrals, and contact choices."
        }
      />
      <article className="rz-article rz-container rz-prose">
        <p className="rz-legal-owner">
          <strong>RoofZeus is owned and operated by {SITE_OPERATOR}.</strong> In
          this {terms ? "document" : "policy"}, “RoofZeus,” “we,” and “us” refer
          to {SITE_OPERATOR} operating the RoofZeus service. For service or
          privacy questions, email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
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
              creates no obligation to hire. A receipt or reference identifies
              your submission; it does not by itself confirm partner acceptance,
              a contractor match, an appointment, or an estimate. Check the
              status shown with your reference.
            </p>
            <h2>Contact permission</h2>
            <p>
              Browsing the site or entering a ZIP code does not give marketing
              contact permission. When submissions are available, review the
              contact permission next to the final submit button and choose
              whether to agree. That permission describes who may contact you
              and how; these terms and the Privacy Policy do not expand it. You
              do not have to give consent to purchase goods or services.
            </p>
            <h2>Preview and demo forms</h2>
            <p>
              When the form is marked as a preview or demo, it is not accepting
              estimate requests. A successful format check or demo completion
              does not send a request to Modernize or a contractor. Use sample
              information in these forms.
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
            {modernizeMode && (
              <>
                <h2>Referral partners</h2>
                <p>
                  RoofZeus may receive compensation for qualifying referrals to
                  Modernize. A referral does not guarantee the lowest price, an
                  appointment, or an available contractor. Where a link takes
                  you to Modernize, you complete its form under its{" "}
                  <a
                    href="https://modernize.com/terms"
                    target="_blank"
                    rel="noopener"
                  >
                    Terms of Use
                  </a>{" "}
                  and{" "}
                  <a
                    href="https://modernize.com/privacy"
                    target="_blank"
                    rel="noopener"
                  >
                    Privacy Notice
                  </a>
                  . Following the link is not a RoofZeus form submission.
                </p>
              </>
            )}
            <h2>Questions</h2>
            <p>
              For questions about these terms or a request, contact{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. Include
              your reference if available. You can also ask us to stop future
              contact or sharing; see the{" "}
              <Link to="/privacy#privacy-choices">privacy choices</Link> for
              information about requests already delivered to another company.
            </p>
          </>
        ) : (
          <>
            <h2>What we collect</h2>
            <p>
              When you submit an enabled request, we collect your name, email,
              phone number, property address and ZIP code, roofing project
              details, ownership or authorization response, and the permission
              you provide. We also keep submission timestamps, request
              references, delivery status, and consent records. If you email
              support, we receive the information you include in your message.
              Form-session recording, when enabled, is described below.
            </p>
            <h2>How we use it</h2>
            <p>
              We use this information to review requests, check possible local
              availability, follow up within your permission, handle support and
              privacy requests, and prevent abuse. We store a keyed daily hash
              of the requesting IP address for rate limiting, rather than
              putting the raw IP address in the lead record. Infrastructure
              providers may separately process network information for security.
            </p>
            <p>
              Our hosting provider may supply an approximate city and state
              based on your internet connection to personalize the area label.
              This does not use precise device location, confirm service
              availability, or replace the property address you enter. We do not
              add this approximate location to your lead record or browser
              storage.
            </p>
            <h2>Sharing and contractor introductions</h2>
            <p>
              We use service providers for hosting, private data storage,
              security checks, and optional operational email notifications. We
              do not publish your contact details.{" "}
              {modernizeMode
                ? "When Modernize matching is enabled, the form displays the applicable contact permission. After you agree and submit, we send project information to Modernize to check availability and, if available, send contact details and your consent certificate. Modernize may share the request with contractors as described in that permission and its privacy notice. RoofZeus may be compensated for qualifying referrals. We do not treat your permission as authorization for unrelated marketing. Earlier requests collected with a promise of a separately approved introduction remain subject to that original permission."
                : "Your initial consent permits RoofZeus to contact you. Before sending your project to a named contractor, we ask for your agreement. A future contractor introduction may result in compensation to RoofZeus."}
            </p>
            {modernizeMode && (
              <>
                <h2>Form verification and external referrals</h2>
                <p>
                  When direct partner matching is enabled, ActiveProspect
                  TrustedForm records the form session to document the request
                  and contact permission. This includes information you enter,
                  clicks, the page and disclosures shown, timestamps, IP
                  address, and browser/device information. Recording starts when
                  you continue into the enabled request form and can capture
                  entries even if you do not submit. Its certificate accompanies
                  a delivered lead to Modernize for verification. Recording is
                  off in the public preview and demo. A separately labeled
                  sandbox recording test uses sample information and does not
                  send a lead. If you follow a hosted Modernize referral link,
                  RoofZeus does not append your address or contact details;
                  Modernize handles information you enter on its site. See{" "}
                  <a
                    href="https://activeprospect.com/trustedform-privacy-notice/"
                    target="_blank"
                    rel="noopener"
                  >
                    ActiveProspect’s TrustedForm Privacy Notice
                  </a>{" "}
                  and{" "}
                  <a
                    href="https://modernize.com/privacy"
                    target="_blank"
                    rel="noopener"
                  >
                    Modernize’s Privacy Notice
                  </a>
                  .
                </p>
              </>
            )}
            <h2>Location and third-party tools</h2>
            <p>
              The homepage remembers your entered ZIP code in browser storage
              for future visits. The demo does not save it. ZIP lookup sends the
              ZIP code to Zippopotam.us. If address search is enabled, Google
              processes what you type into its address search field. Cloudflare
              Turnstile processes security signals to help prevent spam. Manual
              address entry is always available. We do not request your device’s
              precise location automatically.
            </p>
            <h2 id="privacy-choices">Your privacy and contact choices</h2>
            <p>
              To ask about, access, correct, or delete your information, or to
              opt out of future contact or referral sharing, email{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. Include
              your request reference if you have one and describe your request.
              You do not need to create an account. We may need to verify your
              identity before disclosing or changing a record. Do not send
              passwords, payment details, or identification documents in your
              initial message.
            </p>
            <p>
              Withdrawing permission does not automatically recall information
              already delivered. We can help identify the recipient and relay
              your request. You can also contact that company directly or use
              the opt-out instructions in its messages. Clearing browser storage
              removes the remembered ZIP code.
            </p>
            <h2>Retention and security</h2>
            <p>
              We keep request and permission records as needed to handle your
              request, resolve delivery issues, prevent abuse, and document
              prior consent or transactions. Some records may need to remain
              after a deletion request for these reasons or legal obligations.
              Service providers and referral recipients have their own retention
              practices, described in their privacy notices. Access to stored
              request records is restricted; no online system can guarantee
              absolute security.
            </p>
            <h2>Analytics and policy updates</h2>
            <p>
              Our form analytics events do not include names, contact details,
              addresses, or query strings. Form-session recording is separate
              and described above. This policy covers the public RoofZeus
              estimate service; contractor software has separate account and
              business data flows. Changes to this policy will be reflected in
              the updated date. A policy update does not grant new marketing
              contact permission for a previous request.
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
      <EstimateHeader />
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
            <p className="rz-footer-ownership">
              Owned and operated by {SITE_OPERATOR}.
            </p>
            <p>
              RoofZeus helps homeowners explore roofing estimates. We do not
              perform roofing work. Contractor availability varies by location;
              an estimate or introduction is not guaranteed. We may receive
              compensation for qualifying referrals.
            </p>
          </div>
          <div className="rz-footer-contact">
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            <nav aria-label="Footer">
              <Link to="/privacy">Privacy</Link>
              <Link to="/terms">Terms</Link>
              <Link to="/privacy#privacy-choices">Privacy choices</Link>
            </nav>
          </div>
          <small>
            © {new Date().getFullYear()} {SITE_OPERATOR}. RoofZeus.
          </small>
        </div>
      </footer>
    </div>
  );
}
