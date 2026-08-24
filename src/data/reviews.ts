// Data model mirrors the UNDP Crisis Response Unit "After Action Review
// Final Report" template: Executive Summary; Introduction; Methodology;
// Analysis of the Response (3.1-3.9); Findings & Recommendations; and the
// Annexes (interviewee list, findings/recommendations matrix).

export type ReviewStatus = "Completed" | "In Progress";
export type ReviewStage =
  | "Awaiting Survey Responses"
  | "Drafting"
  | "Under Review";
export type PriorityLevel = "Very High" | "High" | "Medium" | "Low";

export const crisisTypes = [
  "Natural Disaster",
  "Conflict & Displacement",
  "Public Health Emergency",
  "Complex Emergency",
] as const;

// Widened beyond the preset list so "Other" can carry a custom, free-typed
// value while the fixed options still autocomplete in editors.
export type CrisisType = (typeof crisisTypes)[number] | (string & {});

// The response areas named throughout the template (Executive Summary and
// Annex 7 matrix both organize around this same list).
export const responseAreas = [
  "Corporate Response Mechanisms",
  "Country Office Response Structure and Capacities",
  "Deployments",
  "Programmatic Response",
  "Operational Response",
  "Coordination",
  "Communication and Resource Mobilization",
] as const;

export type ResponseArea = (typeof responseAreas)[number];

export const dataCollectionMethods = [
  "Desk review",
  "Key informant interviews",
  "Focus group discussions",
  "Survey",
  "Crisis Board meeting minutes review",
] as const;

export const priorityLevels: PriorityLevel[] = [
  "Very High",
  "High",
  "Medium",
  "Low",
];

// Survey templates for gathering AAR input from different audiences. The
// official AAR report template (Annex 4) names "interview/survey/focus
// group questions" as a required annex but leaves the questions themselves
// blank, so the question sets below are a drafted starting point — inferred
// from the report's 3.1-3.9 structure and standard AAR practice, not
// sourced from the template. Treat them as a first draft to be reviewed
// before real use.
export type SurveyTemplate = {
  id: string;
  name: string;
  audience: string;
  description: string;
  informsSections: ResponseArea[];
  questions: string[];
  // A short list of role titles seen in real AAR documents for this
  // audience, offered as autocomplete suggestions on the Role field — not
  // exhaustive, and not a restriction on what can be entered.
  suggestedRoles: string[];
};

export const surveyTemplates: SurveyTemplate[] = [
  {
    id: "response-team-debrief",
    name: "Response Team Debrief",
    audience: "Country Office staff directly involved in the response",
    description:
      "Day-to-day account of what worked, what didn't, and where delivery hit friction.",
    informsSections: ["Operational Response", "Programmatic Response", "Deployments"],
    questions: [
      "What was your role during the response, and roughly how long were you actively involved?",
      "Walk through the first two weeks of the response from your perspective — what stands out?",
      "What worked well in how the Country Office mobilized and organized its response?",
      "Where did operational processes (procurement, logistics, HR, finance) create delays or bottlenecks?",
      "If experts or surge personnel were deployed, how well did their arrival align with when they were actually needed?",
      "What programmatic activities had the strongest results, and why?",
      "What is the one change that would have made the biggest difference to your work during this response?",
    ],
    suggestedRoles: [
      "Operations Manager",
      "Operations Specialist",
      "Programme Analyst",
      "Project Analyst",
    ],
  },
  {
    id: "leadership-reflection",
    name: "Leadership & Management Reflection",
    audience: "Resident Rep / Deputy Rep / senior management",
    description:
      "Corporate mechanisms, resourcing decisions, and strategic coordination calls.",
    informsSections: [
      "Corporate Response Mechanisms",
      "Country Office Response Structure and Capacities",
      "Communication and Resource Mobilization",
    ],
    questions: [
      "How would you assess the speed and adequacy of corporate support (Crisis Board activation, funding, roster deployment) once the crisis began?",
      "Did the Country Office have the structure and standing capacity it needed at the moment the crisis hit? What was missing, if anything?",
      "How were priorities and trade-offs decided in the first month, and by whom?",
      "How effective was resource mobilization (donor engagement, appeals, internal funding) in meeting the response's needs?",
      "What corporate policies, procedures, or systems helped — or got in the way — during this response?",
      "Looking back, what would you do differently if a similar crisis happened again next year?",
    ],
    suggestedRoles: [
      "Resident Representative",
      "Former Resident Representative",
      "Deputy Resident Representative",
      "Assistant Resident Representative",
      "Regional Advisor",
    ],
  },
  {
    id: "partner-coordination",
    name: "Partner & Coordination Feedback",
    audience: "External partners, cluster leads, government counterparts",
    description:
      "How coordination and joint planning looked from outside UNDP.",
    informsSections: ["Coordination", "Communication and Resource Mobilization"],
    questions: [
      "How would you describe UNDP's engagement in coordination structures (cluster meetings, joint planning forums) during this response?",
      "Was UNDP's role and added value in the response clear to your organization?",
      "How timely and useful was communication from UNDP throughout the response?",
      "Were there moments where better coordination with UNDP could have improved outcomes for affected communities? Please describe.",
      "How would you rate joint planning and information-sharing with UNDP overall? (1–5)",
      "What would most improve UNDP's coordination with partners like yours in a future response?",
    ],
    // External audience — the CO / Regional / HQ role titles on file don't
    // apply here, so no suggestions are offered; the field stays free text.
    suggestedRoles: [],
  },
  {
    id: "field-frontline",
    name: "Field / Frontline Staff Check-in",
    audience: "Field-based and frontline delivery staff",
    description:
      "Ground-level experience of programmatic delivery and community response.",
    informsSections: ["Programmatic Response", "Operational Response"],
    questions: [
      "What was your day-to-day experience delivering activities during the response?",
      "What resources, supplies, or approvals arrived late — and how did that affect your work?",
      "How did affected communities respond to the assistance provided? Any notable feedback, positive or negative?",
      "Were you clear on your role, reporting lines, and who to contact for urgent issues?",
      "What one thing would make frontline delivery smoother next time?",
    ],
    suggestedRoles: [
      "Programme Specialist",
      "Country Programme Specialist",
      "Project Analyst",
      "Programme Analyst",
    ],
  },
];

export type TimelineEntry = { date: string; event: string };

export type FindingRow = {
  responseArea: ResponseArea;
  finding: string;
  recommendation: string;
  keyActions: string;
  priority: PriorityLevel;
};

export type Interviewee = { name: string; title: string; agency: string };

export type Review = {
  slug: string;
  country: string;
  crisisType: CrisisType;
  countryOfficeFocalPoint?: string;
  crisisBureauFocalPoint?: string;
  regionalBureauFocalPoint?: string;
  title: string;
  summary: string;
  status: ReviewStatus;
  stage?: ReviewStage;
  periodStart: string; // "YYYY-MM"
  periodEnd: string; // "YYYY-MM"
  office: string;
  leadAuthor: string;
  tags: string[];

  executiveSummary: string;

  introduction: {
    countrySituation: string;
    objectives: string;
  };

  methodology: {
    scope: string;
    dataCollectionMethods: string[];
    dataCollection: string;
  };

  analysis: {
    contextualFactors: string;
    timeline: TimelineEntry[];
    inCountryStructure: string;
    corporateResponseMechanisms: string;
    deploymentOfExperts: string;
    programmaticResponse: string;
    operationalResponse: string;
    coordination: string;
    communicationAndResourceMobilization: string;
  };

  keyFindings: string[];
  recommendations: string[];
  findingsMatrix: FindingRow[];
  interviewees: Interviewee[];
};

function year(periodEnd: string) {
  return Number(periodEnd.split("-")[0]);
}

export const reviews: Review[] = [
  {
    slug: "philippines-typhoon-crisis",
    country: "Philippines",
    crisisType: "Natural Disaster",
    title: "Philippines Typhoon Crisis",
    summary:
      "Early recovery programming scaled quickly on the back of strong local government ties, though shelter material pipelines lagged behind needs assessments.",
    status: "Completed",
    periodStart: "2026-01",
    periodEnd: "2026-04",
    office: "Philippines Country Office",
    leadAuthor: "Independent Consultant — A. Reyes",
    tags: ["typhoon", "early recovery", "shelter"],

    executiveSummary:
      "This After Action Review examines UNDP's response to the January–April 2026 typhoon season affecting three regions of the Philippines. The Country Office activated its crisis response plan within 48 hours and stood up an early recovery workstream that reached target caseloads in two of three regions. Shelter material procurement lagged behind needs assessments by several weeks, delaying the transition from emergency to early recovery shelter support. Coordination with the national Office of Civil Defense was a consistent strength throughout the response. This report sets out seven findings across corporate mechanisms, deployments, programmatic and operational response, and coordination, with associated recommendations for the next activation.",

    introduction: {
      countrySituation:
        "Three successive typhoons made landfall between January and March 2026, displacing an estimated 210,000 people across the Bicol and Eastern Visayas regions and damaging critical infrastructure including two provincial hospitals.",
      objectives:
        "The AAR was commissioned by the Crisis Bureau to capture lessons from the activation for the upcoming typhoon season, with a focus on shelter pipeline management and corporate surge deployment timeliness.",
    },

    methodology: {
      scope:
        "The review covers the corporate and country-level response from initial activation through the early recovery transition, excluding longer-term recovery programming beyond June 2026.",
      dataCollectionMethods: [
        "Desk review",
        "Key informant interviews",
        "Survey",
      ],
      dataCollection:
        "The consultant conducted a desk review of Crisis Board minutes and situation reports, 18 key informant interviews with Country Office and regional staff, and an online survey of 34 field-level responders, validated in a findings workshop with the Country Office senior management team.",
    },

    analysis: {
      contextualFactors:
        "A pre-existing early recovery programme and standing agreements with three implementing partners meant the Country Office did not start from zero, which shaped both the speed of the response and where gaps became visible.",
      timeline: [
        { date: "2026-01-14", event: "First typhoon makes landfall in Bicol region" },
        { date: "2026-01-16", event: "Country Office activates crisis response plan" },
        { date: "2026-01-22", event: "Corporate surge roster deployment requested" },
        { date: "2026-02-03", event: "Early recovery workstream launched in two regions" },
        { date: "2026-03-11", event: "Shelter material procurement completed" },
      ],
      inCountryStructure:
        "A dedicated crisis coordinator was appointed within 72 hours, but the operations team remained under-resourced for the scale of parallel procurement processes required across three regions.",
      corporateResponseMechanisms:
        "The Crisis Board convened within the target 24-hour window and approved surge funding on schedule; however, the roster deployment request took nine days to be filled against a five-day target.",
      deploymentOfExperts:
        "Two surge personnel (shelter and operations) were deployed in the first month; a requested third specialist in livelihoods was not filled until week seven.",
      programmaticResponse:
        "Early recovery targets were met in Bicol and one Eastern Visayas province; the third province fell short of caseload targets due to access constraints and the shelter material delay.",
      operationalResponse:
        "Procurement of shelter materials took six weeks against a four-week target, the single largest driver of programmatic delay identified in this review.",
      coordination:
        "Coordination with the Office of Civil Defense and cluster leads was consistently rated highly by field staff and was a clear strength of this response.",
      communicationAndResourceMobilization:
        "A joint appeal with the Resident Coordinator's office secured 80% of the funding target within the first six weeks, aided by early, consistent situation reporting.",
    },

    keyFindings: [
      "Shelter material procurement was the single largest bottleneck between assessment and delivery, consistently cited across interviews and the survey.",
      "Corporate roster deployment took nearly twice the target window, delaying specialist input during the critical first month.",
      "Coordination with national civil defense structures was a clear strength and accelerated access negotiations.",
    ],
    recommendations: [
      "Pre-position shelter material framework agreements with at least two suppliers ahead of the next typhoon season.",
      "Review the corporate roster activation process to identify where the nine-day fill time can be compressed toward the five-day target.",
      "Document the civil defense coordination model as a good-practice case for other disaster-prone country offices.",
    ],
    findingsMatrix: [
      {
        responseArea: "Operational Response",
        finding:
          "Shelter material procurement took six weeks against a four-week target.",
        recommendation:
          "Pre-position framework agreements with at least two shelter material suppliers.",
        keyActions:
          "Operations team to issue a long-term agreement tender ahead of the next typhoon season.",
        priority: "Very High",
      },
      {
        responseArea: "Corporate Response Mechanisms",
        finding:
          "Roster deployment took nine days against a five-day target.",
        recommendation:
          "Review and streamline the corporate roster activation workflow.",
        keyActions:
          "Crisis Bureau to audit the deployment approval chain and identify redundant sign-offs.",
        priority: "High",
      },
      {
        responseArea: "Coordination",
        finding:
          "Coordination with the Office of Civil Defense accelerated access and joint planning.",
        recommendation:
          "Document this coordination model as good practice for other country offices.",
        keyActions:
          "Country Office to prepare a short case study for the regional lessons-learned repository.",
        priority: "Medium",
      },
    ],
    interviewees: [
      { name: "Maria Santos", title: "Deputy Resident Representative", agency: "UNDP Philippines" },
      { name: "Jon Dela Cruz", title: "Crisis Coordinator", agency: "UNDP Philippines" },
      { name: "Liza Fernandez", title: "Regional Director, Bicol", agency: "Office of Civil Defense" },
      { name: "Peter Okafor", title: "Shelter Cluster Lead", agency: "IOM" },
    ],
  },

  {
    slug: "sudan-displacement-crisis",
    country: "Sudan",
    crisisType: "Conflict & Displacement",
    title: "Sudan Displacement Crisis",
    summary:
      "Remote programme management sustained delivery across active conflict lines, but resource mobilization fell well short of the revised appeal target.",
    status: "Completed",
    periodStart: "2024-11",
    periodEnd: "2025-06",
    office: "Sudan Country Office / Regional Bureau for Africa",
    leadAuthor: "Regional Bureau for Africa AAR Team",
    tags: ["conflict", "displacement", "remote management"],

    executiveSummary:
      "This review assesses UNDP Sudan's response between November 2024 and June 2025, a period marked by intensified conflict and mass internal displacement. The Country Office relocated core operations to Port Sudan while maintaining a remote management model for programming in contested areas. Programmatic continuity was largely sustained through local partner networks, though resource mobilization reached only 46% of the revised appeal target, constraining the scale-up originally planned for early 2025. The full underlying evidence base, including the desk review bibliography and detailed interview notes, is maintained on the linked SharePoint site.",

    introduction: {
      countrySituation:
        "Continued fighting between national forces displaced an additional 3.2 million people during the review period, with UNDP's operational area shrinking to remote management across several states.",
      objectives:
        "The AAR was commissioned to assess the effectiveness of the remote management model and to inform resource mobilization strategy ahead of the next Country Programme Document cycle.",
    },

    methodology: {
      scope:
        "The review covers corporate and country-level programmatic and operational response from the relocation of core operations through the end of the reporting period.",
      dataCollectionMethods: [
        "Desk review",
        "Key informant interviews",
        "Focus group discussions",
        "Crisis Board meeting minutes review",
      ],
      dataCollection:
        "Given continued access constraints, data collection relied heavily on remote key informant interviews and focus group discussions with local partner staff, supplemented by a desk review of Crisis Board minutes and partner reporting. Full transcripts are available in the Annex 5 file on SharePoint.",
    },

    analysis: {
      contextualFactors:
        "Volatile and shifting front lines meant operational planning assumptions had to be revised on a near-monthly basis, placing significant strain on both programme and operations teams.",
      timeline: [
        { date: "2024-11-08", event: "Core operations relocate to Port Sudan" },
        { date: "2024-12-02", event: "Remote management model formally adopted" },
        { date: "2025-01-20", event: "Revised humanitarian appeal launched" },
        { date: "2025-03-15", event: "Local partner network expanded to six additional states" },
        { date: "2025-06-01", event: "Mid-year review of remote management effectiveness" },
      ],
      inCountryStructure:
        "A slimmed-down core team operated from Port Sudan, with programme delivery increasingly delegated to a vetted network of national NGOs under a remote monitoring framework.",
      corporateResponseMechanisms:
        "The Crisis Board maintained monthly review cadence throughout the period, which staff credited with keeping corporate leadership realistically informed of access constraints.",
      deploymentOfExperts:
        "Security constraints limited international deployments; two remote-based advisory positions (early recovery, protection mainstreaming) were filled and functioned effectively.",
      programmaticResponse:
        "Local livelihoods and community infrastructure programming continued in six states through partners, though new activity starts were paused in three states due to access denial.",
      operationalResponse:
        "Third-party monitoring arrangements were put in place within ten weeks of the relocation, enabling continued financial oversight of partner-implemented activities.",
      coordination:
        "Coordination with the Resident/Humanitarian Coordinator's office and the inter-agency Early Recovery Cluster remained active despite the relocation, largely through virtual mechanisms.",
      communicationAndResourceMobilization:
        "The revised appeal reached only 46% of its funding target, which the review attributes in part to donor fatigue and in part to limited dedicated resource mobilization capacity during the relocation period.",
    },

    keyFindings: [
      "The remote management model sustained programme continuity in six states despite the relocation of core operations.",
      "Resource mobilization reached only 46% of the revised appeal target, constraining planned scale-up.",
      "Third-party monitoring was established within ten weeks, faster than comparable prior activations.",
    ],
    recommendations: [
      "Establish a dedicated resource mobilization surge position for protracted crisis contexts before appeal targets are set.",
      "Formalize the remote management and third-party monitoring model as a standing corporate option for access-constrained contexts.",
      "Expand the local partner vetting roster proactively in states at elevated risk of access denial.",
    ],
    findingsMatrix: [
      {
        responseArea: "Communication and Resource Mobilization",
        finding:
          "The revised appeal reached only 46% of its funding target.",
        recommendation:
          "Establish a dedicated resource mobilization surge position for protracted crisis contexts.",
        keyActions:
          "Regional Bureau to fund a 12-month resource mobilization specialist position.",
        priority: "Very High",
      },
      {
        responseArea: "Operational Response",
        finding:
          "Third-party monitoring was operational within ten weeks of relocation.",
        recommendation:
          "Formalize this model as a standing corporate option for access-constrained contexts.",
        keyActions:
          "BPPS to codify the third-party monitoring framework in corporate crisis SOPs.",
        priority: "Medium",
      },
      {
        responseArea: "Programmatic Response",
        finding:
          "New activity starts were paused in three states due to access denial.",
        recommendation:
          "Expand the local partner vetting roster proactively in at-risk states.",
        keyActions:
          "Country Office to pre-vet at least two additional partners per at-risk state.",
        priority: "High",
      },
    ],
    interviewees: [
      { name: "Amina Hassan", title: "Deputy Resident Representative", agency: "UNDP Sudan" },
      { name: "Tarek Suleiman", title: "Head of Remote Programme Management", agency: "UNDP Sudan" },
      { name: "Grace Lomu", title: "Early Recovery Cluster Coordinator", agency: "OCHA" },
    ],
  },

  {
    slug: "mozambique-cyclone-response",
    country: "Mozambique",
    crisisType: "Natural Disaster",
    title: "Mozambique Cyclone Response",
    summary:
      "Rapid activation and strong data-collection discipline stood out, but the review flags gaps in handover documentation between surge and standing teams.",
    status: "Completed",
    periodStart: "2025-02",
    periodEnd: "2025-05",
    office: "Mozambique Country Office",
    leadAuthor: "Independent Consultant — F. Nascimento",
    tags: ["cyclone", "coastal", "handover"],

    executiveSummary:
      "This After Action Review covers UNDP Mozambique's response to a category 4 cyclone that struck Sofala and Zambezia provinces in February 2025. The Country Office activation was rapid and well documented, and post-cyclone needs data collection was consistently praised by interviewees. The review's principal finding concerns the handover between corporate surge personnel and standing Country Office staff at the end of the emergency phase, where incomplete documentation created a gap in institutional knowledge during the transition to early recovery.",

    introduction: {
      countrySituation:
        "The cyclone made landfall on 9 February 2025, affecting an estimated 780,000 people and destroying or damaging over 60,000 homes across two provinces.",
      objectives:
        "The Country Office commissioned this AAR to capture lessons on surge-to-standing team handover ahead of the next cyclone season.",
    },

    methodology: {
      scope:
        "The review covers the period from cyclone landfall through the formal close of the emergency phase in May 2025.",
      dataCollectionMethods: ["Desk review", "Key informant interviews", "Survey"],
      dataCollection:
        "The consultant reviewed situation reports and handover documentation, conducted 14 key informant interviews, and surveyed 21 responders including surge and standing staff.",
    },

    analysis: {
      contextualFactors:
        "This was the third major cyclone to affect the same provinces in five years, meaning local government counterparts and communities were relatively well drilled in response procedures.",
      timeline: [
        { date: "2025-02-09", event: "Cyclone makes landfall in Sofala province" },
        { date: "2025-02-11", event: "Corporate surge team deployed" },
        { date: "2025-03-05", event: "Joint rapid needs assessment completed" },
        { date: "2025-04-20", event: "Surge-to-standing team handover begins" },
        { date: "2025-05-15", event: "Emergency phase formally closed" },
      ],
      inCountryStructure:
        "Standing Country Office capacity was limited to two programme staff at the time of landfall, making the surge deployment critical to the initial response.",
      corporateResponseMechanisms:
        "The Crisis Board approved emergency funding within 18 hours, among the fastest activations reviewed in the current AAR cycle.",
      deploymentOfExperts:
        "Three surge personnel were deployed within 72 hours covering assessment, coordination, and operations; all three departed by the handover date.",
      programmaticResponse:
        "Emergency shelter and livelihoods support reached target caseloads in both provinces within the emergency phase window.",
      operationalResponse:
        "Procurement and logistics performed well, aided by pre-existing framework agreements from the prior cyclone response.",
      coordination:
        "Coordination with the National Disaster Management Institute was effective, building on relationships from previous activations.",
      communicationAndResourceMobilization:
        "The flash appeal was 92% funded within the emergency phase, the strongest resource mobilization outcome among the reviews in this cycle.",
    },

    keyFindings: [
      "Handover documentation between surge and standing staff was incomplete, creating a knowledge gap at the start of the early recovery phase.",
      "Pre-existing framework agreements from a prior cyclone response meaningfully accelerated procurement.",
      "The flash appeal reached 92% of its funding target, the strongest resource mobilization result reviewed this cycle.",
    ],
    recommendations: [
      "Introduce a mandatory structured handover checklist and briefing period before surge personnel depart.",
      "Maintain standing framework agreements for shelter and logistics between cyclone seasons rather than re-tendering each time.",
      "Capture the resource mobilization approach used here as a model for other coastal country offices.",
    ],
    findingsMatrix: [
      {
        responseArea: "Country Office Response Structure and Capacities",
        finding:
          "Handover documentation between surge and standing staff was incomplete.",
        recommendation:
          "Introduce a mandatory structured handover checklist and overlap period.",
        keyActions:
          "Crisis Bureau to add a handover checklist to standard surge deployment terms of reference.",
        priority: "High",
      },
      {
        responseArea: "Operational Response",
        finding:
          "Pre-existing framework agreements accelerated procurement significantly.",
        recommendation:
          "Maintain standing framework agreements between cyclone seasons.",
        keyActions:
          "Operations team to renew agreements annually ahead of cyclone season.",
        priority: "Medium",
      },
    ],
    interviewees: [
      { name: "Isabel Machado", title: "Resident Representative", agency: "UNDP Mozambique" },
      { name: "Carlos Mbeki", title: "Surge Coordination Lead", agency: "UNDP Crisis Bureau" },
      { name: "Ana Chissano", title: "Director", agency: "National Disaster Management Institute" },
    ],
  },

  {
    slug: "turkiye-syria-earthquake-response",
    country: "Türkiye & Syria",
    crisisType: "Natural Disaster",
    title: "Türkiye–Syria Earthquake Response",
    summary:
      "A large, fast, multi-country deployment revealed strong crisis mechanisms overall, with cross-border coordination identified as the area needing most improvement.",
    status: "Completed",
    periodStart: "2023-02",
    periodEnd: "2024-02",
    office: "Türkiye Country Office / Syria Country Office",
    leadAuthor: "Regional Bureau for Arab States AAR Team",
    tags: ["earthquake", "cross-border", "multi-country"],

    executiveSummary:
      "This After Action Review covers UNDP's twelve-month response to the February 2023 earthquakes affecting southern Türkiye and northern Syria, one of the largest simultaneous activations in the organization's recent history. The response drew on corporate mechanisms in both countries concurrently, with over 40 surge personnel deployed across the two operations. Programmatic and operational response was strong in both country contexts individually; the review's central finding is that cross-border coordination between the two country teams was largely informal and could have been more deliberately structured given the shared affected population along the border region.",

    introduction: {
      countrySituation:
        "Two major earthquakes on 6 February 2023 affected an area spanning eleven provinces in Türkiye and multiple governorates in northern Syria, resulting in over 55,000 deaths and widespread infrastructure destruction.",
      objectives:
        "Given the scale and cross-border nature of this response, the Crisis Bureau commissioned a joint AAR spanning both country operations to capture cross-border coordination lessons specifically.",
    },

    methodology: {
      scope:
        "The review covers both the Türkiye and Syria country office responses from the earthquake through the one-year mark, with particular attention to points of interaction between the two operations.",
      dataCollectionMethods: [
        "Desk review",
        "Key informant interviews",
        "Focus group discussions",
        "Crisis Board meeting minutes review",
      ],
      dataCollection:
        "The team conducted 31 key informant interviews across both country offices and the Regional Bureau, three focus group discussions with field staff, and a desk review of corporate and country-level response documentation from both operations.",
    },

    analysis: {
      contextualFactors:
        "The two country operations had different starting points: Türkiye had an established Country Office with significant capacity, while the Syria operation was already managing a protracted crisis response, shaping very different response postures.",
      timeline: [
        { date: "2023-02-06", event: "Earthquakes strike southern Türkiye and northern Syria" },
        { date: "2023-02-07", event: "Crisis Board activates joint response coordination call" },
        { date: "2023-02-14", event: "Surge deployments reach both country offices" },
        { date: "2023-05-01", event: "Joint early recovery framework published" },
        { date: "2024-02-06", event: "One-year review milestone" },
      ],
      inCountryStructure:
        "Both country offices stood up dedicated response structures within a week; Türkiye's larger standing capacity allowed for faster in-house scale-up than Syria's.",
      corporateResponseMechanisms:
        "The Crisis Board held a joint coordination call within 24 hours involving both country teams and the Regional Bureau, an arrangement staff cited as valuable but not repeated with regularity afterward.",
      deploymentOfExperts:
        "Over 40 surge personnel were deployed across both operations within the first month, the largest simultaneous deployment reviewed in this AAR cycle.",
      programmaticResponse:
        "Both operations met or exceeded initial caseload targets for emergency shelter and livelihoods support within their respective contexts.",
      operationalResponse:
        "Procurement and logistics scaled effectively in Türkiye; in Syria, existing cross-border procedures were leveraged, though with some duplication of effort against the Türkiye-side supply chain.",
      coordination:
        "Within each country, coordination with national authorities and cluster mechanisms was strong; cross-border coordination between the two UNDP operations was largely ad hoc and dependent on individual relationships rather than a defined structure.",
      communicationAndResourceMobilization:
        "A joint flash appeal secured strong early funding; separate country-level communications products afterward diluted the shared narrative of the cross-border response.",
    },

    keyFindings: [
      "Cross-border coordination between the Türkiye and Syria operations was largely informal, despite the shared affected population along the border.",
      "The initial joint Crisis Board coordination call was highly valued by staff but was not sustained on a regular cadence.",
      "Some duplication occurred in supply chain arrangements between the two operations that a shared logistics view could have reduced.",
    ],
    recommendations: [
      "Establish a standing joint coordination mechanism for future multi-country activations affecting a shared border region.",
      "Maintain a recurring joint Crisis Board call for the duration of any cross-border activation, not only at the point of activation.",
      "Create a shared supply chain visibility tool for neighboring country operations responding to the same event.",
    ],
    findingsMatrix: [
      {
        responseArea: "Coordination",
        finding:
          "Cross-border coordination between the two operations was largely informal.",
        recommendation:
          "Establish a standing joint coordination mechanism for cross-border activations.",
        keyActions:
          "Regional Bureau to define a joint coordination structure in corporate crisis SOPs.",
        priority: "Very High",
      },
      {
        responseArea: "Corporate Response Mechanisms",
        finding:
          "The initial joint Crisis Board call was not sustained on a regular cadence.",
        recommendation:
          "Maintain a recurring joint Crisis Board call for the duration of cross-border activations.",
        keyActions:
          "Crisis Bureau to schedule recurring joint calls as a default for multi-country activations.",
        priority: "High",
      },
      {
        responseArea: "Operational Response",
        finding:
          "Some duplication occurred in supply chain arrangements between the two operations.",
        recommendation:
          "Create a shared supply chain visibility tool for neighboring operations.",
        keyActions:
          "BMS to scope a lightweight shared logistics tracker for cross-border activations.",
        priority: "Medium",
      },
    ],
    interviewees: [
      { name: "Selin Aydın", title: "Deputy Resident Representative", agency: "UNDP Türkiye" },
      { name: "Rami Haddad", title: "Head of Early Recovery", agency: "UNDP Syria" },
      { name: "Omar Khalil", title: "Regional Crisis Advisor", agency: "UNDP Regional Bureau for Arab States" },
    ],
  },

  {
    slug: "haiti-compound-crisis",
    country: "Haiti",
    crisisType: "Complex Emergency",
    title: "Haiti Compound Crisis",
    summary:
      "In-progress review of the ongoing response to compounding gang violence, displacement, and cholera resurgence; drafting is underway ahead of the first Crisis Board review.",
    status: "In Progress",
    stage: "Drafting",
    periodStart: "2025-08",
    periodEnd: "2026-06",
    office: "Haiti Country Office",
    leadAuthor: "Independent Consultant — J. Belliard",
    tags: ["complex emergency", "displacement", "public health"],

    executiveSummary:
      "Draft in progress. This section will summarize UNDP's response to the compounding crisis in Haiti involving displacement from gang violence, disrupted service delivery, and a cholera resurgence, once analysis of the response is finalized.",

    introduction: {
      countrySituation:
        "Escalating gang violence in the metropolitan area has displaced an estimated 400,000 people since August 2025, coinciding with a resurgence of cholera cases in three departments.",
      objectives:
        "The AAR aims to capture lessons on operating under severe access and security constraints across simultaneous, compounding crisis drivers.",
    },

    methodology: {
      scope: "Draft scope: response from August 2025 through the present reporting period.",
      dataCollectionMethods: ["Desk review", "Key informant interviews"],
      dataCollection:
        "Initial key informant interviews are underway with remaining Country Office staff; a survey of field partners is planned for the next drafting cycle.",
    },

    analysis: {
      contextualFactors:
        "Security conditions have restricted movement of both staff and partners for extended periods, and this is shaping much of the draft analysis so far.",
      timeline: [
        { date: "2025-08-14", event: "Escalation in gang-related violence prompts security phase change" },
        { date: "2025-09-30", event: "Cholera resurgence confirmed in Artibonite department" },
        { date: "2026-01-10", event: "Remote operating protocol adopted for metropolitan area" },
      ],
      inCountryStructure: "Draft pending further interviews with the Country Office senior management team.",
      corporateResponseMechanisms: "Draft pending review of Crisis Board minutes for this period.",
      deploymentOfExperts: "Draft pending confirmation of surge deployment records.",
      programmaticResponse: "Draft pending partner reporting review.",
      operationalResponse: "Draft pending operations team interviews.",
      coordination: "Draft pending interviews with the Humanitarian Coordinator's office.",
      communicationAndResourceMobilization: "Draft pending resource mobilization team interviews.",
    },

    keyFindings: [],
    recommendations: [],
    findingsMatrix: [],
    interviewees: [
      { name: "Nadège Pierre", title: "Deputy Resident Representative", agency: "UNDP Haiti" },
    ],
  },

  {
    slug: "papua-new-guinea-earthquake-response",
    country: "Papua New Guinea",
    crisisType: "Natural Disaster",
    title: "Papua New Guinea Earthquake Response",
    summary:
      "Draft findings on the highlands earthquake response are complete and currently with the Country Office for review ahead of validation.",
    status: "In Progress",
    stage: "Drafting",
    periodStart: "2026-02",
    periodEnd: "2026-05",
    office: "Papua New Guinea Country Office",
    leadAuthor: "Independent Consultant — T. Kaupa",
    tags: ["earthquake", "highlands", "remote access"],

    executiveSummary:
      "Draft complete, under Country Office review. This review examines UNDP's response to a magnitude 6.9 earthquake affecting the Highlands region in February 2026, with a focus on the operational challenges of reaching remote, road-inaccessible communities.",

    introduction: {
      countrySituation:
        "The earthquake affected an estimated 90,000 people across three highland provinces, with landslides cutting off road access to several affected districts for over three weeks.",
      objectives:
        "The AAR was commissioned to assess the effectiveness of air-bridge logistics arrangements used to reach road-inaccessible communities.",
    },

    methodology: {
      scope:
        "The review covers the response from the earthquake through the transition to early recovery in May 2026.",
      dataCollectionMethods: ["Desk review", "Key informant interviews", "Survey"],
      dataCollection:
        "The consultant conducted 12 key informant interviews and a survey of 19 field responders; findings were shared in draft with the Country Office in June 2026 and are currently under review ahead of a validation workshop.",
    },

    analysis: {
      contextualFactors:
        "Chronic road inaccessibility in the highlands meant air-bridge logistics were a pre-existing operational competency the Country Office could draw on quickly.",
      timeline: [
        { date: "2026-02-11", event: "Earthquake strikes Highlands region" },
        { date: "2026-02-13", event: "Air-bridge logistics arrangement activated" },
        { date: "2026-03-20", event: "Road access partially restored to two districts" },
        { date: "2026-05-05", event: "Transition to early recovery begins" },
      ],
      inCountryStructure:
        "A small standing Country Office team was supplemented by two surge personnel focused on logistics and assessment.",
      corporateResponseMechanisms:
        "The Crisis Board approved emergency funding within 36 hours, slightly outside the target window due to a public holiday delay.",
      deploymentOfExperts:
        "Two surge personnel were deployed within the first two weeks; a requested logistics specialist arrived later than planned due to visa processing delays.",
      programmaticResponse:
        "Emergency programming reached two of three affected districts within target timeframes; the third remained access-constrained throughout the review period.",
      operationalResponse:
        "The air-bridge logistics arrangement, while costly, was identified by field staff as the single factor that made the response possible in two otherwise inaccessible districts.",
      coordination:
        "Coordination with provincial disaster committees was described as functional but hampered by inconsistent communications infrastructure in the highlands.",
      communicationAndResourceMobilization:
        "Resource mobilization is still being assessed; preliminary figures suggest the appeal is tracking below target, to be confirmed in the next draft.",
    },

    keyFindings: [
      "Air-bridge logistics, while costly, was the deciding factor in reaching two otherwise inaccessible districts.",
      "Visa processing delays pushed back the arrival of a requested logistics specialist by several weeks.",
    ],
    recommendations: [
      "Pre-negotiate air-bridge logistics framework arrangements ahead of the next highlands earthquake season.",
      "Review visa pre-clearance procedures for surge personnel deploying to Papua New Guinea.",
    ],
    findingsMatrix: [
      {
        responseArea: "Operational Response",
        finding:
          "The air-bridge logistics arrangement was the deciding factor in reaching two otherwise inaccessible districts.",
        recommendation:
          "Pre-negotiate air-bridge logistics framework arrangements ahead of the next earthquake season.",
        keyActions:
          "Operations team to scope standing air-bridge agreements with regional carriers.",
        priority: "High",
      },
      {
        responseArea: "Deployments",
        finding:
          "Visa processing delays pushed back the arrival of a requested logistics specialist.",
        recommendation:
          "Review visa pre-clearance procedures for surge personnel.",
        keyActions:
          "Crisis Bureau to explore standing visa pre-clearance arrangements for the surge roster.",
        priority: "Medium",
      },
    ],
    interviewees: [
      { name: "Peter Namaliu", title: "Resident Representative", agency: "UNDP Papua New Guinea" },
      { name: "Susan Waffi", title: "Logistics Surge Specialist", agency: "UNDP Crisis Bureau" },
    ],
  },
];

export function getReviewBySlug(slug: string) {
  return reviews.find((review) => review.slug === slug);
}

export function reviewYear(review: Review) {
  return year(review.periodEnd);
}

export const statusStyles: Record<
  ReviewStage | ReviewStatus,
  { badge: string; dot: string }
> = {
  Completed: {
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    dot: "bg-emerald-500",
  },
  "In Progress": {
    badge: "bg-un-gold-100 text-un-gold-600 ring-1 ring-un-gold-500/30",
    dot: "bg-un-gold-500",
  },
  Drafting: {
    badge: "bg-slate-100 text-slate-600 ring-1 ring-slate-300",
    dot: "bg-slate-400",
  },
  "Awaiting Survey Responses": {
    badge: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
    dot: "bg-orange-500",
  },
  "Under Review": {
    badge: "bg-violet-50 text-violet-700 ring-1 ring-violet-200",
    dot: "bg-violet-500",
  },
};

export const priorityStyles: Record<PriorityLevel, string> = {
  "Very High": "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  High: "bg-un-gold-100 text-un-gold-600 ring-1 ring-un-gold-500/30",
  Medium: "bg-un-blue-50 text-un-blue-700 ring-1 ring-un-blue-200",
  Low: "bg-slate-100 text-slate-600 ring-1 ring-slate-300",
};
