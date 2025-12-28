// src/routers/MarketingRouter.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import ExternalRedirect from "../components/ExternalRedirect";

import MarketingLayout from "../components/marketing/MarketingLayout";

import HomePage from "../pages/HomePage";
import PricingPage from "../pages/PricingPage";
import SeeItInActionPage from "../pages/SeeItInActionPage";
import FeaturesPage from "../pages/FeaturesPage";
import SecurityPage from "../pages/SecurityPage";
import FaqPage from "../pages/FaqPage";
import PrivacyPage from "../pages/PrivacyPage";
import TermsPage from "../pages/TermsPage";

function appOrigin() {
  // local dev
  if (window.location.hostname === "localhost")
    return "http://app.localhost:5173";
  // production
  return "https://app.roofzeus.com";
}

export default function MarketingRouter() {
  return (
    <Routes>
      {/* Marketing layout wrapper (Nav + Footer + global bg) */}
      <Route path="/" element={<MarketingLayout />}>
        <Route index element={<HomePage />} />
        <Route path="pricing" element={<PricingPage />} />
        <Route path="see-it-in-action" element={<SeeItInActionPage />} />
        <Route path="features" element={<FeaturesPage />} />
        <Route path="security" element={<SecurityPage />} />
        <Route path="faq" element={<FaqPage />} />
        <Route path="privacy" element={<PrivacyPage />} />
        <Route path="terms" element={<TermsPage />} />
        <Route
          path="signup"
          element={<ExternalRedirect to={`${appOrigin()}/signup`} />}
        />

        {/* Any attempt to access auth/app routes on marketing should bounce to app domain */}
        <Route
          path="login"
          element={<ExternalRedirect to={`${appOrigin()}/login`} />}
        />
        <Route
          path="dashboard"
          element={<ExternalRedirect to={`${appOrigin()}/dashboard`} />}
        />
        <Route
          path="crew"
          element={<ExternalRedirect to={`${appOrigin()}/crew`} />}
        />

        {/* fallback */}
        <Route path="*" element={<Navigate to="/pricing" replace />} />
      </Route>
    </Routes>
  );
}
