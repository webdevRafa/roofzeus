export const SITE_URL = "https://roofzeus.com";
export const CONSENT_VERSION = "2026-09-12.2";
export const CONTACT_CONSENT =
  "I agree that RoofZeus may contact me by phone or email about roofing estimates for this property. My information will not be sent to a contractor until I agree to that introduction. I do not have to purchase anything.";
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
export type PageMeta = {
  path: string;
  title: string;
  description: string;
  index?: boolean;
};
export const pages: PageMeta[] = [
  {
    path: "/demo",
    title: "Roofing estimate demo | RoofZeus",
    description:
      "Review the RoofZeus estimate form with sample information. Demo only; no lead is submitted.",
    index: false,
  },
  {
    path: "/",
    title: "Get a roofing estimate for your home | RoofZeus",
    description:
      "Need roof repair or replacement? Enter your ZIP code to explore roofing estimate options. Free to get started, with no obligation to hire.",
  },
  {
    path: "/privacy",
    title: "Privacy | RoofZeus",
    description:
      "How RoofZeus handles your information and contractor introductions.",
    index: false,
  },
  {
    path: "/terms",
    title: "Terms | RoofZeus",
    description: "Terms for the RoofZeus estimate introduction service.",
    index: false,
  },
  {
    path: "/404",
    title: "Page not found | RoofZeus",
    description: "This page could not be found.",
    index: false,
  },
];
