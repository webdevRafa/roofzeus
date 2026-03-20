import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

import DashboardSummarySection from "../features/dashboard/DashboardSummarySection";
import { DashboardPayoutsSection } from "../features/dashboard/DashboardPayoutsSection";
import DashboardFinancialOverviewSection from "../features/dashboard/DashboardFinancialOverviewSection";

import { GlobalPayoutStubModal } from "../components/GlobalPayoutStubModal";
import PayTechnicianModal from "../components/PayTechnicianModal";

import { useOrgJobsData } from "../hooks/useOrgJobsData";
import { useDashboardPayoutsData } from "../hooks/useDashboardPayoutsData";

export default function DashboardPage() {
  const navigate = useNavigate();

  const {
    orgId,
    membershipLoading,
    jobs,

    loading,

    materialProgressJobs,
    readyForPunchJobs,
  } = useOrgJobsData();

  const {
    payouts,
    payoutsLoading,
    payoutsError,
    payoutFilter,
    setPayoutFilter,
    payoutSearch,
    setPayoutSearch,
    payoutsPage,
    setPayoutsPage,
    PAYOUTS_PER_PAGE,
    filteredPayouts,
    payoutsTotalPages,
    pagedPayouts,
    selectedPayoutIds,
    selectedEmployeeIds,
    selectedPayouts,
    canCreateStub,
    togglePayoutSelected,
    clearSelectedPayouts,
    stubOpen,
    setStubOpen,
    stubSaving,
    stubEmployee,
    markSelectedPayoutsAsPaid,
  } = useDashboardPayoutsData();

  const [payoutsOpen, setPayoutsOpen] = useState(true);

  const [payTechOpen, setPayTechOpen] = useState(false);

  const isBusy = membershipLoading || loading;
  const hasOrg = Boolean(orgId);

  if (isBusy) {
    return <div className="p-4">Loading organization…</div>;
  }

  if (!hasOrg) {
    return (
      <div className="p-8 text-red-600">
        You are not linked to an organization. Please contact your admin.
      </div>
    );
  }

  return (
    <>
      <div>
        <motion.div
          className="mx-auto w-full py-6 sm:py-10 grid gap-6 xl:gap-7 2xl:gap-8 grid-cols-1 lg:grid-cols-12"
          initial="initial"
          animate="animate"
        >
          <div className="lg:col-span-12">
            <DashboardSummarySection
              jobs={jobs}
              materialProgressJobs={materialProgressJobs}
              readyForPunchJobs={readyForPunchJobs}
              payouts={payouts}
            />
          </div>

          <div className="lg:col-span-12 xl:col-span-7 hidden">
            <DashboardPayoutsSection
              payoutsOpen={payoutsOpen}
              setPayoutsOpen={setPayoutsOpen}
              payoutSearch={payoutSearch}
              setPayoutSearch={setPayoutSearch}
              payoutFilter={payoutFilter}
              setPayoutFilter={setPayoutFilter}
              payoutsLoading={payoutsLoading}
              payoutsError={payoutsError}
              pagedPayouts={pagedPayouts}
              filteredPayoutsCount={filteredPayouts.length}
              payoutsPage={payoutsPage}
              payoutsTotalPages={payoutsTotalPages}
              setPayoutsPage={setPayoutsPage}
              PAYOUTS_PER_PAGE={PAYOUTS_PER_PAGE}
              selectedPayoutIds={selectedPayoutIds}
              selectedEmployeeIds={selectedEmployeeIds}
              canCreateStub={canCreateStub}
              togglePayoutSelected={togglePayoutSelected}
              clearSelectedPayouts={clearSelectedPayouts}
              setStubOpen={setStubOpen}
              onViewJob={(jobId) => navigate(`/job/${jobId}`)}
              onOpenPayTechnician={() => setPayTechOpen(true)}
            />
          </div>

          <div className="lg:col-span-12 xl:col-span-5 hidden">
            <DashboardFinancialOverviewSection jobs={jobs} payouts={payouts} />
          </div>
        </motion.div>
      </div>

      {stubOpen && selectedPayouts.length > 0 && (
        <GlobalPayoutStubModal
          payouts={selectedPayouts}
          employee={stubEmployee}
          onClose={() => setStubOpen(false)}
          onConfirmPaid={markSelectedPayoutsAsPaid}
          saving={stubSaving}
        />
      )}

      {payTechOpen && orgId && (
        <PayTechnicianModal
          orgId={orgId}
          onClose={() => setPayTechOpen(false)}
          onCreated={() => setPayTechOpen(false)}
        />
      )}
    </>
  );
}
