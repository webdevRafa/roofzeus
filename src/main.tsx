// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import PublicSite from "./public-site/PublicSite";
const root = document.getElementById("root")!;
const host = window.location.hostname.toLowerCase();
const contractorHost = [
  "app.roofzeus.com",
  "signup.roofzeus.com",
  "app.localhost",
  "signup.localhost",
  "app.roofzeus.vercel.app",
].includes(host);
if (contractorHost) {
  if (host.startsWith("signup.") && window.location.pathname === "/")
    window.history.replaceState(null, "", `/signup${window.location.search}`);
  document.title = "RoofZeus | Contractor workspace";
  document
    .querySelector('meta[name="robots"]')
    ?.setAttribute("content", "noindex,nofollow");
  document.querySelector('link[rel="canonical"]')?.remove();
  import("./App").then(({ default: App }) =>
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    ),
  );
} else {
  const site = (
    <React.StrictMode>
      <BrowserRouter>
        <PublicSite />
      </BrowserRouter>
    </React.StrictMode>
  );
  if (
    root.dataset.prerender ===
    (window.location.pathname.replace(/\/$/, "") || "/")
  )
    ReactDOM.hydrateRoot(root, site);
  else ReactDOM.createRoot(root).render(site);
}
