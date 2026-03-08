import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import type { Employee } from "../types/types";
import { useOrg } from "../contexts/OrgContext";

/**
 * useCurrentEmployee (ORG-NESTED)
 *
 * Reads the current employee profile for the signed-in user within the active org:
 * organizations/{orgId}/employees/{uid}
 */
export function useCurrentEmployee() {
  const { orgId, loading: orgLoading } = useOrg();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const auth = getAuth();
    let unsubEmployee: (() => void) | null = null;

    const cleanupEmployeeSub = () => {
      if (unsubEmployee) {
        unsubEmployee();
        unsubEmployee = null;
      }
    };

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      // whenever auth changes, reset employee subscription
      cleanupEmployeeSub();

      // Not signed in
      if (!user) {
        setEmployee(null);
        setLoading(false);
        setError(null);
        return;
      }

      const start = async () => {
        try {
          await user.reload();
        } catch {
          // ignore reload failures
        }

        const refreshedUser = getAuth().currentUser;

        if (!refreshedUser) {
          setEmployee(null);
          setLoading(false);
          setError(null);
          return;
        }

        if (!refreshedUser.emailVerified) {
          setEmployee(null);
          setLoading(false);
          setError("Please verify your email to continue.");
          return;
        }

        if (orgLoading) {
          setEmployee(null);
          setLoading(true);
          setError(null);
          return;
        }

        if (!orgId) {
          setEmployee(null);
          setLoading(false);
          setError("No organization selected.");
          return;
        }

        setLoading(true);
        setError(null);

        const ref = doc(
          db,
          "organizations",
          orgId,
          "employees",
          refreshedUser.uid
        );

        unsubEmployee = onSnapshot(
          ref,
          (ds) => {
            if (!ds.exists()) {
              setEmployee(null);
              setLoading(false);
              setError("Employee profile not found for this organization.");
              return;
            }

            setEmployee({ id: ds.id, ...(ds.data() as Omit<Employee, "id">) });
            setLoading(false);
            setError(null);
          },
          (err) => {
            setEmployee(null);
            setLoading(false);
            setError(err?.message || String(err));
          }
        );
      };

      void start();
      return;

      // Signed in but org not ready yet -> keep loading
      if (orgLoading) {
        setEmployee(null);
        setLoading(true);
        setError(null);
        return;
      }
    });

    return () => {
      unsubAuth();
      cleanupEmployeeSub();
    };
  }, [orgId, orgLoading]);

  return { employee, loading, error };
}
