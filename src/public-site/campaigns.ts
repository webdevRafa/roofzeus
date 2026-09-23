export type LandingVariant = "general" | "repair" | "replacement";

export const campaigns = {
  general: {
    path: "/",
    name: "Roofing estimates",
    eyebrow: "A good place to start",
    headline: "Get the right estimate for",
    accent: "your roof.",
    intro:
      "A leak to fix? A roof you’re ready to replace? Tell us a little about your home and what you have in mind.",
    image: "/images/roof-home.webp",
    initialPlan: "",
    title: "Every roof has a different next step.",
    explanation:
      "You don’t need to have all the answers before you start. Choose the project that sounds closest to yours. A roofing professional can assess the roof and explain the work it actually needs.",
    cards: [
      [
        "Something needs fixing",
        "A recurring leak or a few missing shingles can be a reason to ask about a repair.",
        "/roof-repair",
      ],
      [
        "You’re planning a new roof",
        "Get your questions together before comparing materials, scope, and estimates.",
        "/roof-replacement",
      ],
      [
        "You’re still weighing it up",
        "Start with what you know. A contractor’s assessment can help you decide between repair and replacement.",
        "#estimate-funnel",
      ],
    ],
    checklist: [
      "What work is included in the written estimate?",
      "Are cleanup, disposal, and any permits included?",
      "Who handles questions during the project?",
      "What workmanship and material warranties apply?",
    ],
    faqs: [
      [
        "Does RoofZeus do the roofing work?",
        "No. RoofZeus helps homeowners explore roofing estimates and possible introductions. Any inspection, quote, and roofing work would be handled by a separate contractor. You decide who to hire.",
      ],
      [
        "Will I get a price online?",
        "This form gathers your project details; it doesn’t calculate a roof price. The size, condition, access, materials, and work involved all matter. A contractor needs to assess the job before giving a reliable estimate.",
      ],
      [
        "Does it cost anything to submit a request?",
        "RoofZeus does not charge you to submit a request, and you have no obligation to hire. Ask the contractor about any inspection or service fees before arranging a visit.",
      ],
      [
        "Can I try the form now?",
        "Yes. While requests are closed, use sample information to preview the steps. Nothing is sent to a lead buyer or contractor. The page will make it clear when live requests become available.",
      ],
    ],
  },
  replacement: {
    path: "/roof-replacement",
    name: "Roof replacement",
    eyebrow: "Plan your next roof",
    headline: "A new roof starts with",
    accent: "a clear plan.",
    intro:
      "Thinking it’s time for a replacement? Tell us about your roof and your timeline. Start with the details you know—we’ll take it one step at a time.",
    image: "/images/roof-replacement.webp",
    initialPlan: "replacement",
    title: "Know what you’re comparing.",
    explanation:
      "A new roof is a big decision. Before choosing a contractor, ask for the work in writing so you can compare more than the number at the bottom.",
    cards: [
      [
        "The condition",
        "Age is part of the picture. Ask a professional to look at the roof’s condition and explain whether repair or replacement makes sense.",
        "",
      ],
      [
        "The materials",
        "Talk through the look you want, your budget, and the materials that suit your home. Ask what each option includes.",
        "",
      ],
      [
        "The whole job",
        "A useful proposal spells out preparation, installation, cleanup, and how unexpected work will be handled.",
        "",
      ],
    ],
    checklist: [
      "Removal and disposal of the existing roofing",
      "How any damaged roof decking will be priced",
      "Flashing, ventilation, and underlayment details",
      "Materials, schedule, cleanup, and warranty terms",
    ],
    faqs: [
      [
        "How do I know if I need a replacement?",
        "You don’t have to decide from a photo or your roof’s age alone. Ask a roofing professional to assess its condition and explain the options. You can change the project type in our form if a repair sounds more appropriate.",
      ],
      [
        "Can I plan ahead instead of starting immediately?",
        "Yes. Choose the timeframe that fits your plans. If you’re still figuring it out, say so. You don’t need to promise a start date to explore your options.",
      ],
      [
        "Will insurance pay for a new roof?",
        "RoofZeus does not determine insurance coverage. Your insurer can explain what your policy covers. A contractor can document the roof’s condition, but a replacement is not automatically an insurance-covered project.",
      ],
      [
        "What happens after I submit?",
        "When live requests are available, we’ll check for an available referral based on your project and the permission you give. A submission is not a confirmed appointment or a guaranteed estimate. During preview, nothing is sent.",
      ],
    ],
  },
  repair: {
    path: "/roof-repair",
    name: "Roof repair",
    eyebrow: "Let’s start with the problem",
    headline: "A roof problem shouldn’t leave you",
    accent: "guessing.",
    intro:
      "A leak, missing shingles, or a spot that keeps needing attention? Start with what you’ve noticed. You don’t need to diagnose it yourself.",
    image: "/images/roof-repair.webp",
    initialPlan: "repair",
    title: "Tell the roofer what you’ve noticed.",
    explanation:
      "A few details can make the first conversation more useful. Take notes from a safe place and let a professional check the roof itself.",
    cards: [
      [
        "Where it shows up",
        "A ceiling stain, a drip near a window, or a change you can see from the ground gives the contractor a starting point.",
        "",
      ],
      [
        "When it happens",
        "Mention whether the problem follows rain or wind, when you first noticed it, and whether it has happened before.",
        "",
      ],
      [
        "What’s been tried",
        "If the same area has been repaired before, share what you know. Ask how the proposed work addresses the cause.",
        "",
      ],
    ],
    checklist: [
      "What appears to be causing the problem?",
      "Which areas and materials will be repaired?",
      "Could more work be needed after inspection?",
      "What is covered if the same issue returns?",
    ],
    faqs: [
      [
        "Does a leak mean I need a whole new roof?",
        "Not necessarily. A leak needs an assessment to find its source and the extent of the problem. Ask the contractor why they recommend a repair or a replacement and what each option would involve.",
      ],
      [
        "Can you send someone for an emergency?",
        "RoofZeus is not an emergency dispatch service and cannot promise a response time. If water is entering now, contact a local roofing or emergency service directly. Stay off the roof and away from unsafe areas.",
      ],
      [
        "What if the damage happened during a storm?",
        "You can explore repair options here. Note when the storm happened and what you can see safely from the ground. Your insurer—not RoofZeus—determines coverage under your policy.",
      ],
      [
        "Do I have to know my roof material?",
        "Use the form’s material guidance to choose only if you know. If you’re unsure, don’t guess just to move forward; ask a professional or check your home records first.",
      ],
    ],
  },
} as const;

export const creativeConcepts = [
  {
    id: "general-01",
    variant: "general",
    headline: "Roof on your mind?",
    copy: "A leak to fix or a roof you’re ready to replace? Start with your ZIP and a few details about your project. Explore roofing estimate options, with no obligation to hire. Availability varies.",
  },
  {
    id: "replacement-01",
    variant: "replacement",
    headline: "Thinking about a new roof?",
    copy: "A new roof is a big decision. Tell us what you have in mind and when you’re hoping to get started. Explore roofing estimate options for your home, with no obligation to hire. Availability varies.",
  },
  {
    id: "repair-01",
    variant: "repair",
    headline: "A roof problem. A next step.",
    copy: "A leak, missing shingles, or a spot that keeps needing attention? Start with what you’ve noticed. Explore roof repair estimate options, with no obligation to hire. Availability varies. Not an emergency service.",
  },
] as const;
