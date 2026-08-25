"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  crisisTypes,
  dataCollectionMethods,
  type CrisisType,
  type FindingRow,
  type Interviewee,
  type ResponseArea,
  type ReviewStatus,
  type TimelineEntry,
} from "@/data/reviews";
import { formatPeriod } from "@/lib/format";
import {
  createInvite,
  deleteInvite,
  getRecord,
  listInvites,
  listSurveyTemplates,
  markInviteSent,
  saveRecord,
  sendInvite,
  type AarOverview as OverviewState,
  type AarRecord,
  type DocumentSource,
  type ReportDraft as Draft,
  type SurveyInvite,
  type SurveyTemplate,
} from "@/lib/aar-store";
import {
  AccordionArtifact,
  ArtifactField,
  Bibliography,
  DocIcon,
  Field,
  IntervieweeField,
  MatrixField,
  MAX_FILE_BYTES,
  Panel,
  TimelineField,
  UploadIcon,
  formatBytes,
  readFileAsBase64,
} from "@/components/report-editor";

const STEPS = [
  { id: 1, label: "AAR Basics" },
  { id: 2, label: "Send Surveys" },
  { id: 3, label: "Sources" },
  { id: 4, label: "Draft" },
] as const;
type Step = (typeof STEPS)[number]["id"];

const DEFAULT_PROMPT = `You are an expert consultant specializing in After Action Reviews (AARs) for international development organizations, drafting a review for the UNDP Crisis Response Unit that follows the official AAR Final Report template.

Read and synthesize all attached source documents and any notes provided, and extract the relevant facts for each section. Distinguish between corporate/HQ-level and Country Office-level decisions and action where the sources support it, and build the timeline from documented events rather than impressions. Where the sources contain specific data points — funding amounts (e.g. TRAC3, Funding Window allocations, total external funds leveraged), dates, deployment details, gender marker scores — cite them directly instead of writing in general terms.

For each part of the analysis, evaluate it through these lenses where the evidence supports it: the clarity and timeliness of the decision-making behind it (including risk management and compliance with standard procedures); how well assessments and evidence informed it; and, where relevant, the pertinence and timeliness of corporate support (technical expertise, financial support, HQ/Regional Bureau engagement) that backed it up.

Write clear, professional, neutral prose suitable for an institutional record, and do not invent details that aren't supported by the sources. Where a section isn't covered yet, leave a clear note for the human reviewer instead of guessing.

Findings and recommendations should stay forward-looking and focused on institutional learning rather than assigning blame. Keep them as direct, actionable statements, and organize recommendations by which part of the organization is best placed to act on them (e.g. Crisis Bureau, a Regional Bureau, another relevant HQ unit, or the Country Office) where the evidence makes that clear.

If a source document includes personal details about individuals or vulnerable groups, include only what's necessary to support a specific finding rather than restating identifying details that aren't relevant.`;

const EMPTY_OVERVIEW: OverviewState = {
  country: "",
  crisisType: crisisTypes[0],
  countryOfficeFocalPoint: "",
  crisisBureauFocalPoint: "",
  regionalBureauFocalPoint: "",
  periodStart: "",
  periodEnd: "",
  office: "",
  leadAuthor: "",
  stage: "Drafting",
};

const EMPTY_INVITE_FORM = {
  name: "",
  role: "",
  unit: "",
  email: "",
  templateId: "",
};

// Maps each survey's declared response areas to the report field they
// should feed when a contributor's answers get folded into the AI draft.
const RESPONSE_AREA_TO_FIELD: Record<ResponseArea, keyof Draft> = {
  "Corporate Response Mechanisms": "corporateResponseMechanisms",
  "Country Office Response Structure and Capacities": "inCountryStructure",
  Deployments: "deploymentOfExperts",
  "Programmatic Response": "programmaticResponse",
  "Operational Response": "operationalResponse",
  Coordination: "coordination",
  "Communication and Resource Mobilization":
    "communicationAndResourceMobilization",
};

const EMPTY_DRAFT: Draft = {
  executiveSummary: "",
  countrySituation: "",
  objectives: "",
  scope: "",
  dataCollection: "",
  contextualFactors: "",
  inCountryStructure: "",
  corporateResponseMechanisms: "",
  deploymentOfExperts: "",
  programmaticResponse: "",
  operationalResponse: "",
  coordination: "",
  communicationAndResourceMobilization: "",
};

// Which draft field a free-text note line is folded into, based on simple
// keyword matching — a stand-in for real extraction from attached sources.
const SECTION_KEYWORDS: { field: keyof Draft; keywords: string[]; topic: string }[] = [
  {
    field: "corporateResponseMechanisms",
    keywords: ["crisis board", "corporate", "roster", "hq"],
    topic: "UNDP's corporate response mechanisms",
  },
  {
    field: "deploymentOfExperts",
    keywords: ["deploy", "surge", "expert", "specialist"],
    topic: "the deployment of experts",
  },
  {
    field: "inCountryStructure",
    keywords: ["structure", "capacity", "staff", "standing team"],
    topic: "UNDP's in-country structure and response capacity",
  },
  {
    field: "programmaticResponse",
    keywords: ["programme", "program", "caseload", "recovery", "livelihood", "shelter"],
    topic: "the programmatic response",
  },
  {
    field: "operationalResponse",
    keywords: ["procure", "logistic", "operation", "supply chain"],
    topic: "the operational response",
  },
  {
    field: "coordination",
    keywords: ["coordinat", "cluster", "partner", "liaison"],
    topic: "coordination with partners and authorities",
  },
  {
    field: "communicationAndResourceMobilization",
    keywords: ["appeal", "fund", "donor", "communicat", "resource mobiliz"],
    topic: "communication and resource mobilization",
  },
  {
    field: "objectives",
    keywords: ["objective", "purpose", "aim of", "goal"],
    topic: "the objectives of this review",
  },
  {
    field: "scope",
    keywords: ["scope", "out of scope", "period covers"],
    topic: "the scope of this review",
  },
  {
    field: "dataCollection",
    keywords: ["interview", "survey", "focus group", "desk review", "validat"],
    topic: "how data was collected and validated",
  },
  {
    field: "countrySituation",
    keywords: ["displaced", "affected", "situation", "context"],
    topic: "the country situation and context",
  },
  {
    field: "contextualFactors",
    keywords: ["factor", "pre-existing", "background"],
    topic: "contextual factors influencing the response",
  },
];

function splitToPoints(text: string) {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function toProse(points: string[]) {
  return points
    .map((p) => (/[.!?]$/.test(p) ? p : `${p}.`))
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export default function NewReviewPage() {
  return (
    <Suspense fallback={<main className="flex-1 bg-background" />}>
      <NewReviewWorkspace />
    </Suspense>
  );
}

function NewReviewWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [slug, setSlug] = useState("");
  const [recordStatus, setRecordStatus] = useState<ReviewStatus>("In Progress");
  const [tags, setTags] = useState<string[]>([]);
  // Preserve the original title/summary on edit instead of always
  // recomputing them from the current form — only auto-generated when
  // empty (i.e. a brand-new record that never had one).
  const [savedTitle, setSavedTitle] = useState("");
  const [savedSummary, setSavedSummary] = useState("");
  const [step, setStep] = useState<Step>(1);

  const [overview, setOverview] = useState<OverviewState>(EMPTY_OVERVIEW);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [templates, setTemplates] = useState<SurveyTemplate[]>([]);
  const [invites, setInvites] = useState<SurveyInvite[]>([]);
  const [inviteForm, setInviteForm] = useState(EMPTY_INVITE_FORM);

  const [documents, setDocuments] = useState<DocumentSource[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [manualSourceName, setManualSourceName] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);

  const [notes, setNotes] = useState("");

  const [promptOpen, setPromptOpen] = useState(false);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);

  const [status, setStatus] = useState<"idle" | "generating" | "ready">(
    "idle",
  );
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [findingsMatrix, setFindingsMatrix] = useState<FindingRow[]>([]);
  const [interviewees, setInterviewees] = useState<Interviewee[]>([]);
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // One-time hydration from an external source (the URL and the database)
  // on mount — not state derived from props/state, so setState here is the
  // sanctioned pattern rather than the anti-pattern this rule targets.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const paramSlug = searchParams.get("edit");
    if (paramSlug) {
      getRecord(paramSlug).then((record) => {
        if (!record) {
          setSlug(crypto.randomUUID());
          return;
        }
        // Once an AAR has been submitted for review (or completed), it's
        // reviewed and edited on its own dedicated page, not this drafting
        // wizard — bounce there even if someone lands on this URL directly.
        if (record.stage === "Under Review" || record.status === "Completed") {
          router.replace(`/reviews/${encodeURIComponent(record.slug)}/edit`);
          return;
        }
        setSlug(record.slug);
        setRecordStatus(record.status);
        setTags(record.tags);
        setSavedTitle(record.title);
        setSavedSummary(record.summary);
        setOverview({
          country: record.country,
          crisisType: record.crisisType,
          countryOfficeFocalPoint: record.countryOfficeFocalPoint ?? "",
          crisisBureauFocalPoint: record.crisisBureauFocalPoint ?? "",
          regionalBureauFocalPoint: record.regionalBureauFocalPoint ?? "",
          periodStart: record.periodStart,
          periodEnd: record.periodEnd,
          office: record.office,
          leadAuthor: record.leadAuthor,
          stage: record.stage ?? "Drafting",
        });
        setDocuments(record.documents);
        setNotes(record.notes);
        setPrompt(record.prompt || DEFAULT_PROMPT);
        setDraft({
          executiveSummary: record.executiveSummary,
          countrySituation: record.introduction.countrySituation,
          objectives: record.introduction.objectives,
          scope: record.methodology.scope,
          dataCollection: record.methodology.dataCollection,
          contextualFactors: record.analysis.contextualFactors,
          inCountryStructure: record.analysis.inCountryStructure,
          corporateResponseMechanisms: record.analysis.corporateResponseMechanisms,
          deploymentOfExperts: record.analysis.deploymentOfExperts,
          programmaticResponse: record.analysis.programmaticResponse,
          operationalResponse: record.analysis.operationalResponse,
          coordination: record.analysis.coordination,
          communicationAndResourceMobilization:
            record.analysis.communicationAndResourceMobilization,
        });
        setTimeline(record.analysis.timeline);
        setFindingsMatrix(record.findingsMatrix);
        setInterviewees(record.interviewees);

        if (record.stage === "Awaiting Survey Responses") setStep(2);
        else if (record.executiveSummary) setStep(4);
        else if (record.documents.length > 0) setStep(3);

        if (record.executiveSummary) setStatus("ready");
      });
      return;
    }
    setSlug(crypto.randomUUID());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Survey templates are shared reference data — load once, independent of
  // which AAR is being edited.
  useEffect(() => {
    listSurveyTemplates().then((loaded) => {
      setTemplates(loaded);
      setInviteForm((f) => (f.templateId ? f : { ...f, templateId: loaded[0]?.id ?? "" }));
    });
  }, []);

  // Invites live in their own table now, not the AAR record — load (or
  // reload) whenever the current record's slug is known.
  useEffect(() => {
    if (!slug) return;
    listInvites(slug).then((loaded) => {
      setInvites(loaded);
      // Auto-advance stage if all responses received
      if (
        overview.stage === "Awaiting Survey Responses" &&
        loaded.length > 0 &&
        loaded.every((i) => i.status === "Responded")
      ) {
        const updatedOverview: OverviewState = {
          ...overview,
          stage: "Drafting",
        };
        setOverview(updatedOverview);
        saveRecord({
          ...buildRecord({ overview: updatedOverview }),
          stage: "Drafting",
        }).catch(() => {
          // silently fail to avoid disrupting the form
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Auto-save the record when changes are made. The timer is kept in a ref
  // (not just this effect's closure) so an explicit save/submit/complete
  // action can cancel it directly -- the cleanup function alone isn't
  // reliable here, since router.push() navigation doesn't guarantee this
  // component unmounts before a near-due timer fires, which can let a
  // stale autosave silently re-save over a just-changed status.
  useEffect(() => {
    if (!slug) return;

    autosaveTimer.current = setTimeout(() => {
      setIsSaving(true);
      saveRecord(buildRecord()).then(() => {
        setLastSaveTime(new Date());
        setIsSaving(false);
      }).catch(() => {
        setIsSaving(false);
      });
    }, 2000); // Auto-save 2 seconds after last change

    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, overview, documents, notes, draft, timeline, findingsMatrix, interviewees, recordStatus, tags]);

  const isOtherCrisisType = !(crisisTypes as readonly string[]).includes(
    overview.crisisType,
  );

  // Derived from each document's own tag rather than a single AAR-wide
  // setting, since different sources are often gathered different ways.
  const documentMethods = Array.from(
    new Set(
      documents
        .map((d) => d.dataCollectionMethod)
        .filter((m): m is string => Boolean(m)),
    ),
  );

  const keyFindings = useMemo(
    () => findingsMatrix.map((r) => r.finding).filter(Boolean),
    [findingsMatrix],
  );
  const recommendations = useMemo(
    () => findingsMatrix.map((r) => r.recommendation).filter(Boolean),
    [findingsMatrix],
  );

  const roleValue = inviteForm.role.trim().toLowerCase();
  const surveysForRole = roleValue
    ? templates.filter((s) =>
        s.suggestedRoles.some((r) => r.toLowerCase() === roleValue),
      )
    : [];
  const otherSurveysForRole = surveysForRole.filter(
    (s) => s.id !== inviteForm.templateId,
  );

  async function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setFileError(null);

    const files = Array.from(fileList);
    const oversized = files.filter((f) => f.size > MAX_FILE_BYTES);
    const readable = files.filter((f) => f.size <= MAX_FILE_BYTES);
    if (oversized.length > 0) {
      setFileError(
        `${oversized.map((f) => f.name).join(", ")} ${oversized.length === 1 ? "is" : "are"} over the 15 MB limit and ${oversized.length === 1 ? "wasn't" : "weren't"} attached.`,
      );
    }

    try {
      const added = await Promise.all(
        readable.map(async (file) => ({
          id: crypto.randomUUID(),
          name: file.name,
          size: file.size,
          mimeType: file.type || undefined,
          content: await readFileAsBase64(file),
        })),
      );
      setDocuments((prev) => [...prev, ...added]);
    } catch {
      setFileError("Couldn't read one of those files. Try attaching it again.");
    }
  }

  function addManualSource() {
    if (!manualSourceName.trim()) return;
    setDocuments((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: manualSourceName.trim() },
    ]);
    setManualSourceName("");
  }

  function removeDocument(id: string) {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }

  function setDocumentMethod(id: string, method: string) {
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, dataCollectionMethod: method } : d,
      ),
    );
  }

  async function addInvite() {
    if (!inviteForm.name.trim() || !inviteForm.email.trim() || !slug) return;
    const created = await createInvite({ reviewSlug: slug, ...inviteForm });
    if (created) {
      setInvites((prev) => [...prev, created]);
      
      // Auto-advance to "Awaiting Survey Responses" if still in Drafting stage
      if (overview.stage === "Drafting") {
        const updatedOverview: OverviewState = {
          ...overview,
          stage: "Awaiting Survey Responses",
        };
        setOverview(updatedOverview);
        await saveRecord(buildRecord({ overview: updatedOverview }));
      }
    }
    setInviteForm((f) => ({ ...EMPTY_INVITE_FORM, templateId: f.templateId }));
  }

  async function removeInvite(id: string) {
    setInvites((prev) => prev.filter((i) => i.id !== id));
    await deleteInvite(id);
  }

  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const [sendingInviteId, setSendingInviteId] = useState<string | null>(null);
  const [sendInviteError, setSendInviteError] = useState<string | null>(null);

  async function copyInviteLink(id: string) {
    const link = `${window.location.origin}/respond/${id}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedInviteId(id);
      window.setTimeout(() => setCopiedInviteId((v) => (v === id ? null : v)), 2000);
    } catch {
      // Clipboard access can fail (older browsers, permissions); marking
      // the invite as sent is the important part, so continue regardless.
    }
    const updated = await markInviteSent(id);
    if (updated) {
      setInvites((prev) => prev.map((i) => (i.id === id ? updated : i)));
    }
  }

  async function handleSendInvite(id: string) {
    setSendInviteError(null);
    setSendingInviteId(id);
    const link = `${window.location.origin}/respond/${id}`;
    const aarTitle =
      savedTitle || (overview.country ? `${overview.country} — ${overview.crisisType}` : "Untitled AAR");
    const result = await sendInvite(id, { surveyLink: link, aarTitle });
    setSendingInviteId(null);
    if (result.ok) {
      setInvites((prev) => prev.map((i) => (i.id === id ? result.invite : i)));
    } else {
      setSendInviteError(`Couldn't send to this invite: ${result.error} Try "Copy link" instead.`);
    }
  }

  function addInvitesToPeopleConsulted() {
    setInterviewees((prev) => {
      const existingNames = new Set(prev.map((p) => p.name.toLowerCase()));
      const additions = invites
        .filter((invite) => !existingNames.has(invite.name.toLowerCase()))
        .map((invite) => ({
          name: invite.name,
          title: invite.role,
          agency: invite.unit,
        }));
      return [...prev, ...additions];
    });
  }

  function buildRecord(opts?: {
    overview?: OverviewState;
    status?: ReviewStatus;
  }): AarRecord {
    const ov = opts?.overview ?? overview;
    return {
      slug,
      country: ov.country,
      crisisType: ov.crisisType,
      countryOfficeFocalPoint: ov.countryOfficeFocalPoint,
      crisisBureauFocalPoint: ov.crisisBureauFocalPoint,
      regionalBureauFocalPoint: ov.regionalBureauFocalPoint,
      title:
        savedTitle ||
        (ov.country ? `${ov.country} — ${ov.crisisType}` : "Untitled AAR"),
      summary: savedSummary || draft.executiveSummary.slice(0, 220),
      status: opts?.status ?? recordStatus,
      stage: ov.stage,
      periodStart: ov.periodStart,
      periodEnd: ov.periodEnd,
      office: ov.office,
      leadAuthor: ov.leadAuthor,
      tags,
      executiveSummary: draft.executiveSummary,
      introduction: {
        countrySituation: draft.countrySituation,
        objectives: draft.objectives,
      },
      methodology: {
        scope: draft.scope,
        dataCollectionMethods: documentMethods,
        dataCollection: draft.dataCollection,
      },
      analysis: {
        contextualFactors: draft.contextualFactors,
        timeline,
        inCountryStructure: draft.inCountryStructure,
        corporateResponseMechanisms: draft.corporateResponseMechanisms,
        deploymentOfExperts: draft.deploymentOfExperts,
        programmaticResponse: draft.programmaticResponse,
        operationalResponse: draft.operationalResponse,
        coordination: draft.coordination,
        communicationAndResourceMobilization:
          draft.communicationAndResourceMobilization,
      },
      keyFindings,
      recommendations,
      findingsMatrix,
      interviewees,
      documents,
      notes,
      prompt,
      updatedAt: new Date().toISOString(),
    };
  }

  async function handleSaveAsDraft() {
    if (!slug) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    await saveRecord(buildRecord());
    router.push("/workspace");
  }

  async function handleSaveAndWaitForResponses() {
    if (!slug) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    const updatedOverview: OverviewState = {
      ...overview,
      stage: "Awaiting Survey Responses",
    };
    setOverview(updatedOverview);
    await saveRecord(buildRecord({ overview: updatedOverview }));
    router.push("/workspace");
  }

  async function handleSubmitForReview() {
    if (!slug) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    const updatedOverview: OverviewState = {
      ...overview,
      stage: "Under Review",
    };
    setOverview(updatedOverview);
    await saveRecord(buildRecord({ overview: updatedOverview }));
    router.push("/workspace");
  }

  async function handleCompleteAar() {
    if (!slug) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    setRecordStatus("Completed");
    await saveRecord(buildRecord({ status: "Completed" }));
    router.push("/");
  }

  function handleGenerate() {
    setStatus("generating");
    setStep(4);
    window.setTimeout(() => {
      const points = splitToPoints(notes);
      const buckets: Partial<Record<keyof Draft, string[]>> = {};

      for (const point of points) {
        const lower = point.toLowerCase();
        const match = SECTION_KEYWORDS.find((s) =>
          s.keywords.some((k) => lower.includes(k)),
        );
        const field = match?.field ?? "contextualFactors";
        buckets[field] = [...(buckets[field] ?? []), point];
      }

      const respondedInvites = invites.filter(
        (i) => i.status === "Responded" && i.answers,
      );
      for (const invite of respondedInvites) {
        const template = templates.find((t) => t.id === invite.templateId);
        if (!template) continue;
        const answerPoints = template.questions
          .map((q) => invite.answers?.[q.id]?.trim())
          .filter((a): a is string => Boolean(a));
        if (answerPoints.length === 0) continue;
        for (const area of template.informsSections) {
          const field = RESPONSE_AREA_TO_FIELD[area];
          buckets[field] = [...(buckets[field] ?? []), ...answerPoints];
        }
      }

      const docNames = documents.map((d) => d.name);
      const hasDocs = docNames.length > 0;
      const hasNotes = points.length > 0;
      const hasResponses = respondedInvites.length > 0;

      function sectionText(field: keyof Draft, topic: string) {
        const pts = buckets[field];
        if (pts && pts.length > 0) return toProse(pts);
        if (hasDocs) {
          const sourceLabel =
            docNames.length === 1
              ? docNames[0]
              : `the attached sources (${docNames.join(", ")})`;
          return `Review ${sourceLabel} and summarize ${topic} here.`;
        }
        return `Attach source documents or add notes in the Sources step to generate ${topic}.`;
      }

      const period = formatPeriod(overview.periodStart, overview.periodEnd);
      const countryLabel = overview.country.trim() || "the affected country";
      const crisisLabel = overview.crisisType.toLowerCase();

      const summaryParts = [
        `This After Action Review examines UNDP's response to the ${crisisLabel} in ${countryLabel}${period ? ` (${period})` : ""}.`,
      ];
      const sourceLabels = [
        hasDocs &&
          `${documents.length} attached source${documents.length === 1 ? "" : "s"}`,
        hasNotes && "the notes provided",
        hasResponses &&
          `${respondedInvites.length} survey response${respondedInvites.length === 1 ? "" : "s"}`,
      ].filter(Boolean);
      if (sourceLabels.length > 0) {
        summaryParts.push(
          `This draft was generated from ${sourceLabels.join(", ")}.`,
        );
      } else {
        summaryParts.push(
          "Attach source documents or add notes in the Sources step, then regenerate to populate this draft.",
        );
      }
      summaryParts.push(
        "Review each section below against the sources and edit as needed before this moves to validation.",
      );

      setDraft({
        executiveSummary: summaryParts.join(" "),
        countrySituation: sectionText(
          "countrySituation",
          "the country situation and context",
        ),
        objectives: sectionText(
          "objectives",
          "the objectives of this review",
        ),
        scope: sectionText("scope", "the scope of this review"),
        dataCollection: [
          documentMethods.length > 0
            ? `Evidence was gathered through ${documentMethods.map((m) => m.toLowerCase()).join(", ")}.`
            : "",
          sectionText(
            "dataCollection",
            "how data was collected and validated",
          ),
        ]
          .filter(Boolean)
          .join(" "),
        contextualFactors: sectionText(
          "contextualFactors",
          "contextual factors influencing the response",
        ),
        inCountryStructure: sectionText(
          "inCountryStructure",
          "UNDP's in-country structure and response capacity",
        ),
        corporateResponseMechanisms: sectionText(
          "corporateResponseMechanisms",
          "UNDP's corporate response mechanisms",
        ),
        deploymentOfExperts: sectionText(
          "deploymentOfExperts",
          "the deployment of experts",
        ),
        programmaticResponse: sectionText(
          "programmaticResponse",
          "the programmatic response",
        ),
        operationalResponse: sectionText(
          "operationalResponse",
          "the operational response",
        ),
        coordination: sectionText(
          "coordination",
          "coordination with partners and authorities",
        ),
        communicationAndResourceMobilization: sectionText(
          "communicationAndResourceMobilization",
          "communication and resource mobilization",
        ),
      });
      setStatus("ready");
    }, 1300);
  }

  return (
    <main className="flex-1 bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-un-blue-600">
              AI-assisted drafting workspace
            </p>
            <h1 className="mt-1 font-serif text-2xl font-semibold text-un-ink">
              Draft a New After Action Review
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-un-muted">
              Set the basics, send surveys to contributors, then attach
              sources and generate a draft in the official AAR report
              format.
            </p>
          </div>
          <div className="flex gap-2 items-center">
            {isSaving && (
              <span className="text-xs font-medium text-un-muted">Saving...</span>
            )}
            {lastSaveTime && !isSaving && (
              <span className="text-xs font-medium text-emerald-600">
                ✓ Saved
              </span>
            )}
            {recordStatus === "Completed" ? (
              <>
                <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                  ✓ Completed
                </span>
                <button
                  type="button"
                  onClick={handleSaveAsDraft}
                  className="rounded-full border border-un-border px-4 py-2 text-sm font-semibold text-un-blue-700 hover:bg-un-blue-50"
                >
                  Save edits
                </button>
              </>
            ) : overview.stage === "Under Review" ? (
              <>
                <button
                  type="button"
                  onClick={handleSaveAsDraft}
                  className="rounded-full border border-un-border px-4 py-2 text-sm font-semibold text-un-blue-700 hover:bg-un-blue-50"
                >
                  Save edits
                </button>
                <button
                  type="button"
                  onClick={handleCompleteAar}
                  className="rounded-full bg-un-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-un-blue-700"
                >
                  Complete AAR
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleSaveAsDraft}
                  className="rounded-full border border-un-border px-4 py-2 text-sm font-semibold text-un-blue-700 hover:bg-un-blue-50"
                >
                  Save as draft
                </button>
                <button
                  type="button"
                  onClick={handleSubmitForReview}
                  disabled={status !== "ready"}
                  className="rounded-full bg-un-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-un-blue-700 disabled:cursor-not-allowed disabled:bg-un-border disabled:text-un-muted"
                >
                  Submit for review
                </button>
              </>
            )}
          </div>
        </div>

        <StepIndicator current={step} onSelect={setStep} />

        {step === 1 && (
          <div className="mx-auto mt-8 max-w-xl">
            <Panel title="AAR basics">
              <div className="space-y-3">
                <Field label="Country / crisis name">
                  <input
                    value={overview.country}
                    onChange={(e) =>
                      setOverview((o) => ({ ...o, country: e.target.value }))
                    }
                    placeholder="e.g. Philippines"
                    className="input"
                  />
                </Field>
                <div className="space-y-3">
                  <Field label="Country office focal point">
                    <input
                      value={overview.countryOfficeFocalPoint}
                      onChange={(e) =>
                        setOverview((o) => ({
                          ...o,
                          countryOfficeFocalPoint: e.target.value,
                        }))
                      }
                      placeholder="e.g. Maria Santos"
                      className="input"
                    />
                  </Field>
                  <Field label="Crisis bureau focal point">
                    <input
                      value={overview.crisisBureauFocalPoint}
                      onChange={(e) =>
                        setOverview((o) => ({
                          ...o,
                          crisisBureauFocalPoint: e.target.value,
                        }))
                      }
                      placeholder="e.g. Jonas Weber"
                      className="input"
                    />
                  </Field>
                  <Field label="Regional bureau focal point">
                    <input
                      value={overview.regionalBureauFocalPoint}
                      onChange={(e) =>
                        setOverview((o) => ({
                          ...o,
                          regionalBureauFocalPoint: e.target.value,
                        }))
                      }
                      placeholder="e.g. Amara Okafor"
                      className="input"
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Crisis category">
                    <select
                      value={isOtherCrisisType ? "Other" : overview.crisisType}
                      onChange={(e) =>
                        setOverview((o) => ({
                          ...o,
                          crisisType:
                            e.target.value === "Other"
                              ? ""
                              : (e.target.value as CrisisType),
                        }))
                      }
                      className="input"
                    >
                      {crisisTypes.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      <option value="Other">Other</option>
                    </select>
                    {isOtherCrisisType && (
                      <input
                        value={overview.crisisType}
                        onChange={(e) =>
                          setOverview((o) => ({
                            ...o,
                            crisisType: e.target.value,
                          }))
                        }
                        placeholder="Describe the crisis type"
                        className="input mt-2"
                        autoFocus
                      />
                    )}
                  </Field>
                  <Field label="Crisis response period start">
                    <input
                      type="month"
                      value={overview.periodStart}
                      onChange={(e) =>
                        setOverview((o) => ({
                          ...o,
                          periodStart: e.target.value,
                        }))
                      }
                      className="input"
                    />
                  </Field>
                </div>

                {advancedOpen ? (
                  <div className="space-y-3 rounded-lg border border-un-border p-3">
                    <Field label="Crisis response period end">
                      <input
                        type="month"
                        value={overview.periodEnd}
                        onChange={(e) =>
                          setOverview((o) => ({
                            ...o,
                            periodEnd: e.target.value,
                          }))
                        }
                        className="input"
                      />
                    </Field>
                    <Field label="Responsible country office(s)">
                      <input
                        value={overview.office}
                        onChange={(e) =>
                          setOverview((o) => ({
                            ...o,
                            office: e.target.value,
                          }))
                        }
                        placeholder="e.g. Philippines Country Office"
                        className="input"
                      />
                    </Field>
                    <Field label="Lead author / consultant">
                      <input
                        value={overview.leadAuthor}
                        onChange={(e) =>
                          setOverview((o) => ({
                            ...o,
                            leadAuthor: e.target.value,
                          }))
                        }
                        placeholder="e.g. Independent Consultant — name"
                        className="input"
                      />
                    </Field>
                    <button
                      type="button"
                      onClick={() => setAdvancedOpen(false)}
                      className="text-xs font-semibold text-un-blue-700 hover:text-un-blue-600"
                    >
                      Hide details
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAdvancedOpen(true)}
                    className="text-xs font-semibold text-un-blue-700 hover:text-un-blue-600"
                  >
                    + Add office, lead author, end date...
                  </button>
                )}
              </div>
            </Panel>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded-full bg-un-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-un-blue-700"
              >
                Continue to Send Surveys &rarr;
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="mx-auto mt-8 max-w-6xl space-y-5">
          {overview.stage === "Awaiting Survey Responses" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
                <span>
                  <strong>Waiting for survey responses.</strong>{" "}
                  {invites.length > 0 ? (
                    <>
                      {invites.filter((i) => i.status === "Responded").length} of{" "}
                      {invites.length} contributors have responded so far. Mark
                      responses in as they come in, then continue when
                      you&apos;re ready.
                    </>
                  ) : (
                    <>Send surveys to get started.</>
                  )}
                </span>
              </div>
              {invites.length > 0 && (
                <div className="rounded-xl border border-un-border bg-white px-4 py-3">
                  <div className="mb-2 flex items-center justify-between text-xs font-semibold text-un-ink">
                    <span>Survey Response Progress</span>
                    <span className="text-un-muted">{invites.filter((i) => i.status === "Responded").length} of {invites.length}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-un-border">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{
                        width: `${(invites.filter((i) => i.status === "Responded").length / invites.length) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="grid gap-5 lg:grid-cols-[360px_1fr] lg:items-start">
            <Panel title="Available surveys">
              <p className="text-xs text-un-muted">
                Draft question sets — a starting point inferred from the
                AAR report structure, not yet reviewed by the Crisis
                Bureau. Refine before sending for real.
              </p>
              <div className="mt-3 grid gap-3">
                {templates.map((survey) => (
                  <div
                    key={survey.id}
                    className="rounded-xl border border-un-border bg-un-blue-50/40 p-3.5"
                  >
                    <p className="text-sm font-semibold text-un-ink">
                      {survey.name}
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-un-blue-600">
                      {survey.audience}
                    </p>
                    <p className="mt-1.5 text-xs italic text-un-muted">
                      {survey.description}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {survey.informsSections.map((area) => (
                        <span
                          key={area}
                          className="rounded-full bg-white px-2 py-0.5 text-[0.65rem] font-medium text-un-blue-700 ring-1 ring-un-blue-200"
                        >
                          {area}
                        </span>
                      ))}
                    </div>
                    {survey.suggestedRoles.length > 0 ? (
                      <p className="mt-2 text-xs text-un-muted">
                        <span className="font-semibold text-un-ink">
                          Typical roles:
                        </span>{" "}
                        {survey.suggestedRoles.join(", ")}
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-un-muted">
                        External audience — no fixed role list.
                      </p>
                    )}
                    <details className="group mt-2.5">
                      <summary className="cursor-pointer list-none text-xs font-semibold text-un-blue-700 marker:content-none">
                        <span className="group-open:hidden">
                          View {survey.questions.length} draft questions
                        </span>
                        <span className="hidden group-open:inline">
                          Hide questions
                        </span>
                      </summary>
                      <ol className="mt-2 space-y-1.5 border-t border-un-border pt-2">
                        {survey.questions.map((question, index) => (
                          <li
                            key={question.id}
                            className="flex gap-2 text-xs text-un-ink/90"
                          >
                            <span className="shrink-0 text-un-muted">
                              {index + 1}.
                            </span>
                            {question.text}
                          </li>
                        ))}
                      </ol>
                    </details>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel
              title="Invite contributors"
              subtitle={invites.length > 0 ? `${invites.length} added` : undefined}
            >
              <p className="text-xs text-un-muted">
                Add each person, pick which survey fits them, and send an
                invite — like requesting a recommendation letter. Sending
                isn&apos;t connected to a real email service yet, so this
                simulates the invite going out.
              </p>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Field label="Name">
                  <input
                    value={inviteForm.name}
                    onChange={(e) =>
                      setInviteForm((f) => ({ ...f, name: e.target.value }))
                    }
                    placeholder="e.g. Maria Santos"
                    className="input"
                  />
                </Field>
                <Field label="Role / title">
                  <input
                    value={inviteForm.role}
                    onChange={(e) =>
                      setInviteForm((f) => ({ ...f, role: e.target.value }))
                    }
                    placeholder="e.g. Crisis Coordinator"
                    className="input"
                    list="role-suggestions"
                  />
                  <datalist id="role-suggestions">
                    {templates
                      .find((s) => s.id === inviteForm.templateId)
                      ?.suggestedRoles.map((role) => (
                        <option key={role} value={role} />
                      ))}
                  </datalist>
                  {otherSurveysForRole.length > 0 && (
                    <p className="mt-1.5 text-xs text-un-muted">
                      Usually surveyed via{" "}
                      {otherSurveysForRole.map((s, i) => (
                        <span key={s.id}>
                          {i > 0 && ", "}
                          <button
                            type="button"
                            onClick={() =>
                              setInviteForm((f) => ({
                                ...f,
                                templateId: s.id,
                              }))
                            }
                            className="font-semibold text-un-blue-700 underline decoration-dotted hover:text-un-blue-600"
                          >
                            {s.name}
                          </button>
                        </span>
                      ))}
                      .
                    </p>
                  )}
                  {surveysForRole.length > 0 &&
                    otherSurveysForRole.length === 0 && (
                      <p className="mt-1.5 text-xs text-emerald-700">
                        &#10003; Matches the selected survey
                      </p>
                    )}
                </Field>
                <Field label="Unit / office">
                  <input
                    value={inviteForm.unit}
                    onChange={(e) =>
                      setInviteForm((f) => ({ ...f, unit: e.target.value }))
                    }
                    placeholder="e.g. Philippines Country Office"
                    className="input"
                  />
                </Field>
                <Field label="Email">
                  <input
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) =>
                      setInviteForm((f) => ({ ...f, email: e.target.value }))
                    }
                    placeholder="name@undp.org"
                    className="input"
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Survey">
                    <select
                      value={inviteForm.templateId}
                      onChange={(e) =>
                        setInviteForm((f) => ({
                          ...f,
                          templateId: e.target.value,
                        }))
                      }
                      className="input"
                    >
                      {templates.map((survey) => (
                        <option key={survey.id} value={survey.id}>
                          {survey.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>

              <button
                type="button"
                onClick={addInvite}
                className="mt-3 w-full rounded-lg border border-dashed border-un-border px-3 py-2 text-sm font-semibold text-un-blue-700 hover:bg-un-blue-50"
              >
                + Add to invite list
              </button>

              {sendInviteError && (
                <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200">
                  {sendInviteError}
                </p>
              )}

              {invites.length > 0 && (
                <div className="mt-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-un-muted">
                      Invite list &middot;{" "}
                      {invites.filter((i) => i.status === "Responded").length}{" "}
                      of {invites.length} responded
                    </span>
                  </div>
                  <ul className="mt-2 space-y-2">
                    {invites.map((invite) => {
                      const survey = templates.find(
                        (s) => s.id === invite.templateId,
                      );
                      return (
                        <li
                          key={invite.id}
                          className="rounded-lg border border-un-border bg-un-blue-50/60 px-3 py-2"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-un-ink">
                                {invite.name}
                                {invite.role && (
                                  <span className="font-normal text-un-muted">
                                    {" "}
                                    &middot; {invite.role}
                                  </span>
                                )}
                              </p>
                              <p className="truncate text-xs text-un-muted">
                                {invite.email}
                                {survey && <> &middot; {survey.name}</>}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              {invite.status === "Responded" ? (
                                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                                  &#10003; Responded
                                </span>
                              ) : invite.status === "Sent" ? (
                                <span className="rounded-full bg-un-gold-100 px-2.5 py-1 text-xs font-semibold text-un-gold-600 ring-1 ring-un-gold-500/30">
                                  Link sent
                                </span>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => handleSendInvite(invite.id)}
                                disabled={sendingInviteId === invite.id}
                                className="rounded-full bg-un-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-un-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {sendingInviteId === invite.id
                                  ? "Sending…"
                                  : invite.status === "Draft"
                                    ? "Send email"
                                    : "Resend email"}
                              </button>
                              <button
                                type="button"
                                onClick={() => copyInviteLink(invite.id)}
                                className="rounded-full border border-un-border px-3 py-1 text-xs font-semibold text-un-blue-700 hover:bg-un-blue-50"
                              >
                                {copiedInviteId === invite.id ? "Link copied!" : "Copy link"}
                              </button>
                              <button
                                type="button"
                                onClick={() => removeInvite(invite.id)}
                                aria-label={`Remove ${invite.name}`}
                                className="text-un-muted hover:text-un-blue-700"
                              >
                                &times;
                              </button>
                            </div>
                          </div>
                          {invite.status === "Responded" && survey && (
                            <details className="group mt-2 border-t border-un-border pt-2">
                              <summary className="cursor-pointer list-none text-xs font-semibold text-un-blue-700 marker:content-none">
                                <span className="group-open:hidden">
                                  View answers
                                </span>
                                <span className="hidden group-open:inline">
                                  Hide answers
                                </span>
                              </summary>
                              <dl className="mt-2 space-y-2">
                                {survey.questions.map((question) => (
                                  <div key={question.id}>
                                    <dt className="text-xs font-semibold text-un-ink">
                                      {question.text}
                                    </dt>
                                    <dd className="mt-0.5 text-xs text-un-muted">
                                      {invite.answers?.[question.id] || (
                                        <span className="italic">
                                          Not answered
                                        </span>
                                      )}
                                    </dd>
                                  </div>
                                ))}
                              </dl>
                            </details>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </Panel>
          </div>

            <div className="flex flex-wrap justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-full border border-un-border px-5 py-2.5 text-sm font-semibold text-un-blue-700 hover:bg-un-blue-50"
              >
                &larr; Back
              </button>
              <div className="flex gap-3">
                {invites.length > 0 && (
                  <button
                    type="button"
                    onClick={handleSaveAndWaitForResponses}
                    className="rounded-full border border-orange-300 bg-orange-50 px-5 py-2.5 text-sm font-semibold text-orange-700 hover:bg-orange-100"
                  >
                    Save &amp; wait for responses
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="rounded-full bg-un-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-un-blue-700"
                >
                  Continue to Sources &rarr;
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
        <div className="mt-8">
          <button
            type="button"
            onClick={() => setStep(2)}
            className="text-sm font-semibold text-un-blue-700 hover:text-un-blue-600"
          >
            &larr; Back to Send Surveys
          </button>

          {/* Full width now that the report lives on its own step — no
              need to squeeze inputs into a narrow column. */}
          <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_1.3fr] lg:items-start">
            {/* First grid column: notes, prompt, and the generate action. */}
            <div className="space-y-5">
            <Panel title="Notes for the AI (optional)">
              <p className="text-xs text-un-muted">
                Anything not captured in the attached documents. One point
                per line works best — specific numbers, dates, and figures
                (funding amounts, deployment timelines, gender marker
                scores) make for a much stronger draft than general
                statements.
              </p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  "e.g.\nShelter procurement took six weeks against a four-week target\nCoordination with the Office of Civil Defense was a clear strength\nTRAC3 allocation of $500,000 approved on 2026-02-03, three weeks after the crisis was declared"
                }
                className="input mt-2 min-h-[120px] resize-y"
              />
            </Panel>

            <Panel
              title="Prompt instructions"
              subtitle={
                promptOpen
                  ? undefined
                  : prompt === DEFAULT_PROMPT
                    ? "Using default template"
                    : "Customized for this AAR"
              }
              action={
                <button
                  type="button"
                  onClick={() => setPromptOpen((v) => !v)}
                  className="text-xs font-semibold text-un-blue-700 hover:text-un-blue-600"
                >
                  {promptOpen ? "Hide" : "Edit"}
                </button>
              }
            >
              <p className="text-xs text-un-muted">
                This is the exact instruction set the AI will follow when
                generating this AAR&apos;s draft. Edit it to change tone,
                add crisis-specific context, or adjust what it should
                focus on — your changes are saved with this AAR.
              </p>
              {promptOpen ? (
                <div className="mt-2 space-y-2">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="input min-h-[220px] resize-y font-mono text-xs leading-relaxed"
                  />
                  <button
                    type="button"
                    onClick={() => setPrompt(DEFAULT_PROMPT)}
                    className="text-xs font-semibold text-un-blue-700 hover:text-un-blue-600"
                  >
                    Reset to default
                  </button>
                </div>
              ) : (
                <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-un-ink">
                  {prompt}
                </p>
              )}
            </Panel>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={status === "generating"}
              className="w-full rounded-full bg-un-gold-500 px-4 py-3 text-sm font-semibold text-un-blue-950 shadow-sm transition-colors hover:bg-un-gold-600 disabled:cursor-wait disabled:opacity-70"
            >
              {status === "generating"
                ? "Generating draft..."
                : status === "ready"
                  ? "Regenerate draft"
                  : "Generate draft with AI"}
            </button>
            </div>

            {/* Second grid column: attach and manage source documents. */}
            <Panel
              title="Attach source documents"
              subtitle={
                documents.length > 0
                  ? `${documents.length} attached`
                  : "No documents attached"
              }
              action={
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="shrink-0 rounded-lg border border-un-border px-3 py-1.5 text-xs font-semibold text-un-blue-700 hover:bg-un-blue-50"
                >
                  + Add
                </button>
              }
            >
              <p className="text-xs text-un-muted">
                Situation reports, interview notes, survey results, Crisis
                Board minutes — the AI drafts from what you attach here.
              </p>

              <details className="group mt-2">
                <summary className="cursor-pointer list-none text-xs font-semibold text-un-blue-700 marker:content-none">
                  <span className="group-open:hidden">
                    What should I attach?
                  </span>
                  <span className="hidden group-open:inline">
                    Hide guidance
                  </span>
                </summary>
                <div className="mt-2 space-y-2 rounded-lg border border-un-border bg-un-blue-50/40 p-3 text-xs leading-relaxed text-un-ink">
                  <p>
                    <span className="font-semibold">Most useful:</span> the
                    AAR Terms of Reference (if one exists), Crisis Board /
                    Country Management Team meeting minutes, corporate
                    funding approval records (e.g. TRAC3, Funding Window
                    allocations), and any programmatic proposals or recovery
                    plans. These carry most of the evidence the draft needs.
                  </p>
                  <p>
                    <span className="font-semibold">Adds real depth:</span>{" "}
                    SURGE/deployment records and end-of-mission reports,
                    business continuity or operational planning documents,
                    assessments and situation reports, and donor/external
                    funding records.
                  </p>
                  <p>
                    <span className="font-semibold">Usually not needed:</span>{" "}
                    individual project Annual Work Plans (a short summary of
                    programmatic pillars and budgets is enough), routine
                    emails, and exhaustive stakeholder contact lists — a
                    short list of key stakeholders is enough, and the fuller
                    list belongs in Step 2, not here.
                  </p>
                </div>
              </details>

              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  addFiles(e.dataTransfer.files);
                }}
                className={
                  "mt-3 flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors " +
                  (dragActive
                    ? "border-un-blue-500 bg-un-blue-50"
                    : "border-un-border hover:border-un-blue-400 hover:bg-un-blue-50/40")
                }
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <span className="text-un-blue-600">
                  <UploadIcon />
                </span>
                <span className="text-sm font-medium text-un-ink">
                  Drag files here, or click to browse
                </span>
                <span className="text-xs text-un-muted">
                  PDF, Word, Excel, or text files
                </span>
              </label>

              {fileError && (
                <p className="mt-2 text-xs text-red-600">{fileError}</p>
              )}

              <div className="mt-3 flex gap-2">
                <input
                  value={manualSourceName}
                  onChange={(e) => setManualSourceName(e.target.value)}
                  placeholder="Or add a source without a file, e.g. a verbal briefing"
                  className="input"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addManualSource();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={addManualSource}
                  className="shrink-0 rounded-lg border border-un-border px-3 text-sm font-semibold text-un-blue-700 hover:bg-un-blue-50"
                >
                  Add
                </button>
              </div>

              {documents.length > 0 && (
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {documents.map((doc) => (
                    <li
                      key={doc.id}
                      className="rounded-xl border border-un-border bg-un-blue-50/40 p-3.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2 text-sm text-un-ink">
                          <DocIcon />
                          <span className="min-w-0 truncate font-medium">
                            {doc.name}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => removeDocument(doc.id)}
                          aria-label={`Remove ${doc.name}`}
                          className="shrink-0 rounded-full p-1 text-un-muted hover:bg-white hover:text-red-600"
                        >
                          &times;
                        </button>
                      </div>
                      {doc.size ? (
                        <p className="mt-0.5 text-xs text-un-muted">
                          {formatBytes(doc.size)}
                        </p>
                      ) : null}
                      <label className="mt-2.5 block">
                        <span className="text-xs font-medium text-un-muted">
                          How was this gathered?
                        </span>
                        <select
                          value={doc.dataCollectionMethod ?? ""}
                          onChange={(e) =>
                            setDocumentMethod(doc.id, e.target.value)
                          }
                          className="input mt-1 py-1.5 text-xs"
                        >
                          <option value="">Not specified</option>
                          {dataCollectionMethods.map((method) => (
                            <option key={method} value={method}>
                              {method}
                            </option>
                          ))}
                        </select>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
        )}

        {step === 4 && (
        <div className="mt-8">
          <button
            type="button"
            onClick={() => setStep(3)}
            className="text-sm font-semibold text-un-blue-700 hover:text-un-blue-600"
          >
            &larr; Back to Sources
          </button>

          {/* Full width — this is now its own step, not sharing the row
              with the input panels. */}
          <div className="mt-5 rounded-2xl border border-un-border bg-un-surface shadow-sm">
            <div className="flex items-center justify-between border-b border-un-border px-6 py-4">
              <div>
                <h2 className="font-serif text-lg font-semibold text-un-ink">
                  Generated report
                </h2>
                <p className="text-xs text-un-muted">
                  Editable draft &middot; not yet saved to the library
                </p>
              </div>
              <StatusPill status={status} />
            </div>

            <div className="p-6">
              {status === "idle" && (
                <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-un-border py-16 text-center">
                  <p className="max-w-sm text-sm text-un-muted">
                    No draft yet. Head back to Sources, attach documents or
                    add a few notes, then generate a draft — you&apos;ll be
                    able to edit every section, and add timeline events,
                    findings, and people consulted right here.
                  </p>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="text-sm font-semibold text-un-blue-700 hover:text-un-blue-600"
                  >
                    &larr; Back to Sources
                  </button>
                </div>
              )}
              {status === "generating" && <GeneratingState />}

              {status === "ready" && (
                <div className="space-y-6">
                  {documents.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {documents.map((doc) => (
                        <span
                          key={doc.id}
                          className="inline-flex items-center gap-1 rounded-full bg-un-blue-50 px-2.5 py-1 text-xs font-medium text-un-blue-700"
                        >
                          <DocIcon /> {doc.name}
                        </span>
                      ))}
                    </div>
                  )}

                  <ArtifactField
                    label="Executive Summary"
                    value={draft.executiveSummary}
                    onChange={(v) =>
                      setDraft((d) => ({ ...d, executiveSummary: v }))
                    }
                  />
                  <ArtifactField
                    label="1.1 Country situation and context"
                    value={draft.countrySituation}
                    onChange={(v) =>
                      setDraft((d) => ({ ...d, countrySituation: v }))
                    }
                  />
                  <ArtifactField
                    label="1.2 Objectives of After Action Review"
                    value={draft.objectives}
                    onChange={(v) =>
                      setDraft((d) => ({ ...d, objectives: v }))
                    }
                  />
                  <ArtifactField
                    label="2.1 Scope of After Action Review"
                    value={draft.scope}
                    onChange={(v) => setDraft((d) => ({ ...d, scope: v }))}
                  />
                  <ArtifactField
                    label="2.2–2.4 Data collection, analysis, and validation"
                    value={draft.dataCollection}
                    onChange={(v) =>
                      setDraft((d) => ({ ...d, dataCollection: v }))
                    }
                  />

                  <div>
                    <div className="flex items-center justify-between border-b border-un-border pb-2">
                      <h3 className="font-serif text-base font-semibold text-un-ink">
                        3.2 Timeline of crisis events and response actions
                      </h3>
                      <span className="text-xs text-un-muted">
                        {timeline.length} entries
                      </span>
                    </div>
                    <div className="mt-3">
                      <TimelineField
                        entries={timeline}
                        onChange={setTimeline}
                      />
                    </div>
                  </div>

                  <AccordionArtifact
                    label="3.1 Contextual factors influencing the response"
                    value={draft.contextualFactors}
                    onChange={(v) =>
                      setDraft((d) => ({ ...d, contextualFactors: v }))
                    }
                    defaultOpen
                  />
                  <AccordionArtifact
                    label="3.3 UNDP in-country structure and response capacity"
                    value={draft.inCountryStructure}
                    onChange={(v) =>
                      setDraft((d) => ({ ...d, inCountryStructure: v }))
                    }
                  />
                  <AccordionArtifact
                    label="3.4 UNDP corporate response mechanisms"
                    value={draft.corporateResponseMechanisms}
                    onChange={(v) =>
                      setDraft((d) => ({
                        ...d,
                        corporateResponseMechanisms: v,
                      }))
                    }
                  />
                  <AccordionArtifact
                    label="3.5 Deployment of experts"
                    value={draft.deploymentOfExperts}
                    onChange={(v) =>
                      setDraft((d) => ({ ...d, deploymentOfExperts: v }))
                    }
                  />
                  <AccordionArtifact
                    label="3.6 Programmatic response"
                    value={draft.programmaticResponse}
                    onChange={(v) =>
                      setDraft((d) => ({ ...d, programmaticResponse: v }))
                    }
                  />
                  <AccordionArtifact
                    label="3.7 Operational response"
                    value={draft.operationalResponse}
                    onChange={(v) =>
                      setDraft((d) => ({ ...d, operationalResponse: v }))
                    }
                  />
                  <AccordionArtifact
                    label="3.8 Coordination"
                    value={draft.coordination}
                    onChange={(v) =>
                      setDraft((d) => ({ ...d, coordination: v }))
                    }
                  />
                  <AccordionArtifact
                    label="3.9 Communication and resource mobilization"
                    value={draft.communicationAndResourceMobilization}
                    onChange={(v) =>
                      setDraft((d) => ({
                        ...d,
                        communicationAndResourceMobilization: v,
                      }))
                    }
                  />

                  <div>
                    <div className="flex items-center justify-between border-b border-un-border pb-2">
                      <h3 className="font-serif text-base font-semibold text-un-ink">
                        Annex 7: Findings &amp; recommendations matrix
                      </h3>
                      <span className="text-xs text-un-muted">
                        {findingsMatrix.length} rows
                      </span>
                    </div>
                    <div className="mt-3">
                      <MatrixField
                        rows={findingsMatrix}
                        onChange={setFindingsMatrix}
                      />
                    </div>
                  </div>

                  <div>
                    <h3 className="font-serif text-base font-semibold text-un-ink border-b border-un-border pb-2">
                      4.1 Key findings and lessons learned
                    </h3>
                    {keyFindings.length > 0 ? (
                      <ul className="mt-3 space-y-2 text-sm">
                        {keyFindings.map((f, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-un-gold-500" />
                            <span className="text-un-ink/90">{f}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-un-muted">
                        Add rows to the Annex 7 matrix above to populate
                        this section.
                      </p>
                    )}
                  </div>

                  <div>
                    <h3 className="font-serif text-base font-semibold text-un-ink border-b border-un-border pb-2">
                      4.2 Actionable recommendations
                    </h3>
                    {recommendations.length > 0 ? (
                      <ul className="mt-3 space-y-2 text-sm">
                        {recommendations.map((r, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-un-blue-600" />
                            <span className="text-un-ink/90">{r}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-un-muted">
                        Add rows to the Annex 7 matrix above to populate
                        this section.
                      </p>
                    )}
                  </div>

                  <Bibliography documents={documents} />

                  <div>
                    <div className="flex items-center justify-between border-b border-un-border pb-2">
                      <h3 className="font-serif text-base font-semibold text-un-ink">
                        Annex 3: People consulted
                      </h3>
                      <span className="text-xs text-un-muted">
                        {interviewees.length} added
                      </span>
                    </div>
                    {invites.length > 0 && (
                      <button
                        type="button"
                        onClick={addInvitesToPeopleConsulted}
                        className="mt-3 w-full rounded-lg border border-dashed border-un-border px-3 py-1.5 text-sm font-semibold text-un-blue-700 hover:bg-un-blue-50"
                      >
                        + Add {invites.length} survey invite
                        {invites.length === 1 ? "" : "s"} from Step 2
                      </button>
                    )}
                    <div className="mt-3">
                      <IntervieweeField
                        people={interviewees}
                        onChange={setInterviewees}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        )}
      </div>
    </main>
  );
}

function StepIndicator({
  current,
  onSelect,
}: {
  current: Step;
  onSelect: (step: Step) => void;
}) {
  return (
    <ol className="mt-6 flex items-center gap-2 sm:gap-3">
      {STEPS.map((s, index) => {
        const isCurrent = s.id === current;
        const isDone = s.id < current;
        return (
          <li key={s.id} className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => onSelect(s.id)}
              className={
                "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs sm:text-sm font-semibold transition-colors " +
                (isCurrent
                  ? "bg-un-blue-600 text-white shadow-sm"
                  : isDone
                    ? "bg-un-blue-50 text-un-blue-700 hover:bg-un-blue-100"
                    : "bg-un-surface text-un-muted ring-1 ring-un-border hover:text-un-blue-700")
              }
            >
              <span
                className={
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[0.65rem] " +
                  (isCurrent
                    ? "bg-white text-un-blue-700"
                    : isDone
                      ? "bg-un-blue-600 text-white"
                      : "bg-un-border text-un-muted")
                }
              >
                {isDone ? "✓" : s.id}
              </span>
              {s.label}
            </button>
            {index < STEPS.length - 1 && (
              <span className="hidden h-px w-6 bg-un-border sm:block" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function StatusPill({ status }: { status: "idle" | "generating" | "ready" }) {
  const map = {
    idle: { text: "Waiting for input", cls: "bg-slate-100 text-slate-600" },
    generating: {
      text: "Drafting...",
      cls: "bg-un-gold-100 text-un-gold-600",
    },
    ready: {
      text: "Draft ready for edits",
      cls: "bg-un-blue-50 text-un-blue-700",
    },
  } as const;
  const s = map[status];
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${s.cls}`}>
      {s.text}
    </span>
  );
}

function GeneratingState() {
  return (
    <div className="space-y-6 animate-pulse">
      {["Executive Summary", "Introduction", "Methodology", "Analysis of the response"].map(
        (label) => (
          <div key={label}>
            <div className="h-4 w-40 rounded bg-un-border" />
            <div className="mt-3 h-20 rounded-lg bg-un-blue-50" />
          </div>
        ),
      )}
    </div>
  );
}
