import { Link, Outlet } from "react-router-dom";
import logo from "../../assets/rz-modern-white.svg";
import MarketingNav from "./MarketingNav";

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
  return (
    <div className="rz-marketing">
      <MarketingNav />
      <Outlet />
      <footer className="rz-footer">
        <div className="rz-container">
          <div className="rz-footer__top">
            <div className="rz-footer__brand">
              <Link to="/" aria-label="Roof Zeus home">
                <img src={logo} alt="Roof Zeus" />
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
