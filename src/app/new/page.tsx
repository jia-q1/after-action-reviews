"use client";

import { useMemo, useState } from "react";
import {
  crisisTypes,
  dataCollectionMethods,
  priorityLevels,
  responseAreas,
  type CrisisType,
  type FindingRow,
  type Interviewee,
  type PriorityLevel,
  type ResponseArea,
  type ReviewStage,
  type TimelineEntry,
} from "@/data/reviews";
import { formatPeriod } from "@/lib/format";

const DEFAULT_PROMPT = `You are drafting an After Action Review for the UNDP Crisis Response Unit, following the official AAR Final Report template.

Using the short facts and bullet points provided for each section, write clear, professional, neutral prose suitable for an institutional record. Expand each set of bullets into a coherent paragraph without inventing details that are not supported by the inputs. Keep the Executive Summary concise. Findings and recommendations should stay as direct, actionable statements.`;

type OverviewState = {
  country: string;
  crisisType: CrisisType;
  periodStart: string;
  periodEnd: string;
  office: string;
  leadAuthor: string;
  stage: ReviewStage;
  sharepointUrl: string;
};

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

type Draft = {
  executiveSummary: string;
  countrySituation: string;
  objectives: string;
  scope: string;
  dataCollection: string;
  contextualFactors: string;
  inCountryStructure: string;
  corporateResponseMechanisms: string;
  deploymentOfExperts: string;
  programmaticResponse: string;
  operationalResponse: string;
  coordination: string;
  communicationAndResourceMobilization: string;
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

function toProse(bullets: string[], fallback: string) {
  const clean = bullets.map((b) => b.trim()).filter(Boolean);
  if (clean.length === 0) return fallback;
  return clean
    .map((b) => (/[.!?]$/.test(b) ? b : `${b}.`))
    .map((b) => b.charAt(0).toUpperCase() + b.slice(1))
    .join(" ");
}

export default function NewReviewPage() {
  const [overview, setOverview] = useState<OverviewState>(EMPTY_OVERVIEW);

  const [countrySituation, setCountrySituation] = useState<string[]>([]);
  const [objectives, setObjectives] = useState<string[]>([]);

  const [scope, setScope] = useState<string[]>([]);
  const [methods, setMethods] = useState<string[]>([]);
  const [validationNotes, setValidationNotes] = useState<string[]>([]);
  const [documents, setDocuments] = useState<string[]>([]);

  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);

  const [contextualFactors, setContextualFactors] = useState<string[]>([]);
  const [inCountryStructure, setInCountryStructure] = useState<string[]>([]);
  const [corporateResponseMechanisms, setCorporateResponseMechanisms] =
    useState<string[]>([]);
  const [deploymentOfExperts, setDeploymentOfExperts] = useState<string[]>(
    [],
  );
  const [programmaticResponse, setProgrammaticResponse] = useState<string[]>(
    [],
  );
  const [operationalResponse, setOperationalResponse] = useState<string[]>(
    [],
  );
  const [coordination, setCoordination] = useState<string[]>([]);
  const [communication, setCommunication] = useState<string[]>([]);

  const [findingsMatrix, setFindingsMatrix] = useState<FindingRow[]>([]);
  const [interviewees, setInterviewees] = useState<Interviewee[]>([]);

  const [promptOpen, setPromptOpen] = useState(false);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);

  const [status, setStatus] = useState<"idle" | "generating" | "ready">(
    "idle",
  );
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

  const keyFindings = useMemo(
    () => findingsMatrix.map((r) => r.finding).filter(Boolean),
    [findingsMatrix],
  );
  const recommendations = useMemo(
    () => findingsMatrix.map((r) => r.recommendation).filter(Boolean),
    [findingsMatrix],
  );

  function handleGenerate() {
    setStatus("generating");
    window.setTimeout(() => {
      const period = formatPeriod(overview.periodStart, overview.periodEnd);
      const countryLabel = overview.country.trim() || "the affected country";
      const crisisLabel = overview.crisisType.toLowerCase();

      const summaryParts = [
        `This After Action Review examines UNDP's response to the ${crisisLabel} in ${countryLabel}${period ? ` (${period})` : ""}.`,
      ];
      if (findingsMatrix.length > 0) {
        summaryParts.push(
          `The review identifies ${findingsMatrix.length} finding${findingsMatrix.length === 1 ? "" : "s"} across the response areas below, each with an associated recommendation and suggested priority level.`,
        );
      } else {
        summaryParts.push(
          "Findings and recommendations will populate this section as the Annex 7 matrix below is completed.",
        );
      }
      if (methods.length > 0) {
        summaryParts.push(
          `Evidence was gathered through ${methods.map((m) => m.toLowerCase()).join(", ")}.`,
        );
      }

      setDraft({
        executiveSummary: summaryParts.join(" "),
        countrySituation: toProse(
          countrySituation,
          "Add key facts about the country situation and context on the left to generate this section.",
        ),
        objectives: toProse(
          objectives,
          "Add the objectives of this After Action Review on the left to generate this section.",
        ),
        scope: toProse(
          scope,
          "Add scope notes on the left to generate this section.",
        ),
        dataCollection: [
          methods.length > 0
            ? `Data was collected through ${methods.map((m) => m.toLowerCase()).join(", ")}.`
            : "",
          toProse(validationNotes, ""),
        ]
          .filter(Boolean)
          .join(" ") ||
          "Select data collection methods and add validation notes on the left to generate this section.",
        contextualFactors: toProse(
          contextualFactors,
          "Add contextual factors on the left to generate this section.",
        ),
        inCountryStructure: toProse(
          inCountryStructure,
          "Add notes on in-country structure and response capacity on the left.",
        ),
        corporateResponseMechanisms: toProse(
          corporateResponseMechanisms,
          "Add notes on corporate response mechanisms on the left.",
        ),
        deploymentOfExperts: toProse(
          deploymentOfExperts,
          "Add notes on deployment of experts on the left.",
        ),
        programmaticResponse: toProse(
          programmaticResponse,
          "Add notes on programmatic response on the left.",
        ),
        operationalResponse: toProse(
          operationalResponse,
          "Add notes on operational response on the left.",
        ),
        coordination: toProse(
          coordination,
          "Add notes on coordination on the left.",
        ),
        communicationAndResourceMobilization: toProse(
          communication,
          "Add notes on communication and resource mobilization on the left.",
        ),
      });
      setStatus("ready");
    }, 1100);
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
              Enter short facts and bullet points for each section below —
              the AI drafts the full prose in the official AAR report format
              on the right. Edit anything before it goes to review.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
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

        <div className="mt-8 grid gap-6 lg:grid-cols-[400px_1fr]">
          {/* Left column: structured inputs, grouped by report section */}
          <div className="space-y-5">
            <Panel title="AAR overview">
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
                </div>
                <div className="grid grid-cols-2 gap-3">
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
                </div>
                <Field label="Responsible Country Office">
                  <input
                    value={overview.office}
                    onChange={(e) =>
                      setOverview((o) => ({ ...o, office: e.target.value }))
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
              </div>
            </Panel>

            <Panel title="1. Introduction">
              <div className="space-y-4">
                <BulletListField
                  label="1.1 Country situation — key facts"
                  hint="Short, factual points. The AI will turn these into a narrative paragraph."
                  items={countrySituation}
                  onChange={setCountrySituation}
                  placeholder="e.g. Earthquake displaced 90,000 people across 3 provinces"
                />
                <BulletListField
                  label="1.2 Objectives of this AAR"
                  items={objectives}
                  onChange={setObjectives}
                  placeholder="e.g. Assess timeliness of surge deployment"
                />
              </div>
            </Panel>

            <Panel title="2. Methodology">
              <div className="space-y-4">
                <BulletListField
                  label="2.1 Scope notes"
                  hint="What's in and out of scope for this review."
                  items={scope}
                  onChange={setScope}
                  placeholder="e.g. Covers emergency phase through early recovery handover"
                />
                <div>
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-un-muted">
                    2.2–2.3 Data collection methods
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
                <BulletListField
                  label="2.4 Validation notes"
                  items={validationNotes}
                  onChange={setValidationNotes}
                  placeholder="e.g. Findings validated in a workshop with Country Office SMT"
                />
                <BulletListField
                  label="Supporting documents (Annexes 2, 5, 6)"
                  hint="Desk review sources, survey/interview results, Crisis Board minutes."
                  items={documents}
                  onChange={setDocuments}
                  placeholder="e.g. Crisis Board minutes, Jan–Apr 2026"
                />
              </div>
            </Panel>

            <Panel
              title="3.2 Timeline of events"
              subtitle={`${timeline.length} entries`}
            >
              <TimelineField entries={timeline} onChange={setTimeline} />
            </Panel>

            <Panel title="3. Analysis of the response">
              <p className="text-xs text-un-muted">
                Short notes per response area. Each expands into a paragraph
                on the right.
              </p>
              <div className="mt-3 space-y-2.5">
                <AccordionField label="3.1 Contextual factors">
                  <BulletListField
                    items={contextualFactors}
                    onChange={setContextualFactors}
                    placeholder="Add a short point..."
                  />
                </AccordionField>
                <AccordionField label="3.3 In-country structure & capacity">
                  <BulletListField
                    items={inCountryStructure}
                    onChange={setInCountryStructure}
                    placeholder="Add a short point..."
                  />
                </AccordionField>
                <AccordionField label="3.4 Corporate response mechanisms">
                  <BulletListField
                    items={corporateResponseMechanisms}
                    onChange={setCorporateResponseMechanisms}
                    placeholder="Add a short point..."
                  />
                </AccordionField>
                <AccordionField label="3.5 Deployment of experts">
                  <BulletListField
                    items={deploymentOfExperts}
                    onChange={setDeploymentOfExperts}
                    placeholder="Add a short point..."
                  />
                </AccordionField>
                <AccordionField label="3.6 Programmatic response">
                  <BulletListField
                    items={programmaticResponse}
                    onChange={setProgrammaticResponse}
                    placeholder="Add a short point..."
                  />
                </AccordionField>
                <AccordionField label="3.7 Operational response">
                  <BulletListField
                    items={operationalResponse}
                    onChange={setOperationalResponse}
                    placeholder="Add a short point..."
                  />
                </AccordionField>
                <AccordionField label="3.8 Coordination">
                  <BulletListField
                    items={coordination}
                    onChange={setCoordination}
                    placeholder="Add a short point..."
                  />
                </AccordionField>
                <AccordionField label="3.9 Communication & resource mobilization">
                  <BulletListField
                    items={communication}
                    onChange={setCommunication}
                    placeholder="Add a short point..."
                  />
                </AccordionField>
              </div>
            </Panel>

            <Panel
              title="Annex 7: Findings & recommendations matrix"
              subtitle={`${findingsMatrix.length} rows`}
            >
              <p className="text-xs text-un-muted">
                Each row becomes one item in Section 4.1 (finding) and 4.2
                (recommendation), plus a row in the Annex 7 matrix.
              </p>
              <MatrixField
                rows={findingsMatrix}
                onChange={setFindingsMatrix}
              />
            </Panel>

            <Panel
              title="Annex 3: People consulted"
              subtitle={`${interviewees.length} added`}
            >
              <IntervieweeField
                people={interviewees}
                onChange={setInterviewees}
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

          {/* Right column: generated report preview, editable */}
          <div className="rounded-2xl border border-un-border bg-un-surface shadow-sm">
            <div className="flex items-center justify-between border-b border-un-border px-6 py-4">
              <div>
                <h2 className="font-serif text-lg font-semibold text-un-ink">
                  Generated report preview
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

                  {timeline.length > 0 && (
                    <div>
                      <h3 className="font-serif text-base font-semibold text-un-ink border-b border-un-border pb-2">
                        3.2 Timeline of crisis events and response actions
                      </h3>
                      <ol className="mt-3 space-y-2 text-sm">
                        {timeline.map((entry, i) => (
                          <li key={i} className="flex gap-3">
                            <span className="shrink-0 font-mono text-xs text-un-blue-700">
                              {entry.date || "—"}
                            </span>
                            <span className="text-un-ink/90">
                              {entry.event}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  <ArtifactField
                    label="3.1 Contextual factors influencing the response"
                    value={draft.contextualFactors}
                    onChange={(v) =>
                      setDraft((d) => ({ ...d, contextualFactors: v }))
                    }
                  />
                  <ArtifactField
                    label="3.3 UNDP in-country structure and response capacity"
                    value={draft.inCountryStructure}
                    onChange={(v) =>
                      setDraft((d) => ({ ...d, inCountryStructure: v }))
                    }
                  />
                  <ArtifactField
                    label="3.4 UNDP corporate response mechanisms"
                    value={draft.corporateResponseMechanisms}
                    onChange={(v) =>
                      setDraft((d) => ({
                        ...d,
                        corporateResponseMechanisms: v,
                      }))
                    }
                  />
                  <ArtifactField
                    label="3.5 Deployment of experts"
                    value={draft.deploymentOfExperts}
                    onChange={(v) =>
                      setDraft((d) => ({ ...d, deploymentOfExperts: v }))
                    }
                  />
                  <ArtifactField
                    label="3.6 Programmatic response"
                    value={draft.programmaticResponse}
                    onChange={(v) =>
                      setDraft((d) => ({ ...d, programmaticResponse: v }))
                    }
                  />
                  <ArtifactField
                    label="3.7 Operational response"
                    value={draft.operationalResponse}
                    onChange={(v) =>
                      setDraft((d) => ({ ...d, operationalResponse: v }))
                    }
                  />
                  <ArtifactField
                    label="3.8 Coordination"
                    value={draft.coordination}
                    onChange={(v) =>
                      setDraft((d) => ({ ...d, coordination: v }))
                    }
                  />
                  <ArtifactField
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
                        Add rows to the Annex 7 matrix on the left to
                        populate this section.
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
                        Add rows to the Annex 7 matrix on the left to
                        populate this section.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
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

function AccordionField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-lg border border-un-border open:bg-un-blue-50/30">
      <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold uppercase tracking-wide text-un-muted marker:content-none flex items-center justify-between gap-2">
        {label}
        <span
          aria-hidden
          className="text-un-muted transition-transform group-open:rotate-180"
        >
          &#9662;
        </span>
      </summary>
      <div className="px-3 pb-3 pt-1">{children}</div>
    </details>
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

function BulletListField({
  label,
  hint,
  items,
  onChange,
  placeholder,
}: {
  label?: string;
  hint?: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}) {
  const [draftText, setDraftText] = useState("");

  function add() {
    if (!draftText.trim()) return;
    onChange([...items, draftText.trim()]);
    setDraftText("");
  }

  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  return (
    <div>
      {label && (
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-un-muted">
          {label}
        </span>
      )}
      {hint && <p className="mb-2 text-xs text-un-muted">{hint}</p>}
      {items.length > 0 && (
        <ul className="mb-2 space-y-1.5">
          {items.map((item, index) => (
            <li
              key={index}
              className="flex items-start gap-2 rounded-lg border border-un-border bg-un-blue-50/60 px-3 py-1.5 text-sm"
            >
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-un-blue-600" />
              <span className="flex-1 text-un-ink">{item}</span>
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
        </ul>
      )}
      <div className="flex gap-2">
        <input
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          placeholder={placeholder ?? "Add a short point..."}
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
      {entries.length > 0 && (
        <ul className="mb-2 space-y-1.5">
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
        </ul>
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
    <div className="mt-3">
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
        Fill in the overview and any of the sections on the left, then
        generate a draft. You&apos;ll be able to edit every section before it
        goes to review.
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
