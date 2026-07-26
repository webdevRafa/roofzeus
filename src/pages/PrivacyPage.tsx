import LegalPage, {
  type LegalSection,
} from "../components/marketing/LegalPage";

const sections: LegalSection[] = [
  {
    title: "What we collect",
    content: (
      <ul>
        <li>
          Account information such as your name, email, and authentication
          identifiers.
        </li>
        <li>
          Organization and team information, including company name, invited
          members, roles, and permissions.
        </li>
        <li>
          Operational data you add to Roof Zeus, including jobs, addresses,
          schedules, notes, photos, payouts, pay stubs, invoices, and reports.
        </li>
        <li>
          Basic diagnostic and usage information used to keep the service
          stable and improve performance.
        </li>
      </ul>
    ),
  },
  {
    title: "How we use information",
    content: (
      <ul>
        <li>To provide jobs, scheduling, crew, payout, and document features.</li>
        <li>To secure organization access and apply role-based permissions.</li>
        <li>To support billing when you continue after the free trial.</li>
        <li>To troubleshoot issues and improve service performance.</li>
      </ul>
    ),
  },
  {
    title: "What we do not do",
    content: (
      <ul>
        <li>We do not sell your data.</li>
        <li>We do not use your job data to train models for other customers.</li>
        <li>
          We do not share your job, photo, or payout details with other
          companies.
        </li>
      </ul>
    ),
  },
  {
    title: "Data separation and access",
    content:
      "Roof Zeus is designed as a multi-tenant service. Company workspaces are scoped to organization membership, and access depends on the role assigned to each person. Crew access can be limited to assigned jobs and job updates.",
  },
  {
    title: "Third-party services",
    content:
      "Roof Zeus may rely on trusted providers for hosting, authentication, storage, billing, and related infrastructure. These providers process information as needed to deliver, secure, and maintain the service.",
  },
  {
    title: "Data retention",
    content:
      "We retain information while an account is active so the service can function as expected. After cancellation, some information may be retained for a limited period for legal, security, or operational reasons before following the applicable deletion process.",
  },
  {
    title: "Security",
    content:
      "We use practical measures designed to protect account and organization access. No online system can guarantee perfect security, but Roof Zeus is structured around organization-scoped separation, roles, and authenticated access.",
  },
  {
    title: "Contact",
    content:
      "Questions about privacy can be sent through the support method provided inside the Roof Zeus application or through the contact channel you use to reach the Roof Zeus team.",
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Your information"
      title="Privacy policy"
      summary="This policy explains what Roof Zeus collects, why it is used, and the boundaries around your company data."
      sections={sections}
    />
  );
}
