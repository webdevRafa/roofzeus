// src/routers/AppRouter.tsx
import { Routes, Route } from "react-router-dom";

import LoginPage from "../pages/LoginPage";
import AcceptInvitePage from "../pages/AcceptInvitePage";
import CompleteSignupPage from "../pages/CompleteSignupPage";
import InvoiceViewer from "../pages/InvoiceViewer";
import SignupPage from "../pages/SignupPage";

import RoleGuard from "../components/RoleGuard";

import AdminShell from "../layouts/AdminShell";
import CrewLayout from "../layouts/CrewLayout";

import DashboardPage from "../pages/DashboardPage";
import InvoicesPage from "../pages/InvoicesPage";
import FinancialOverviewPage from "../pages/FinancialOverviewPage";
import PunchCalendarPage from "../pages/PunchCalendarPage";
import PunchDayPage from "../pages/PunchDayPage";
import JobsPage from "../pages/JobsPage";
import EmployeesPage from "../pages/EmployeesPage";
import EmployeeDetailPage from "../pages/EmployeeDetailPage";
import JobDetailPage from "../pages/JobDetailPage";
import PayoutsPage from "../pages/PayoutsPage";

import CrewDashboardPage from "../pages/CrewDashboardPage";
import CrewJobDetailPage from "../pages/CrewJobDetailPage";

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/accept-invite" element={<AcceptInvitePage />} />
      <Route path="/complete-signup" element={<CompleteSignupPage />} />
      <Route path="/invoice/:id" element={<InvoiceViewer />} />
      <Route path="/signup" element={<SignupPage />} />

      {/* ✅ Admin routes (OrgProvider BEFORE AdminGuard via AdminShell) */}
      <Route element={<AdminShell />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/invoices-page" element={<InvoicesPage />} />
        <Route path="/financial-overview" element={<FinancialOverviewPage />} />
        <Route path="/schedule" element={<PunchCalendarPage />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/schedule/:date" element={<PunchDayPage />} />
        <Route path="/employees" element={<EmployeesPage />} />
        <Route path="/employees/:id" element={<EmployeeDetailPage />} />
        <Route path="/job/:id" element={<JobDetailPage />} />
        <Route path="/invoices/:id" element={<InvoiceViewer />} />
        <Route path="/payouts" element={<PayoutsPage />} />
      </Route>

      {/* ✅ Crew routes */}
      <Route
        element={
          <RoleGuard allowedRoles={["crew", "manager", "readOnly"]}>
            <CrewLayout />
          </RoleGuard>
        }
      >
        <Route path="/crew" element={<CrewDashboardPage />} />
        <Route path="/crew/job/:id" element={<CrewJobDetailPage />} />
      </Route>
    </Routes>
  );
}
