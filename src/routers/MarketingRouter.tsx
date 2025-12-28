// src/routers/MarketingRouter.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import ExternalRedirect from "../components/ExternalRedirect";
import PricingPage from "../pages/PricingPage";
import PlansPage from "../pages/PlansPage";
import HomePage from "../pages/HomePage";
import SeeItInActionPage from "../pages/SeeItInActionPage";

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
      <Route path="/" element={<HomePage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/plans" element={<PlansPage />} />
      <Route path="/see-it-in-action" element={<SeeItInActionPage />} />

      {/* Any attempt to access auth routes on marketing should bounce to app domain */}
      <Route
        path="/login"
        element={<ExternalRedirect to={`${appOrigin()}/login`} />}
      />
      <Route
        path="/dashboard"
        element={<ExternalRedirect to={`${appOrigin()}/dashboard`} />}
      />
      <Route
        path="/crew"
        element={<ExternalRedirect to={`${appOrigin()}/crew`} />}
      />

      {/* fallback */}
      <Route path="*" element={<Navigate to="/pricing" replace />} />
    </Routes>
  );
}
