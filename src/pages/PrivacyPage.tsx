import LegalPage, {
  type LegalSection,
} from "../components/marketing/LegalPage";

const sections: LegalSection[] = [
  {
    title: "What we collect",
    content: (
      <ul>
        <li>
          Contact information you choose to provide, such as your name, email
          address, phone number, and property address.
        </li>
        <li>
          Project information you submit, such as the type of roofing work you
          are interested in, project timing, property details, and other
          information needed to understand your request.
        </li>
        <li>
          Information related to your form submission and consent, including the
          page and disclosures shown to you, submission timestamps, and records
          used to document your request.
        </li>
        <li>
          Basic technical, diagnostic, and usage information, such as IP
          address, browser or device information, and site activity used to
          operate, secure, troubleshoot, and improve Roof Zeus.
        </li>
      </ul>
    ),
  },
  {
    title: "How we use information",
    content: (
      <ul>
        <li>To operate Roof Zeus and process the requests you submit.</li>
        <li>
          To determine whether referral or contractor-matching options may be
          available for your project.
        </li>
        <li>
          To send your request to a participating referral partner when you have
          agreed to the applicable disclosure or contact permission.
        </li>
        <li>
          To maintain records of submissions, disclosures, and consent where
          needed for compliance, fraud prevention, dispute resolution, or
          quality control.
        </li>
        <li>
          To secure the site, prevent abuse, troubleshoot issues, and improve
          site performance and user experience.
        </li>
      </ul>
    ),
  },
  {
    title: "Referral partners and contractor introductions",
    content: (
      <>
        <p>
          Roof Zeus may work with third-party referral partners that help
          connect property owners with roofing contractors or other home-service
          providers. When a referral option is available, the applicable form or
          disclosure will explain the contact permission associated with that
          submission.
        </p>
        <p>
          After you agree and submit your request, Roof Zeus may provide the
          information you entered, together with relevant consent or submission
          records, to a participating referral partner. That partner may then
          share your request with one or more participating contractors or
          service providers according to its own terms, privacy practices, and
          the permission shown to you.
        </p>
        <p>
          Roof Zeus may receive compensation for qualifying referrals. A
          referral does not guarantee contractor availability, an appointment, a
          particular price, or that you will choose to work with any company.
        </p>
      </>
    ),
  },
  {
    title: "Third-party and hosted referral forms",
    content: (
      <>
        <p>
          Some Roof Zeus pages or links may direct you to a third-party website,
          hosted form, or referral experience. Information you enter directly on
          a third-party website is collected and handled by that third party
          under its own privacy policy and terms.
        </p>
        <p>
          Roof Zeus may receive compensation if you follow a referral link or
          complete a qualifying request with a third-party partner.
        </p>
      </>
    ),
  },
  {
    title: "Consent and form verification",
    content: (
      <>
        <p>
          Roof Zeus may use consent-verification, fraud-prevention, analytics,
          or similar service providers to help document how a request was
          submitted. Depending on the form and services enabled, these tools may
          record information such as the page viewed, disclosures shown,
          timestamps, clicks or form interactions, IP address, and browser or
          device information.
        </p>
        <p>
          Verification or consent records may accompany a submitted request when
          reasonably necessary to document the transaction, confirm permission,
          investigate abuse, or satisfy a participating referral partner's
          compliance requirements.
        </p>
      </>
    ),
  },
  {
    title: "Service providers",
    content:
      "Roof Zeus may rely on service providers for hosting, security, analytics, email delivery, form processing, storage, consent verification, fraud prevention, and related infrastructure. These providers may process information only as needed to perform services for Roof Zeus or as otherwise permitted by their applicable agreements and privacy practices.",
  },
  {
    title: "What we do not do",
    content: (
      <ul>
        <li>We do not publish your contact information on Roof Zeus.</li>
        <li>
          We do not represent that every request will result in a contractor
          match, estimate, or appointment.
        </li>
        <li>
          We do not authorize participating referral partners or contractors to
          use your information for purposes beyond the permissions, disclosures,
          and applicable laws governing the request.
        </li>
      </ul>
    ),
  },
  {
    title: "Your choices",
    content: (
      <ul>
        <li>
          You can choose not to submit a referral request if you do not want
          your information shared with a participating referral partner.
        </li>
        <li>
          When a form identifies a third-party partner or provides links to that
          partner's privacy policy or terms, you should review those materials
          before submitting.
        </li>
        <li>
          You may contact Roof Zeus using the contact method provided on the
          site if you have questions about information submitted directly to
          Roof Zeus.
        </li>
      </ul>
    ),
  },
  {
    title: "Data retention",
    content:
      "We retain information for as long as reasonably necessary to operate the service, maintain submission and consent records, prevent fraud or abuse, resolve disputes, satisfy contractual or legal obligations, and support legitimate business operations. Retention periods may vary depending on the type of information and the reason it was collected.",
  },
  {
    title: "Security",
    content:
      "We use reasonable administrative, technical, and organizational measures designed to protect information handled by Roof Zeus. No online system or transmission method can guarantee absolute security.",
  },
  {
    title: "Third-party privacy practices",
    content:
      "Referral partners, contractors, service providers, and third-party websites are separate businesses and may maintain their own privacy policies, terms, data-retention practices, and contact procedures. Roof Zeus does not control how an independent third party handles information after that information has been provided directly to the third party or transferred in accordance with an applicable submission and consent.",
  },
  {
    title: "Policy updates",
    content:
      "We may update this Privacy Policy as Roof Zeus, its services, or its referral relationships change. The version posted on the site will apply to information handled after the updated policy becomes effective.",
  },
  {
    title: "Contact",
    content:
      "Questions about this Privacy Policy or information submitted directly to Roof Zeus can be sent through the contact method provided on the Roof Zeus website.",
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Your information"
      title="Privacy policy"
      summary="This policy explains what Roof Zeus collects, how information is used, and how referral requests may be shared with participating third-party partners."
      sections={sections}
    />
  );
}
