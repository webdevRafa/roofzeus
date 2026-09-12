import { useEffect } from "react";
import { Link, Outlet } from "react-router-dom";
import MarketingNav from "./MarketingNav";

const logo = "/brand/roof-zeus-logo-dark.webp?v=2";

const footerGroups = [
  {
    label: "Explore",
    links: [
      ["Product", "/features"],
      ["See it in action", "/see-it-in-action"],
      ["Pricing", "/pricing"],
      ["FAQ", "/faq"],
    ],
  },
  {
    label: "Trust",
    links: [
      ["Security", "/security"],
      ["Privacy", "/privacy"],
      ["Terms", "/terms"],
    ],
  },
  {
    label: "Account",
    links: [
      ["Log in", "/login"],
      ["Start free trial", "/signup"],
    ],
  },
];

export default function MarketingLayout() {
  useEffect(() => {
    // Public-site identity only; retain the application's existing favicon.
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!icon) return;
    const previousHref = icon.href;
    const previousType = icon.type;
    icon.href = "/brand/roof-zeus-icon.svg?v=2";
    icon.type = "image/svg+xml";
    return () => {
      icon.href = previousHref;
      icon.type = previousType;
    };
  }, []);

  return (
    <div className="rz-marketing">
      <MarketingNav />
      <Outlet />
      <footer className="rz-footer">
        <div className="rz-container">
          <div className="rz-footer__top">
            <div className="rz-footer__brand">
              <Link to="/" aria-label="Roof Zeus home">
                <img src={logo} alt="Roof Zeus" width={1000} height={240} loading="lazy" />
              </Link>
              <p>
                Roofing software for jobs, finances, crews, and documents.
              </p>
            </div>
            {footerGroups.map((group) => (
              <div className="rz-footer__column" key={group.label}>
                <strong>{group.label}</strong>
                <nav aria-label={`${group.label} links`}>
                  {group.links.map(([label, to]) => (
                    <Link key={to} to={to}>
                      {label}
                    </Link>
                  ))}
                </nav>
              </div>
            ))}
          </div>
          <div className="rz-footer__bottom">
            <span>© {new Date().getFullYear()} Roof Zeus.</span>
            <span>Built for roofing contractors.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
