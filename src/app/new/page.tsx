"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  crisisTypes,
  dataCollectionMethods,
  priorityLevels,
  responseAreas,
  surveyTemplates,
  type CrisisType,
  type FindingRow,
  type Interviewee,
  type PriorityLevel,
  type ResponseArea,
  type ReviewStage,
  type TimelineEntry,
} from "@/data/reviews";
import { formatPeriod } from "@/lib/format";
import {
  getSavedDraft,
  upsertSavedDraft,
  type AarOverview as OverviewState,
  type DocumentSource,
  type InviteStatus,
  type ReportDraft as Draft,
  type SavedAarDraft,
  type SurveyInvite,
} from "@/lib/draft-storage";

const STEPS = [
  { id: 1, label: "AAR Basics" },
  { id: 2, label: "Send Surveys" },
  { id: 3, label: "Sources & Draft" },
] as const;
type Step = (typeof STEPS)[number]["id"];

const DEFAULT_PROMPT = `You are drafting an After Action Review for the UNDP Crisis Response Unit, following the official AAR Final Report template.

Read the attached source documents and any notes provided, and extract the relevant facts for each section. Write clear, professional, neutral prose suitable for an institutional record, and do not invent details that aren't supported by the sources. Where a section isn't covered yet, leave a clear note for the human reviewer instead of guessing. Findings and recommendations should stay as direct, actionable statements.`;

const EMPTY_OVERVIEW: OverviewState = {
  country: "",
  crisisType: crisisTypes[0],
  periodStart: "",
  periodEnd: "",
  office: "",
  leadAuthor: "",
  stage: "Drafting",
  sharepointUrl: "",
};

const EMPTY_INVITE_FORM = {
  name: "",
  role: "",
  unit: "",
  email: "",
  surveyId: surveyTemplates[0].id,
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

function formatBytes(bytes?: number) {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value < 10 && i > 0 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
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

  const [draftId, setDraftId] = useState("");
  const [step, setStep] = useState<Step>(1);

  const [overview, setOverview] = useState<OverviewState>(EMPTY_OVERVIEW);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [invites, setInvites] = useState<SurveyInvite[]>([]);
  const [inviteForm, setInviteForm] = useState(EMPTY_INVITE_FORM);

  const [documents, setDocuments] = useState<DocumentSource[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [manualSourceName, setManualSourceName] = useState("");

  const [methods, setMethods] = useState<string[]>([]);
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

  // One-time hydration from an external source (the URL and localStorage)
  // on mount — not state derived from props/state, so setState here is the
  // sanctioned pattern rather than the anti-pattern this rule targets.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const paramId = searchParams.get("draft");
    if (paramId) {
      const saved = getSavedDraft(paramId);
      if (saved) {
        setDraftId(saved.id);
        setOverview(saved.overview);
        setInvites(saved.invites);
        setDocuments(saved.documents);
        setMethods(saved.methods);
        setNotes(saved.notes);
        setDraft(saved.reportDraft);
        setTimeline(saved.timeline);
        setFindingsMatrix(saved.findingsMatrix);
        setInterviewees(saved.interviewees);
        setStep(saved.step);
        if (saved.reportDraft.executiveSummary) setStatus("ready");
        return;
      }
    }
    setDraftId(crypto.randomUUID());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

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
    ? surveyTemplates.filter((s) =>
        s.suggestedRoles.some((r) => r.toLowerCase() === roleValue),
      )
    : [];
  const otherSurveysForRole = surveysForRole.filter(
    (s) => s.id !== inviteForm.surveyId,
  );

  function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const added = Array.from(fileList).map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
    }));
    setDocuments((prev) => [...prev, ...added]);
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

  function addInvite() {
    if (!inviteForm.name.trim() || !inviteForm.email.trim()) return;
    setInvites((prev) => [
      ...prev,
      { id: crypto.randomUUID(), status: "Draft", ...inviteForm },
    ]);
    setInviteForm(EMPTY_INVITE_FORM);
  }

  function removeInvite(id: string) {
    setInvites((prev) => prev.filter((i) => i.id !== id));
  }

  function sendInvite(id: string) {
    setInvites((prev) =>
      prev.map((invite) =>
        invite.id === id
          ? {
              ...invite,
              status: "Sent",
              sentAt: new Date().toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              }),
            }
          : invite,
      ),
    );
  }

  function sendAllPending() {
    setInvites((prev) =>
      prev.map((invite) =>
        invite.status === "Draft"
          ? {
              ...invite,
              status: "Sent",
              sentAt: new Date().toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              }),
            }
          : invite,
      ),
    );
  }

  function markResponded(id: string) {
    setInvites((prev) =>
      prev.map((invite) =>
        invite.id === id
          ? {
              ...invite,
              status: "Responded" as InviteStatus,
              respondedAt: new Date().toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              }),
            }
          : invite,
      ),
    );
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

  function buildSavedDraft(opts?: {
    overview?: OverviewState;
    step?: Step;
  }): SavedAarDraft {
    return {
      id: draftId,
      step: opts?.step ?? step,
      updatedAt: new Date().toISOString(),
      overview: opts?.overview ?? overview,
      invites,
      documents,
      methods,
      notes,
      reportDraft: draft,
      timeline,
      findingsMatrix,
      interviewees,
    };
  }

  function handleSaveAsDraft() {
    if (!draftId) return;
    upsertSavedDraft(buildSavedDraft());
    router.push("/");
  }

  function handleSaveAndWaitForResponses() {
    if (!draftId) return;
    const updatedOverview: OverviewState = {
      ...overview,
      stage: "Awaiting Survey Responses",
    };
    setOverview(updatedOverview);
    upsertSavedDraft(
      buildSavedDraft({ overview: updatedOverview, step: 2 }),
    );
    router.push("/");
  }

  function handleGenerate() {
    setStatus("generating");
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

      const docNames = documents.map((d) => d.name);
      const hasDocs = docNames.length > 0;
      const hasNotes = points.length > 0;

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
        return `Attach source documents or add notes on the left to generate ${topic}.`;
      }

      const period = formatPeriod(overview.periodStart, overview.periodEnd);
      const countryLabel = overview.country.trim() || "the affected country";
      const crisisLabel = overview.crisisType.toLowerCase();

      const summaryParts = [
        `This After Action Review examines UNDP's response to the ${crisisLabel} in ${countryLabel}${period ? ` (${period})` : ""}.`,
      ];
      if (hasDocs) {
        summaryParts.push(
          `This draft was generated from ${documents.length} attached source${documents.length === 1 ? "" : "s"}${hasNotes ? " and the notes provided" : ""}.`,
        );
      } else if (hasNotes) {
        summaryParts.push("This draft was generated from the notes provided.");
      } else {
        summaryParts.push(
          "Attach source documents on the left, or add notes, then regenerate to populate this draft.",
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
          methods.length > 0
            ? `Evidence was gathered through ${methods.map((m) => m.toLowerCase()).join(", ")}.`
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
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSaveAsDraft}
              className="rounded-full border border-un-border px-4 py-2 text-sm font-semibold text-un-blue-700 hover:bg-un-blue-50"
            >
              Save as draft
            </button>
            <button
              type="button"
              disabled={status !== "ready"}
              className="rounded-full bg-un-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-un-blue-700 disabled:cursor-not-allowed disabled:bg-un-border disabled:text-un-muted"
            >
              Submit for review
            </button>
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
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Crisis type">
                    <select
                      value={overview.crisisType}
                      onChange={(e) =>
                        setOverview((o) => ({
                          ...o,
                          crisisType: e.target.value as CrisisType,
                        }))
                      }
                      className="input"
                    >
                      {crisisTypes.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Period start">
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
                    <Field label="Period end">
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
                    <Field label="Stage">
                      <select
                        value={overview.stage}
                        onChange={(e) =>
                          setOverview((o) => ({
                            ...o,
                            stage: e.target.value as ReviewStage,
                          }))
                        }
                        className="input"
                      >
                        <option value="Drafting">Drafting</option>
                        <option value="In Review">In Review</option>
                        <option value="Validation">Validation</option>
                      </select>
                    </Field>
                    <Field label="Responsible Country Office">
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
                    <Field label="SharePoint link (optional)">
                      <input
                        value={overview.sharepointUrl}
                        onChange={(e) =>
                          setOverview((o) => ({
                            ...o,
                            sharepointUrl: e.target.value,
                          }))
                        }
                        placeholder="Link to the full report or supporting annexes"
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
            <div className="flex items-center justify-between gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
              <span>
                <strong>Waiting for survey responses.</strong>{" "}
                {invites.filter((i) => i.status === "Responded").length} of{" "}
                {invites.length} contributors have responded so far. Mark
                responses in as they come in, then continue when
                you&apos;re ready.
              </span>
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
                {surveyTemplates.map((survey) => (
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
                            key={index}
                            className="flex gap-2 text-xs text-un-ink/90"
                          >
                            <span className="shrink-0 text-un-muted">
                              {index + 1}.
                            </span>
                            {question}
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
                    {surveyTemplates
                      .find((s) => s.id === inviteForm.surveyId)
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
                                surveyId: s.id,
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
                      value={inviteForm.surveyId}
                      onChange={(e) =>
                        setInviteForm((f) => ({
                          ...f,
                          surveyId: e.target.value,
                        }))
                      }
                      className="input"
                    >
                      {surveyTemplates.map((survey) => (
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

              {invites.length > 0 && (
                <div className="mt-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-un-muted">
                      Invite list &middot;{" "}
                      {invites.filter((i) => i.status === "Responded").length}{" "}
                      of {invites.length} responded
                    </span>
                    {invites.some((i) => i.status === "Draft") && (
                      <button
                        type="button"
                        onClick={sendAllPending}
                        className="text-xs font-semibold text-un-blue-700 hover:text-un-blue-600"
                      >
                        Send all pending
                      </button>
                    )}
                  </div>
                  <ul className="mt-2 space-y-2">
                    {invites.map((invite) => {
                      const survey = surveyTemplates.find(
                        (s) => s.id === invite.surveyId,
                      );
                      return (
                        <li
                          key={invite.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-un-border bg-un-blue-50/60 px-3 py-2"
                        >
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
                                &#10003; Responded {invite.respondedAt}
                              </span>
                            ) : invite.status === "Sent" ? (
                              <>
                                <span className="rounded-full bg-un-gold-100 px-2.5 py-1 text-xs font-semibold text-un-gold-600 ring-1 ring-un-gold-500/30">
                                  Sent {invite.sentAt}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => markResponded(invite.id)}
                                  className="rounded-full border border-un-border px-3 py-1 text-xs font-semibold text-un-blue-700 hover:bg-un-blue-50"
                                >
                                  Mark as responded
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => sendInvite(invite.id)}
                                className="rounded-full bg-un-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-un-blue-700"
                              >
                                Send invite
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => removeInvite(invite.id)}
                              aria-label={`Remove ${invite.name}`}
                              className="text-un-muted hover:text-un-blue-700"
                            >
                              &times;
                            </button>
                          </div>
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
                  Continue to Sources &amp; Draft &rarr;
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
        <div className="mt-8 grid gap-6 lg:grid-cols-[380px_1fr]">
          {/* Left column: light-touch inputs, documents first */}
          <div className="space-y-5">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="text-sm font-semibold text-un-blue-700 hover:text-un-blue-600"
            >
              &larr; Back to Send Surveys
            </button>

            <Panel
              title="Attach source documents"
              subtitle={
                documents.length > 0 ? `${documents.length} attached` : undefined
              }
            >
              <p className="text-xs text-un-muted">
                Situation reports, interview notes, survey results, Crisis
                Board minutes — the AI drafts from what you attach here.
              </p>

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
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => addFiles(e.target.files)}
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

              {documents.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {documents.map((doc) => (
                    <li
                      key={doc.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-un-border bg-un-blue-50/60 px-3 py-2 text-sm"
                    >
                      <span className="flex min-w-0 items-center gap-2 text-un-ink">
                        <DocIcon />
                        <span className="truncate">{doc.name}</span>
                        {doc.size ? (
                          <span className="shrink-0 text-xs text-un-muted">
                            {formatBytes(doc.size)}
                          </span>
                        ) : null}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeDocument(doc.id)}
                        aria-label={`Remove ${doc.name}`}
                        className="shrink-0 text-un-muted hover:text-un-blue-700"
                      >
                        &times;
                      </button>
                    </li>
                  ))}
                </ul>
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

              <div className="mt-4">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-un-muted">
                  How was evidence gathered? (optional)
                </span>
                <div className="flex flex-wrap gap-2">
                  {dataCollectionMethods.map((method) => {
                    const active = methods.includes(method);
                    return (
                      <button
                        key={method}
                        type="button"
                        onClick={() =>
                          setMethods((prev) =>
                            active
                              ? prev.filter((m) => m !== method)
                              : [...prev, method],
                          )
                        }
                        className={
                          "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors " +
                          (active
                            ? "border-un-blue-600 bg-un-blue-600 text-white"
                            : "border-un-border text-un-muted hover:border-un-blue-400 hover:text-un-blue-700")
                        }
                      >
                        {method}
                      </button>
                    );
                  })}
                </div>
              </div>
            </Panel>

            <Panel title="Notes for the AI (optional)">
              <p className="text-xs text-un-muted">
                Anything not captured in the attached documents. One point
                per line works best.
              </p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  "e.g.\nShelter procurement took six weeks against a four-week target\nCoordination with the Office of Civil Defense was a clear strength"
                }
                className="input mt-2 min-h-[120px] resize-y"
              />
            </Panel>

            <Panel
              title="Prompt instructions"
              subtitle={promptOpen ? undefined : "Using default template"}
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
              {promptOpen ? (
                <div className="space-y-2">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="input min-h-[160px] resize-y font-mono text-xs leading-relaxed"
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
                <p className="text-xs leading-relaxed text-un-muted line-clamp-3">
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

          {/* Right column: the generated report, editable and interactive */}
          <div className="rounded-2xl border border-un-border bg-un-surface shadow-sm">
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
              {status === "idle" && <EmptyState />}
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

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid var(--un-border);
          background: white;
          padding: 0.55rem 0.75rem;
          font-size: 0.875rem;
          color: var(--un-ink);
        }
        .input:focus {
          outline: none;
          border-color: var(--un-blue-500);
          box-shadow: 0 0 0 3px var(--un-blue-100);
        }
      `}</style>
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

function Panel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-un-border bg-un-surface p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-un-ink">{title}</h2>
        {action ??
          (subtitle && (
            <span className="text-xs text-un-muted">{subtitle}</span>
          ))}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-un-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

function TimelineField({
  entries,
  onChange,
}: {
  entries: TimelineEntry[];
  onChange: (entries: TimelineEntry[]) => void;
}) {
  const [date, setDate] = useState("");
  const [event, setEvent] = useState("");

  function add() {
    if (!event.trim()) return;
    onChange([...entries, { date, event: event.trim() }]);
    setDate("");
    setEvent("");
  }

  function remove(index: number) {
    onChange(entries.filter((_, i) => i !== index));
  }

  return (
    <div>
      {entries.length > 0 ? (
        <ol className="mb-2 space-y-1.5">
          {entries.map((entry, index) => (
            <li
              key={index}
              className="flex items-start gap-2 rounded-lg border border-un-border bg-un-blue-50/60 px-3 py-1.5 text-sm"
            >
              <span className="shrink-0 font-mono text-xs text-un-blue-700">
                {entry.date || "—"}
              </span>
              <span className="flex-1 text-un-ink">{entry.event}</span>
              <button
                type="button"
                onClick={() => remove(index)}
                aria-label="Remove"
                className="text-un-muted hover:text-un-blue-700"
              >
                &times;
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mb-2 text-sm text-un-muted">
          No events added yet — add key dates from the sources below.
        </p>
      )}
      <div className="flex gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="input w-36 shrink-0"
        />
        <input
          value={event}
          onChange={(e) => setEvent(e.target.value)}
          placeholder="e.g. Crisis Board activates response plan"
          className="input"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button
          type="button"
          onClick={add}
          className="shrink-0 rounded-lg border border-un-border px-3 text-sm font-semibold text-un-blue-700 hover:bg-un-blue-50"
        >
          Add
        </button>
      </div>
    </div>
  );
}

function IntervieweeField({
  people,
  onChange,
}: {
  people: Interviewee[];
  onChange: (people: Interviewee[]) => void;
}) {
  const [form, setForm] = useState<Interviewee>({
    name: "",
    title: "",
    agency: "",
  });

  function add() {
    if (!form.name.trim()) return;
    onChange([...people, form]);
    setForm({ name: "", title: "", agency: "" });
  }

  function remove(index: number) {
    onChange(people.filter((_, i) => i !== index));
  }

  return (
    <div>
      {people.length > 0 && (
        <ul className="mb-3 space-y-1.5">
          {people.map((person, index) => (
            <li
              key={index}
              className="flex items-center justify-between gap-2 rounded-lg border border-un-border bg-un-blue-50/60 px-3 py-1.5 text-sm"
            >
              <span className="text-un-ink">
                <span className="font-medium">{person.name}</span>
                {person.title && (
                  <span className="text-un-muted"> &middot; {person.title}</span>
                )}
                {person.agency && (
                  <span className="text-un-muted"> &middot; {person.agency}</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => remove(index)}
                aria-label={`Remove ${person.name}`}
                className="text-un-muted hover:text-un-blue-700"
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-3 gap-2">
        <input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Name"
          className="input"
        />
        <input
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder="Title"
          className="input"
        />
        <input
          value={form.agency}
          onChange={(e) =>
            setForm((f) => ({ ...f, agency: e.target.value }))
          }
          placeholder="Agency / unit"
          className="input"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
      </div>
      <button
        type="button"
        onClick={add}
        className="mt-2 w-full rounded-lg border border-dashed border-un-border px-3 py-1.5 text-sm font-semibold text-un-blue-700 hover:bg-un-blue-50"
      >
        + Add person
      </button>
    </div>
  );
}

const EMPTY_MATRIX_ROW: FindingRow = {
  responseArea: responseAreas[0],
  finding: "",
  recommendation: "",
  keyActions: "",
  priority: "Medium",
};

function MatrixField({
  rows,
  onChange,
}: {
  rows: FindingRow[];
  onChange: (rows: FindingRow[]) => void;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FindingRow>(EMPTY_MATRIX_ROW);

  function add() {
    if (!form.finding.trim() || !form.recommendation.trim()) return;
    onChange([...rows, form]);
    setForm(EMPTY_MATRIX_ROW);
    setFormOpen(false);
  }

  function remove(index: number) {
    onChange(rows.filter((_, i) => i !== index));
  }

  return (
    <div>
      {rows.length > 0 && (
        <ul className="mb-3 space-y-2">
          {rows.map((row, index) => (
            <li
              key={index}
              className="rounded-lg border border-un-border bg-un-blue-50/60 px-3 py-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-un-blue-600">
                    {row.responseArea}
                  </span>
                  <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-[0.65rem] font-semibold text-un-blue-700 ring-1 ring-un-blue-200">
                    {row.priority}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  aria-label="Remove finding"
                  className="text-un-muted hover:text-un-blue-700"
                >
                  &times;
                </button>
              </div>
              <p className="mt-1 text-sm text-un-ink">{row.finding}</p>
              <p className="mt-1 text-xs text-un-muted">
                &rarr; {row.recommendation}
              </p>
            </li>
          ))}
        </ul>
      )}

      {formOpen ? (
        <div className="space-y-2.5 rounded-lg border border-un-border p-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Response area">
              <select
                value={form.responseArea}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    responseArea: e.target.value as ResponseArea,
                  }))
                }
                className="input"
              >
                {responseAreas.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Priority">
              <select
                value={form.priority}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    priority: e.target.value as PriorityLevel,
                  }))
                }
                className="input"
              >
                {priorityLevels.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Finding">
            <input
              value={form.finding}
              onChange={(e) =>
                setForm((f) => ({ ...f, finding: e.target.value }))
              }
              placeholder="What happened, stated plainly"
              className="input"
            />
          </Field>
          <Field label="Recommendation">
            <input
              value={form.recommendation}
              onChange={(e) =>
                setForm((f) => ({ ...f, recommendation: e.target.value }))
              }
              placeholder="What should change"
              className="input"
            />
          </Field>
          <Field label="Key actions required">
            <input
              value={form.keyActions}
              onChange={(e) =>
                setForm((f) => ({ ...f, keyActions: e.target.value }))
              }
              placeholder="Who does what, concretely"
              className="input"
            />
          </Field>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={add}
              className="rounded-lg bg-un-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-un-blue-700"
            >
              Add row
            </button>
            <button
              type="button"
              onClick={() => {
                setFormOpen(false);
                setForm(EMPTY_MATRIX_ROW);
              }}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold text-un-muted hover:bg-un-blue-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="w-full rounded-lg border border-dashed border-un-border px-3 py-2 text-sm font-semibold text-un-blue-700 hover:bg-un-blue-50"
        >
          + Add a finding
        </button>
      )}
    </div>
  );
}

function ArtifactField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <h3 className="font-serif text-base font-semibold text-un-ink border-b border-un-border pb-2">
        {label}
      </h3>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input mt-2 min-h-[90px] resize-y leading-relaxed"
      />
    </div>
  );
}

function AccordionArtifact({
  label,
  value,
  onChange,
  defaultOpen = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  defaultOpen?: boolean;
}) {
  return (
    <details
      className="group rounded-lg border border-un-border open:bg-un-blue-50/20"
      open={defaultOpen}
    >
      <summary className="cursor-pointer list-none px-3.5 py-2.5 text-sm font-semibold text-un-ink marker:content-none flex items-center justify-between gap-2">
        {label}
        <span
          aria-hidden
          className="text-un-muted transition-transform group-open:rotate-180"
        >
          &#9662;
        </span>
      </summary>
      <div className="px-3.5 pb-3.5 pt-1">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input min-h-[80px] resize-y leading-relaxed"
        />
      </div>
    </details>
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

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-un-border py-16 text-center">
      <div className="rounded-full bg-un-blue-50 p-3 text-un-blue-600">
        <SparkleIcon />
      </div>
      <p className="max-w-sm text-sm text-un-muted">
        Attach source documents or add a few notes on the left, then
        generate a draft. You&apos;ll be able to edit every section — and
        add timeline events, findings, and people consulted — right here.
      </p>
    </div>
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

function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M12 2l1.6 5.4L19 9l-5.4 1.6L12 16l-1.6-5.4L5 9l5.4-1.6L12 2Z" />
      <path d="M19 15l0.7 2.3L22 18l-2.3 0.7L19 21l-0.7-2.3L16 18l2.3-0.7L19 15Z" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 16V4" />
      <path d="M7 9l5-5 5 5" />
      <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-4 w-4 shrink-0 text-un-blue-600"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path d="M5 3h7l3 3v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M12 3v3h3" />
    </svg>
  );
}
