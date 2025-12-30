// src/App.tsx
import { BrowserRouter } from "react-router-dom";
import "./index.css";

import ScrollToTop from "./components/ScrollToTop";
import AppRouter from "./routers/AppRouter";
import MarketingRouter from "./routers/MarketingRouter";
import { ThemeProvider } from "./theme/ThemeProvider";

function isAppHost() {
  const host = window.location.hostname.toLowerCase();
  return host === "app.localhost" || host === "app.roofzeus.com";
}

export default function App() {
  const showApp = isAppHost();

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)]">
        <BrowserRouter>
          <ScrollToTop />
          {showApp ? <AppRouter /> : <MarketingRouter />}
        </BrowserRouter>
      </div>
    </ThemeProvider>
  );
}
