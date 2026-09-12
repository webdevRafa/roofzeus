// src/App.tsx
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import "./marketing.css";
import { useEffect } from "react";
import ScrollToTop from "./components/ScrollToTop";
import AppRouter from "./routers/AppRouter";
import { ThemeProvider } from "./theme/ThemeProvider";
import AOS from "aos";
import "aos/dist/aos.css";

export default function App() {
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
          <AppRouter />
        </BrowserRouter>
      </div>
    </ThemeProvider>
  );
}
