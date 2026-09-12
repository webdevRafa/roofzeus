import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom";
import PublicSite from "./public-site/PublicSite";
export { pages, SITE_URL } from "./public-site/content";
export { structuredData } from "./public-site/seo";
export function render(path: string) {
  return renderToString(
    <StaticRouter location={path}>
      <PublicSite />
    </StaticRouter>,
  );
}
