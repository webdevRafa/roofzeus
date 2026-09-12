export const SITE_URL = "https://roofzeus.com";
export const CONSENT_VERSION = "2026-09-12.1";
export const CONTACT_CONSENT =
  "I agree that RoofZeus may contact me by phone or email about this roofing request. My information will not be sent to a contractor until I agree to that introduction. I do not have to purchase anything.";
export const services = [
  {
    slug: "roof-repair",
    name: "Roof repair",
    short: "Fix what needs attention.",
    description:
      "A missing shingle. A worn seal. A leak that keeps coming back. Start by describing what you can see, and let a roofing professional assess the cause.",
    icon: "repair",
    detail:
      "A repair may make sense when damage is isolated and the rest of the roof is in serviceable condition. Ask for a written explanation of the cause, the proposed repair, and what is included in the workmanship warranty.",
    questions: [
      "Where are you noticing the problem?",
      "When did it start, and has it happened before?",
      "Is water entering the home right now?",
    ],
  },
  {
    slug: "roof-replacement",
    name: "Roof replacement",
    short: "Plan for what comes next.",
    description:
      "When it is time to think beyond a repair, get your project details in order. Tell us about your property, your roof, and the timeline you have in mind.",
    icon: "home",
    detail:
      "A replacement proposal should explain tear-off, disposal, decking allowances, underlayment, flashing, ventilation, materials, permits, and warranties. Compare the scope as well as the price. An on-site assessment is needed before a reliable quote.",
    questions: [
      "What material is on the roof today?",
      "Do you know roughly how old it is?",
      "Are you planning ahead or dealing with damage?",
    ],
  },
  {
    slug: "storm-damage",
    name: "Storm damage",
    short: "Find your next step after a storm.",
    description:
      "Wind or hail can leave you with questions. Describe what happened and what you have noticed from a safe place. You do not need to diagnose the damage yourself.",
    icon: "storm",
    detail:
      "Keep dated notes and photographs taken from the ground or inside the home. Ask a roofing professional to document findings. Your insurer determines coverage under your policy; RoofZeus does not assess insurance claims or guarantee coverage.",
    questions: [
      "When did the storm occur?",
      "What changes have you noticed?",
      "Is there an active leak or an immediate safety concern?",
    ],
  },
  {
    slug: "roof-inspection",
    name: "Roof inspection",
    short: "Understand the roof over your head.",
    description:
      "Not sure what your roof needs? An inspection can help you understand its condition before making a decision about repairs or replacement.",
    icon: "inspect",
    detail:
      "Ask what the inspection covers, whether it includes photographs and written findings, and whether there is a fee. A qualified professional can explain observed issues and distinguish urgent work from maintenance that can be planned.",
    questions: [
      "Is this routine maintenance or a specific concern?",
      "Are you buying or selling the property?",
      "Do you have any previous inspection records?",
    ],
  },
] as const;
export const guides = [
  {
    slug: "repair-or-replace",
    category: "PLANNING YOUR PROJECT",
    title: "Repair or replace? Start with the right questions.",
    read: "4 min read",
    intro:
      "There is no single age or symptom that tells the whole story. The condition of the roof, the extent of damage, and your plans for the home all matter.",
    sections: [
      [
        "Start with the cause",
        "A stain on a ceiling tells you where water appeared, not necessarily where it entered. Ask a professional to identify the source and document the condition of the surrounding roofing, flashing, and penetrations.",
      ],
      [
        "Compare the scope",
        "A targeted repair and a full replacement solve different problems. Ask why each option is recommended, what remains untouched, and whether there are additional areas likely to need attention. Get the details in writing.",
      ],
      [
        "Look beyond the headline price",
        "For replacement proposals, compare material specifications, tear-off and disposal, decking allowances, flashing, ventilation, permit responsibility, and warranty terms. A low total with missing work can be difficult to compare with a complete scope.",
      ],
      [
        "Leave room for uncertainty",
        "Some conditions are only visible after old roofing is removed. Ask how hidden damage will be documented, priced, and approved before additional work begins. You do not need to decide before you understand the proposal.",
      ],
    ],
  },
  {
    slug: "choosing-a-roofer",
    category: "HIRING WITH CONFIDENCE",
    title: "A practical checklist for choosing a roofer.",
    read: "3 min read",
    intro:
      "A good conversation starts with clear questions. Keep this checklist handy when you speak with a contractor.",
    sections: [
      [
        "Verify the business yourself",
        "Confirm the business name, contact details, and the requirements that apply where the property is located. Request current insurance documentation and check it with the issuing company. RoofZeus does not currently publish a vetted contractor directory.",
      ],
      [
        "Ask for a written scope",
        "The proposal should describe the work, products, exclusions, payment milestones, expected schedule, cleanup, and warranty responsibilities. Ask who will supervise the job and how changes will be approved.",
      ],
      [
        "Check relevant references",
        "Ask about projects with a similar roof type and scope. Independent references and examples of completed work can help you evaluate experience. Take time to compare proposals without pressure.",
      ],
      [
        "Keep your records together",
        "Save the signed agreement, approved changes, invoices, product details, photographs, and warranty documents. Confirm who to contact if an issue appears after the work is complete.",
      ],
    ],
  },
  {
    slug: "prepare-for-roof-inspection",
    category: "BEFORE THE FIRST VISIT",
    title: "Make your roof inspection more useful.",
    read: "3 min read",
    intro:
      "You do not need to climb onto a roof to prepare for an inspection. A few notes and questions can make the visit more productive.",
    sections: [
      [
        "Write down what you noticed",
        "Note the location and timing of leaks, stains, missing materials, or other changes. Include whether symptoms occur during particular weather. Photograph visible conditions only from a safe place.",
      ],
      [
        "Gather the history you have",
        "Previous repair invoices, installation dates, warranty paperwork, and past inspection reports provide context. It is fine if you do not have these records or do not know the age of the roof.",
      ],
      [
        "Agree on the deliverable",
        "Ask whether the inspection includes written findings and photographs, what areas will be assessed, and whether access to an attic or other interior space is needed. Confirm any fee before scheduling.",
      ],
      [
        "Ask about the next decision",
        "Request a distinction between immediate concerns, maintenance, and longer-term planning. If work is recommended, ask for an itemized scope and time to consider it.",
      ],
    ],
  },
] as const;
export const faqs = [
  [
    "Is RoofZeus a roofing contractor?",
    "No. RoofZeus collects roofing requests and helps coordinate possible introductions. The independent contractor you choose is responsible for assessments, quotes, contracts, and work.",
  ],
  [
    "Does it cost anything to submit a request?",
    "No. Submitting a homeowner request is free and does not commit you to hiring anyone. An inspection or roofing work may have a cost; confirm that directly with the contractor before scheduling.",
  ],
  [
    "Can I submit a request from anywhere in the U.S.?",
    "Yes. We accept U.S. project requests, but our contractor network is just getting started. San Antonio is our first pilot market. Availability is checked after review, and a contractor connection is not guaranteed in any location.",
  ],
  [
    "What happens to my information?",
    "RoofZeus uses your details to review and follow up on your request. We ask for your agreement before sharing it with a named contractor. We do not publish your address or contact details in a directory.",
  ],
  [
    "Will I get an instant quote?",
    "No. A roofing professional needs to understand the property and scope before giving a reliable quote. RoofZeus does not generate prices or promise a specific number of quotes.",
  ],
  [
    "What if I have an active leak?",
    "Choose “Active leak / urgent” in the request. This is not an emergency dispatch service, and an immediate response is not guaranteed. If there is an immediate danger, contact local emergency services.",
  ],
] as const;
export type PageMeta = {
  path: string;
  title: string;
  description: string;
  index?: boolean;
};
export const pages: PageMeta[] = [
  {
    path: "/",
    title: "A clearer start to your roofing project | RoofZeus",
    description:
      "Tell us about your roof repair, replacement, storm damage, or inspection. Submit a free roofing request. Local availability is confirmed after review.",
  },
  {
    path: "/find-a-roofer",
    title: "Tell us about your roof | RoofZeus",
    description:
      "Submit your property location and roofing project for review. Free to request, with no obligation to hire.",
    index: false,
  },
  {
    path: "/how-it-works",
    title: "How roofing requests work | RoofZeus",
    description:
      "Learn how RoofZeus reviews your project, checks local availability, and asks before making a contractor introduction.",
  },
  {
    path: "/services",
    title: "Roof repair, replacement & inspections | RoofZeus",
    description:
      "Explore roofing project types and prepare the details for a repair, replacement, storm damage assessment, or inspection.",
  },
  ...services.map((s) => ({
    path: `/services/${s.slug}`,
    title: `${s.name}: plan your next step | RoofZeus`,
    description: s.description,
  })),
  {
    path: "/locations",
    title: "Where we are growing | RoofZeus",
    description:
      "San Antonio is the first RoofZeus pilot market. Submit a U.S. roofing request and we will review local availability.",
  },
  {
    path: "/roofers/tx/san-antonio",
    title: "San Antonio roofing requests & local resources | RoofZeus",
    description:
      "Prepare a San Antonio roofing project with local permit resources and a free request for availability review.",
    index: false,
  },
  {
    path: "/guides",
    title: "A little roofing knowledge goes a long way | RoofZeus",
    description:
      "Practical homeowner guides to planning roofing work, comparing scopes, choosing a roofer, and preparing for an inspection.",
  },
  ...guides.map((g) => ({
    path: `/guides/${g.slug}`,
    title: `${g.title} | RoofZeus`,
    description: g.intro,
  })),
  {
    path: "/for-contractors",
    title: "Grow with RoofZeus | Contractor network & software",
    description:
      "Register interest in the RoofZeus contractor network, or access the existing roofing business management software.",
  },
  {
    path: "/faq",
    title: "Your roofing request questions, answered | RoofZeus",
    description:
      "Answers about costs, availability, privacy, project requests, and how RoofZeus works.",
  },
  {
    path: "/privacy",
    title: "Homeowner privacy | RoofZeus",
    description:
      "How RoofZeus handles homeowner requests, contact information, and contractor introductions.",
    index: false,
  },
  {
    path: "/terms",
    title: "Homeowner service terms | RoofZeus",
    description:
      "Understand the scope of the RoofZeus roofing request and introduction service.",
    index: false,
  },
  {
    path: "/404",
    title: "Page not found | RoofZeus",
    description: "This RoofZeus page could not be found.",
    index: false,
  },
];
