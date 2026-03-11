import { useState } from "react";
import { DashboardProgressSection } from "../features/dashboard/DashboardProgressSection";
import { useOrgJobsData } from "../hooks/useOrgJobsData";

export default function PipelinePage() {
  const { membershipLoading, orgId, materialProgressJobs, readyForPunchJobs } =
    useOrgJobsData();

  const [upcomingOpen, setUpcomingOpen] = useState(true);

  if (membershipLoading) {
    return <div className="p-4">Loading organization…</div>;
  }

  if (!orgId) {
    return (
      <div className="p-8 text-red-600">
        You are not linked to an organization. Please contact your admin.
      </div>
    );
  }

  return (
    <div className="mx-auto w-full py-6 sm:py-10">
      <DashboardProgressSection
        upcomingOpen={upcomingOpen}
        setUpcomingOpen={setUpcomingOpen}
        materialProgressJobs={materialProgressJobs}
        readyForPunchJobs={readyForPunchJobs}
      />
    </div>
  );
}
