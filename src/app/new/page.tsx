"use client";

import { useState } from "react";
import { categories } from "@/data/reviews";

const DEFAULT_PROMPT = `You are drafting an After Action Review for the United Nations After Action Review Library.

Using the event details and source material provided, produce a clear, professional draft with four sections: Context, What Worked Well, Challenges, and Recommendations. Write in neutral, factual language suitable for an internal institutional record. Keep each bullet concise and specific enough to be actionable. Do not invent details that are not supported by the provided sources.`;

type Source = { id: string; label: string };

type DataPoint = { id: string; label: string; value: string };

type SurveyResponse = {
  id: string;
  respondent: string;
  rating: number;
  whatWorked: string;
  challenges: string;
  recommendations: string;
};

const EMPTY_SURVEY_FORM = {
  respondent: "",
  rating: 0,
  whatWorked: "",
  challenges: "",
  recommendations: "",
};

type Draft = {
  context: string;
  whatWorked: string;
  challenges: string;
  recommendations: string;
};

const EMPTY_DRAFT: Draft = {
  context: "",
  whatWorked: "",
  challenges: "",
  recommendations: "",
};

function bulletsFrom(
  responses: SurveyResponse[],
  field: "whatWorked" | "challenges" | "recommendations",
  fallback: string,
) {
  const lines = responses
    .map((r) => r[field].trim())
    .filter(Boolean)
    .map((line) => `- ${line}`);
  return lines.length > 0 ? lines.join("\n") : fallback;
}

function mockGenerate(
  eventTitle: string,
  notes: string,
  surveyResponses: SurveyResponse[],
  dataPoints: DataPoint[],
): Draft {
  const title = eventTitle.trim() || "this event";
  const contextParts = [
    `This review covers ${title}. It summarizes the sequence of activities, the teams involved, and the operating conditions, drawing on the source material and notes provided.`,
  ];
  if (notes.trim()) {
    contextParts.push(
      "Key input notes were incorporated from the source material panel.",
    );
  }
  if (dataPoints.length > 0) {
    const figures = dataPoints
      .filter((d) => d.label.trim() && d.value.trim())
      .map((d) => `${d.label.trim()}: ${d.value.trim()}`)
      .join("; ");
    if (figures) {
      contextParts.push(`Recorded deployment figures: ${figures}.`);
    }
  }
  if (surveyResponses.length > 0) {
    const rated = surveyResponses.filter((r) => r.rating > 0);
    const avg =
      rated.length > 0
        ? (
            rated.reduce((sum, r) => sum + r.rating, 0) / rated.length
          ).toFixed(1)
        : null;
    contextParts.push(
      `${surveyResponses.length} survey response${
        surveyResponses.length === 1 ? "" : "s"
      } were collected from participants${
        avg ? `, with an average overall rating of ${avg}/5` : ""
      }, and are reflected directly in the sections below.`,
    );
  }

  return {
    context: contextParts.join(" "),
    whatWorked: bulletsFrom(
      surveyResponses,
      "whatWorked",
      "- Coordination between the core team and supporting units stayed clear throughout the event.\n- Preparation steps completed ahead of the event reduced last-minute issues.",
    ),
    challenges: bulletsFrom(
      surveyResponses,
      "challenges",
      "- Some information did not reach all stakeholders on time.\n- Resource availability created delays at a key point in the timeline.",
    ),
    recommendations: bulletsFrom(
      surveyResponses,
      "recommendations",
      "- Establish a single point of contact for time-sensitive updates.\n- Confirm resource availability at least one cycle ahead of similar future events.",
    ),
  };
}

export default function NewReviewPage() {
  const [eventTitle, setEventTitle] = useState("");
  const [category, setCategory] = useState<string>(categories[0]);
  const [office, setOffice] = useState("");
  const [location, setLocation] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [notes, setNotes] = useState("");

  const [sources, setSources] = useState<Source[]>([
    { id: "s1", label: "Field team debrief notes.docx" },
    { id: "s2", label: "Incident timeline.xlsx" },
  ]);
  const [newSourceLabel, setNewSourceLabel] = useState("");

  const [dataPoints, setDataPoints] = useState<DataPoint[]>([
    { id: "d1", label: "Personnel deployed", value: "42" },
    { id: "d2", label: "Duration", value: "5 days" },
    { id: "d3", label: "Locations covered", value: "3 field sites" },
  ]);
  const [newDataLabel, setNewDataLabel] = useState("");
  const [newDataValue, setNewDataValue] = useState("");

  const [surveyResponses, setSurveyResponses] = useState<SurveyResponse[]>([
    {
      id: "r1",
      respondent: "Field coordinator",
      rating: 4,
      whatWorked: "Daily check-ins kept every team aligned on priorities.",
      challenges: "Handover notes between shifts were sometimes incomplete.",
      recommendations:
        "Use a shared handover template for every shift change.",
    },
    {
      id: "r2",
      respondent: "Volunteer lead",
      rating: 5,
      whatWorked: "Volunteers felt well briefed and knew who to contact.",
      challenges: "Transport to the second site was tighter than planned.",
      recommendations: "Add a buffer vehicle for the second site next time.",
    },
  ]);
  const [surveyForm, setSurveyForm] = useState(EMPTY_SURVEY_FORM);
  const [surveyFormOpen, setSurveyFormOpen] = useState(false);

  const [promptOpen, setPromptOpen] = useState(false);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);

  const [status, setStatus] = useState<"idle" | "generating" | "ready">(
    "idle",
  );
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

  function handleAddSource() {
    if (!newSourceLabel.trim()) return;
    setSources((prev) => [
      ...prev,
      { id: crypto.randomUUID(), label: newSourceLabel.trim() },
    ]);
    setNewSourceLabel("");
  }

  function handleRemoveSource(id: string) {
    setSources((prev) => prev.filter((s) => s.id !== id));
  }

  function handleAddDataPoint() {
    if (!newDataLabel.trim() || !newDataValue.trim()) return;
    setDataPoints((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        label: newDataLabel.trim(),
        value: newDataValue.trim(),
      },
    ]);
    setNewDataLabel("");
    setNewDataValue("");
  }

  function handleRemoveDataPoint(id: string) {
    setDataPoints((prev) => prev.filter((d) => d.id !== id));
  }

  function handleAddSurveyResponse() {
    const hasContent =
      surveyForm.rating > 0 ||
      surveyForm.whatWorked.trim() ||
      surveyForm.challenges.trim() ||
      surveyForm.recommendations.trim();
    if (!hasContent) return;
    setSurveyResponses((prev) => [
      ...prev,
      { id: crypto.randomUUID(), ...surveyForm },
    ]);
    setSurveyForm(EMPTY_SURVEY_FORM);
    setSurveyFormOpen(false);
  }

  function handleRemoveSurveyResponse(id: string) {
    setSurveyResponses((prev) => prev.filter((r) => r.id !== id));
  }

  function handleGenerate() {
    setStatus("generating");
    window.setTimeout(() => {
      setDraft(mockGenerate(eventTitle, notes, surveyResponses, dataPoints));
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
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-full border border-un-border px-4 py-2 text-sm font-semibold text-un-blue-700 hover:bg-un-blue-50"
            >
              Save concept
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

        <div className="mt-8 grid gap-6 lg:grid-cols-[360px_1fr]">
          {/* Left column: sources & inputs, NotebookLM-style */}
          <div className="space-y-5">
            <Panel title="Event details">
              <div className="space-y-3">
                <Field label="Event title">
                  <input
                    value={eventTitle}
                    onChange={(e) => setEventTitle(e.target.value)}
                    placeholder="e.g. Regional Health Outreach Campaign"
                    className="input"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Theme">
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="input"
                    >
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Event date">
                    <input
                      type="date"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      className="input"
                    />
                  </Field>
                </div>
                <Field label="Responsible office">
                  <input
                    value={office}
                    onChange={(e) => setOffice(e.target.value)}
                    placeholder="e.g. Logistics Cell"
                    className="input"
                  />
                </Field>
                <Field label="Location">
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Sector 4 field office"
                    className="input"
                  />
                </Field>
              </div>
            </Panel>

            <Panel
              title="Deployment data"
              subtitle={`${dataPoints.length} metrics`}
            >
              <p className="text-xs text-un-muted">
                Quantitative figures for the deployment (headcounts,
                durations, resources). These are stated directly in the
                generated context.
              </p>

              {dataPoints.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {dataPoints.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-un-border bg-un-blue-50/60 px-3 py-2 text-sm"
                    >
                      <span className="text-un-ink">
                        <span className="font-medium">{d.label}</span>
                        <span className="text-un-muted"> &middot; {d.value}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveDataPoint(d.id)}
                        aria-label={`Remove ${d.label}`}
                        className="text-un-muted hover:text-un-blue-700"
                      >
                        &times;
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-3 flex gap-2">
                <input
                  value={newDataLabel}
                  onChange={(e) => setNewDataLabel(e.target.value)}
                  placeholder="Metric, e.g. Budget utilized"
                  className="input"
                />
                <input
                  value={newDataValue}
                  onChange={(e) => setNewDataValue(e.target.value)}
                  placeholder="Value, e.g. $12,000"
                  className="input"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddDataPoint();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddDataPoint}
                  className="shrink-0 rounded-lg border border-un-border px-3 text-sm font-semibold text-un-blue-700 hover:bg-un-blue-50"
                >
                  Add
                </button>
              </div>
            </Panel>

            <Panel
              title="Documents"
              subtitle={`${sources.length} added`}
            >
              <ul className="space-y-2">
                {sources.map((source) => (
                  <li
                    key={source.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-un-border bg-un-blue-50/60 px-3 py-2 text-sm"
                  >
                    <span className="flex items-center gap-2 text-un-ink">
                      <DocIcon />
                      {source.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSource(source.id)}
                      aria-label={`Remove ${source.label}`}
                      className="text-un-muted hover:text-un-blue-700"
                    >
                      &times;
                    </button>
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex gap-2">
                <input
                  value={newSourceLabel}
                  onChange={(e) => setNewSourceLabel(e.target.value)}
                  placeholder="Add a document, e.g. interview_notes.pdf"
                  className="input"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddSource();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddSource}
                  className="shrink-0 rounded-lg border border-un-border px-3 text-sm font-semibold text-un-blue-700 hover:bg-un-blue-50"
                >
                  Add
                </button>
              </div>

              <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-un-muted">
                Notes &amp; context
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Paste debrief notes, timelines, or other context for the AI to draw on..."
                className="input mt-1.5 min-h-[110px] resize-y"
              />
            </Panel>

            <Panel
              title="Survey responses"
              subtitle={`${surveyResponses.length} collected`}
            >
              <p className="text-xs text-un-muted">
                Answers below are pulled directly into the What Worked Well,
                Challenges, and Recommendations sections when you generate a
                draft.
              </p>

              {surveyResponses.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {surveyResponses.map((r) => (
                    <li
                      key={r.id}
                      className="rounded-lg border border-un-border bg-un-blue-50/60 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-un-ink">
                          {r.respondent || "Anonymous respondent"}
                        </span>
                        <div className="flex items-center gap-2">
                          <StarRating value={r.rating} readOnly />
                          <button
                            type="button"
                            onClick={() => handleRemoveSurveyResponse(r.id)}
                            aria-label={`Remove response from ${r.respondent || "anonymous respondent"}`}
                            className="text-un-muted hover:text-un-blue-700"
                          >
                            &times;
                          </button>
                        </div>
                      </div>
                      <p className="mt-1 truncate text-xs text-un-muted">
                        {r.whatWorked || r.challenges || r.recommendations}
                      </p>
                    </li>
                  ))}
                </ul>
              )}

              {surveyFormOpen ? (
                <div className="mt-3 space-y-2.5 rounded-lg border border-un-border p-3">
                  <Field label="Respondent (optional)">
                    <input
                      value={surveyForm.respondent}
                      onChange={(e) =>
                        setSurveyForm((f) => ({
                          ...f,
                          respondent: e.target.value,
                        }))
                      }
                      placeholder="e.g. Field coordinator"
                      className="input"
                    />
                  </Field>

                  <div>
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-un-muted">
                      Overall rating
                    </span>
                    <StarRating
                      value={surveyForm.rating}
                      onChange={(v) =>
                        setSurveyForm((f) => ({ ...f, rating: v }))
                      }
                    />
                  </div>

                  <Field label="What worked well">
                    <textarea
                      value={surveyForm.whatWorked}
                      onChange={(e) =>
                        setSurveyForm((f) => ({
                          ...f,
                          whatWorked: e.target.value,
                        }))
                      }
                      className="input min-h-[60px] resize-y"
                    />
                  </Field>

                  <Field label="Challenges">
                    <textarea
                      value={surveyForm.challenges}
                      onChange={(e) =>
                        setSurveyForm((f) => ({
                          ...f,
                          challenges: e.target.value,
                        }))
                      }
                      className="input min-h-[60px] resize-y"
                    />
                  </Field>

                  <Field label="Recommendations">
                    <textarea
                      value={surveyForm.recommendations}
                      onChange={(e) =>
                        setSurveyForm((f) => ({
                          ...f,
                          recommendations: e.target.value,
                        }))
                      }
                      className="input min-h-[60px] resize-y"
                    />
                  </Field>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleAddSurveyResponse}
                      className="rounded-lg bg-un-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-un-blue-700"
                    >
                      Add response
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSurveyFormOpen(false);
                        setSurveyForm(EMPTY_SURVEY_FORM);
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
                  onClick={() => setSurveyFormOpen(true)}
                  className="mt-3 w-full rounded-lg border border-dashed border-un-border px-3 py-2 text-sm font-semibold text-un-blue-700 hover:bg-un-blue-50"
                >
                  + Add a survey response
                </button>
              )}
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

          {/* Right column: generated artifact, editable */}
          <div className="rounded-2xl border border-un-border bg-un-surface shadow-sm">
            <div className="flex items-center justify-between border-b border-un-border px-6 py-4">
              <div>
                <h2 className="font-serif text-lg font-semibold text-un-ink">
                  Generated artifact
                </h2>
                <p className="text-xs text-un-muted">
                  Editable draft &middot; not yet saved to the library
                  {status === "ready" &&
                    (surveyResponses.length > 0 || dataPoints.length > 0) && (
                      <>
                        {" "}
                        &middot; informed by{" "}
                        {[
                          dataPoints.length > 0 &&
                            `${dataPoints.length} data point${dataPoints.length === 1 ? "" : "s"}`,
                          surveyResponses.length > 0 &&
                            `${surveyResponses.length} survey response${surveyResponses.length === 1 ? "" : "s"}`,
                        ]
                          .filter(Boolean)
                          .join(" and ")}
                      </>
                    )}
                </p>
              </div>
              <StatusPill status={status} />
            </div>

            <div className="p-6">
              {status === "idle" && (
                <EmptyState />
              )}

              {status === "generating" && <GeneratingState />}

              {status === "ready" && (
                <div className="space-y-6">
                  <ArtifactField
                    label="Context"
                    value={draft.context}
                    onChange={(v) => setDraft((d) => ({ ...d, context: v }))}
                    minHeight="min-h-[90px]"
                  />
                  <ArtifactField
                    label="What worked well"
                    value={draft.whatWorked}
                    onChange={(v) =>
                      setDraft((d) => ({ ...d, whatWorked: v }))
                    }
                    minHeight="min-h-[90px]"
                  />
                  <ArtifactField
                    label="Challenges"
                    value={draft.challenges}
                    onChange={(v) =>
                      setDraft((d) => ({ ...d, challenges: v }))
                    }
                    minHeight="min-h-[90px]"
                  />
                  <ArtifactField
                    label="Recommendations"
                    value={draft.recommendations}
                    onChange={(v) =>
                      setDraft((d) => ({ ...d, recommendations: v }))
                    }
                    minHeight="min-h-[90px]"
                  />
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

function ArtifactField({
  label,
  value,
  onChange,
  minHeight,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minHeight: string;
}) {
  return (
    <div>
      <h3 className="font-serif text-base font-semibold text-un-ink border-b border-un-border pb-2">
        {label}
      </h3>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`input mt-2 ${minHeight} resize-y leading-relaxed`}
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
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${s.cls}`}
    >
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
        Add event details, deployment data, documents, and survey responses
        on the left, then generate a draft. You&apos;ll be able to edit every
        section before it goes to review.
      </p>
    </div>
  );
}

function GeneratingState() {
  return (
    <div className="space-y-6 animate-pulse">
      {["Context", "What worked well", "Challenges", "Recommendations"].map(
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

function StarRating({
  value,
  onChange,
  readOnly = false,
}: {
  value: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="flex items-center gap-0.5" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(star === value ? 0 : star)}
          aria-label={`${star} star${star === 1 ? "" : "s"}`}
          aria-pressed={star <= value}
          className={
            "h-4 w-4 " +
            (readOnly ? "cursor-default" : "cursor-pointer") +
            " " +
            (star <= value ? "text-un-gold-500" : "text-un-border")
          }
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-full w-full">
            <path d="M10 1.5l2.47 5.01 5.53.8-4 3.9.94 5.5L10 14.9l-4.94 2.6.94-5.5-4-3.9 5.53-.8L10 1.5Z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

function DocIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-4 w-4 text-un-blue-600"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path d="M5 3h7l3 3v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M12 3v3h3" />
    </svg>
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
