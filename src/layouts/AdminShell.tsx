// src/layouts/AdminShell.tsx
import AdminGuard from "../components/AdminGuard";
import AdminLayout from "./AdminLayout";
import { OrgProvider } from "../contexts/OrgContext";
import { useMembership } from "../hooks/useMembership";

export default function AdminShell() {
  const {
    memberships,
    orgId: activeOrgId,
    activeOrgName,
    setActiveOrgId,
    loading,
  } = useMembership();

  return (
    <OrgProvider
      value={{
        orgId: activeOrgId,
        orgName: activeOrgName ?? null,
        memberships,
        setOrgId: setActiveOrgId,
        loading,
      }}
    >
      <AdminGuard>
        <AdminLayout />
      </AdminGuard>
    </OrgProvider>
  );
}
