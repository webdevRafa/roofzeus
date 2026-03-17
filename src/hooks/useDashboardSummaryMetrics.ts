import { useMemo } from "react";
import type { Job, PayoutDoc } from "../types/types";

/**
 * Hook to compute additional dashboard summary metrics.
 *
 * Given the list of jobs and payouts, this hook derives two values:
 *  - `unscheduledJobsCount`: number of jobs where no scheduling has been
 *    provided for felt, shingles or punch (all three schedule fields are
 *    undefined/null).  These jobs are considered "unscheduled".
 *  - `jobsWithoutPayoutsCount`: number of jobs that have no associated
 *    payouts.  Association is determined by comparing job ids with the
 *    `jobId` field on payout documents.
 *
 * @param jobs List of job documents
 * @param payouts List of payout documents
 */
export function useDashboardSummaryMetrics(
  jobs: Job[],
  payouts: PayoutDoc[]
) {
  const unscheduledJobsCount = useMemo(() => {
    return jobs.filter((j) => {
      // These fields may be undefined, null, or a Firestore timestamp/date.
      // A job is considered unscheduled only when *all* of them are falsy.
      return !(
        j.feltScheduledFor || j.shinglesScheduledFor || j.punchScheduledFor
      );
    }).length;
  }, [jobs]);

  const jobsWithoutPayoutsCount = useMemo(() => {
    const jobIdsWithPayouts = new Set<string>();
    payouts.forEach((p) => {
      const jobId = p.jobId;
      if (typeof jobId === "string" && jobId) {
        jobIdsWithPayouts.add(jobId);
      }
    });
    return jobs.filter((j) => !jobIdsWithPayouts.has(j.id)).length;
  }, [jobs, payouts]);

  return { unscheduledJobsCount, jobsWithoutPayoutsCount };
}