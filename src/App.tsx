// src/App.tsx
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import { useEffect } from "react";
import ScrollToTop from "./components/ScrollToTop";
import AppRouter from "./routers/AppRouter";
import MarketingRouter from "./routers/MarketingRouter";
import { ThemeProvider } from "./theme/ThemeProvider";
import AOS from "aos";
import "aos/dist/aos.css";

function isAppHost() {
  const host = window.location.hostname.toLowerCase();
  return host === "app.localhost" || host === "app.roofzeus.com";
}

export default function App() {
  const showApp = isAppHost();
  useEffect(() => {
    AOS.init({
      duration: 800, // animation duration
      easing: "ease-out-cubic",
      once: true, // animation only happens once
      mirror: false, // no reverse animation on scroll up
      offset: 80, // trigger offset (px)
    });
  }, []);
  return (
    <ThemeProvider>
      <div className="min-h-screen  ">
        <BrowserRouter>
          <ScrollToTop />
          {showApp ? <AppRouter /> : <MarketingRouter />}
        </BrowserRouter>
      </div>
    </ThemeProvider>
  );
}
