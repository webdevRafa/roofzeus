// src/App.tsx
import { BrowserRouter } from "react-router-dom";
import "./index.css";

import ScrollToTop from "./components/ScrollToTop";
import AppRouter from "./routers/AppRouter";
import MarketingRouter from "./routers/MarketingRouter";

function isAppHost() {
  const host = window.location.hostname.toLowerCase();
  return host === "app.localhost" || host === "app.roofzeus.com";
}

export default function App() {
  const showApp = isAppHost();

  return (
    <div className="relative z-30">
      <BrowserRouter>
        <ScrollToTop />
        {showApp ? <AppRouter /> : <MarketingRouter />}
      </BrowserRouter>
    </div>
  );
}
