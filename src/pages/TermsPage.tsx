import LegalPage, {
  type LegalSection,
} from "../components/marketing/LegalPage";

const sections: LegalSection[] = [
  {
    title: "Using Roof Zeus",
    content:
      "Roof Zeus is provided as a subscription service to help roofing contractors manage jobs, schedules, teams, documentation, and financial records. By creating an account or using the platform, you agree to operate responsibly within your organization workspace.",
  },
  {
    title: "Accounts, organizations, and roles",
    content:
      "You are responsible for maintaining the confidentiality of your sign-in credentials. If you invite team members, you are responsible for assigning roles appropriately. Role-based access helps keep sensitive information controlled.",
  },
  {
    title: "Customer data and ownership",
    content:
      "You own the operational data you put into Roof Zeus, including job records, photos, notes, payout records, pay stubs, and documents. We process that information to provide and improve the service, maintain security, and support billing and customer operations.",
  },
  {
    title: "Acceptable use",
    content:
      "You agree not to misuse the platform, attempt to access information outside your organization, disrupt service operation, upload malicious content, or use Roof Zeus for unlawful purposes.",
  },
  {
    title: "Trial and subscription",
    content:
      "Roof Zeus currently offers a 30-day free trial with no payment method required upfront. After the trial, continued use requires an active subscription. Pricing and billing options are shown on the Pricing page.",
  },
  {
    title: "Cancellations",
    content:
      "You may cancel your subscription at any time. If you cancel during a paid billing period, access will generally continue through the end of that period. Specific behavior may depend on the payment processor and billing option.",
  },
  {
    title: "Availability and changes",
    content:
      "We work to keep Roof Zeus reliable, but no online service can guarantee uninterrupted access. Features and interfaces may be updated as the platform improves. Material changes to these terms may be communicated when appropriate.",
  },
  {
    title: "Disclaimer",
    content:
      "Roof Zeus helps organize information and workflows. It does not replace professional judgment, bookkeeping, legal advice, or compliance obligations. You remain responsible for business decisions, job execution, and regulatory compliance.",
  },
  {
    title: "Limitation of liability",
    content:
      "To the extent permitted by law, Roof Zeus and its operators are not liable for indirect, incidental, or consequential damages arising from use of the service. Where applicable, total liability is limited to the amount paid for the service during the relevant period.",
  },
  {
    title: "Contact",
    content:
      "Questions about these terms can be sent through the support method provided inside the Roof Zeus application or through the contact channel you use to reach the Roof Zeus team.",
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Service agreement"
      title="Terms of service"
      summary="These terms cover how Roof Zeus is provided, what you can expect, and what we expect from people using a company workspace."
      sections={sections}
    />
  );
}
