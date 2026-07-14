export type ReviewStatus = "Approved" | "In Review" | "Draft";

export type Review = {
  slug: string;
  title: string;
  status: ReviewStatus;
  category: string;
  office: string;
  location: string;
  eventDate: string;
  summary: string;
  tags: string[];
  sections: {
    context: string;
    whatWorked: string[];
    challenges: string[];
    recommendations: string[];
  };
};

export const categories = [
  "Humanitarian",
  "Operations",
  "Training",
  "Peacekeeping",
  "Public Health",
] as const;

export const reviews: Review[] = [
  {
    slug: "humanitarian-logistics-drill",
    title: "Humanitarian Logistics Drill",
    status: "Approved",
    category: "Humanitarian",
    office: "Logistics Cell",
    location: "Cross-border aid corridor, Sector 4",
    eventDate: "2026-05-14",
    summary:
      "The team coordinated transport access with strong local partnerships, though customs delays reduced the speed of delivery to the final distribution point.",
    tags: ["logistics", "cross-border", "coordination"],
    sections: {
      context:
        "A simulated cross-border aid corridor deployment was run to test coordination between logistics, local partners, and volunteer teams ahead of the regional response window.",
      whatWorked: [
        "Clear communication between field teams and headquarters throughout the exercise.",
        "Rapid shift to alternate routes when the primary corridor was blocked.",
        "Strong volunteer engagement and turnout at the staging point.",
      ],
      challenges: [
        "Lack of pre-approved customs documentation delayed relief movement by nearly two hours during the first wave.",
        "Radio handoff between the first and second convoy teams was inconsistent.",
      ],
      recommendations: [
        "Pre-clear customs documentation templates for the three most likely corridor routes.",
        "Adopt a shared handoff checklist for convoy transitions.",
      ],
    },
  },
  {
    slug: "community-outreach-workshop",
    title: "Community Outreach Workshop",
    status: "In Review",
    category: "Training",
    office: "Partnerships Unit",
    location: "Regional community centre",
    eventDate: "2026-05-02",
    summary:
      "The workshop generated strong participation and useful feedback, but the follow-up plan needs more structure to support communities after the event.",
    tags: ["outreach", "training", "community"],
    sections: {
      context:
        "A local resilience engagement workshop was held to build relationships with community leaders and gather feedback on planned assistance programmes.",
      whatWorked: [
        "Participants responded positively to the facilitation format.",
        "Practical demonstrations were well received and generated discussion.",
      ],
      challenges: [
        "No structured follow-up plan existed for participants who wanted more support after the session.",
      ],
      recommendations: [
        "Create a post-event support package with follow-up calls, resource links, and a referral pathway.",
        "Assign a named point of contact for each community group before the next workshop.",
      ],
    },
  },
  {
    slug: "emergency-coordination-simulation",
    title: "Emergency Coordination Simulation",
    status: "Draft",
    category: "Operations",
    office: "Crisis Response Team",
    location: "Joint operations centre",
    eventDate: "2026-04-21",
    summary:
      "The simulation improved interagency coordination and clarified the decision tree for rapid response, although roles were sometimes overlapping.",
    tags: ["simulation", "interagency", "crisis response"],
    sections: {
      context:
        "A joint crisis simulation tested communication channels and decision-making authority across partner agencies under time pressure.",
      whatWorked: [
        "Escalation paths were followed correctly once triggered.",
        "Partner agencies joined the shared coordination channel within the target window.",
      ],
      challenges: [
        "Decision authority for information sharing was not pre-assigned, causing duplication in the first thirty minutes.",
        "Overlapping roles between two response leads created confusion during the second scenario.",
      ],
      recommendations: [
        "Pre-assign decision authority for information sharing before the next exercise.",
        "Streamline escalation steps to remove duplication in the opening response window.",
      ],
    },
  },
  {
    slug: "regional-health-outreach-campaign",
    title: "Regional Health Outreach Campaign",
    status: "Approved",
    category: "Public Health",
    office: "Health Programmes Office",
    location: "Three district health posts",
    eventDate: "2026-03-30",
    summary:
      "The campaign reached more households than projected, driven by strong community health worker mobilization, though cold-chain logistics remained a constraint.",
    tags: ["public health", "outreach", "vaccination"],
    sections: {
      context:
        "A three-district campaign combined mobile clinics and household visits to expand reach ahead of the seasonal risk period.",
      whatWorked: [
        "Community health workers exceeded household visit targets in two of three districts.",
        "Mobile clinic scheduling adapted well to local market days, improving turnout.",
      ],
      challenges: [
        "Cold-chain capacity limited the volume that could be distributed per site per day.",
        "Data collection forms were duplicated across two reporting systems.",
      ],
      recommendations: [
        "Add a second portable cold-chain unit for the highest-volume district.",
        "Consolidate reporting into a single data collection form before the next campaign.",
      ],
    },
  },
  {
    slug: "peacekeeping-patrol-handover",
    title: "Peacekeeping Patrol Handover",
    status: "Approved",
    category: "Peacekeeping",
    office: "Force Headquarters",
    location: "Sector East, Forward Operating Base 3",
    eventDate: "2026-03-11",
    summary:
      "The rotation handover was completed on schedule with strong documentation continuity, with minor gaps in local liaison contact transfer.",
    tags: ["peacekeeping", "handover", "rotation"],
    sections: {
      context:
        "An incoming contingent assumed patrol responsibility from the outgoing unit at Forward Operating Base 3, including area familiarization and liaison introductions.",
      whatWorked: [
        "Handover documentation was complete and delivered ahead of schedule.",
        "Joint patrols during the transition week built familiarity with the terrain.",
      ],
      challenges: [
        "Several local liaison contacts were not formally reintroduced to the incoming unit.",
      ],
      recommendations: [
        "Schedule joint introductory meetings with all standing local liaison contacts during every handover week.",
      ],
    },
  },
  {
    slug: "disaster-response-tabletop-exercise",
    title: "Disaster Response Tabletop Exercise",
    status: "In Review",
    category: "Operations",
    office: "Emergency Preparedness Office",
    location: "Headquarters, situation room",
    eventDate: "2026-02-18",
    summary:
      "The tabletop exercise surfaced gaps in inter-office communication protocols during a simulated flood scenario affecting three field offices.",
    tags: ["preparedness", "tabletop", "flood scenario"],
    sections: {
      context:
        "A tabletop exercise simulated a fast-onset flood scenario across three field offices to test activation of the emergency preparedness plan.",
      whatWorked: [
        "The core response team activated within the target 45-minute window.",
        "Situation reports were produced on schedule throughout the exercise.",
      ],
      challenges: [
        "Two field offices were unclear on which channel to use for urgent versus routine updates.",
      ],
      recommendations: [
        "Publish a one-page channel guide distinguishing urgent and routine communication paths.",
      ],
    },
  },
];

export function getReviewBySlug(slug: string) {
  return reviews.find((review) => review.slug === slug);
}

export const statusStyles: Record<
  ReviewStatus,
  { badge: string; dot: string }
> = {
  Approved: {
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    dot: "bg-emerald-500",
  },
  "In Review": {
    badge: "bg-un-gold-100 text-un-gold-600 ring-1 ring-un-gold-500/30",
    dot: "bg-un-gold-500",
  },
  Draft: {
    badge: "bg-slate-100 text-slate-600 ring-1 ring-slate-300",
    dot: "bg-slate-400",
  },
};
