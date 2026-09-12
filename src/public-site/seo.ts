import { SITE_URL, type PageMeta } from "./content";
export function structuredData(page: PageMeta) {
  const url = `${SITE_URL}${page.path}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: "RoofZeus",
        url: SITE_URL,
        logo: `${SITE_URL}/brand/roof-zeus-emblem.png`,
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: "RoofZeus",
        url: SITE_URL,
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      {
        "@type": "WebPage",
        name: page.title,
        description: page.description,
        url,
        isPartOf: { "@id": `${SITE_URL}/#website` },
      },
      ...(page.path !== "/"
        ? [
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                {
                  "@type": "ListItem",
                  position: 1,
                  name: "Home",
                  item: SITE_URL,
                },
                {
                  "@type": "ListItem",
                  position: 2,
                  name: page.title.split(" | ")[0],
                  item: url,
                },
              ],
            },
          ]
        : []),
    ],
  };
}
