"use client";

// Standalone review/editing workspace for an AAR that's already past the
// drafting wizard (stage "Under Review", or already "Completed" and being
// revisited). Deliberately not part of the /new wizard — no step
// indicator, no survey/basics editing, just the attached documents and the
// report content, with autosave and two actions: Save, or Complete.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { dataCollectionMethods, type FindingRow, type Interviewee, type TimelineEntry } from "@/data/reviews";
import { formatPeriod } from "@/lib/format";
import {
  getRecord,
  saveRecord,
  type AarRecord,
  type DocumentSource,
  type ReportDraft as Draft,
} from "@/lib/aar-store";
import {
  AccordionArtifact,
  ArtifactField,
  Bibliography,
  DocIcon,
  IntervieweeField,
  MatrixField,
  MAX_FILE_BYTES,
  Panel,
  TimelineField,
  UploadIcon,
  formatBytes,
  readFileAsBase64,
} from "@/components/report-editor";
import StatusBadge from "@/components/status-badge";

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

export default function ReviewEditWorkspace({ slug }: { slug: string }) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [record, setRecord] = useState<AarRecord | null>(null);

  const [documents, setDocuments] = useState<DocumentSource[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [findingsMatrix, setFindingsMatrix] = useState<FindingRow[]>([]);
  const [interviewees, setInterviewees] = useState<Interviewee[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [manualSourceName, setManualSourceName] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);

  // One-time hydration from the database on mount.
  useEffect(() => {
    getRecord(slug).then((rec) => {
      if (!rec) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      // This page is only for AARs that have moved past the drafting
      // wizard — send anything still in the earlier flow back there.
      if (rec.stage !== "Under Review" && rec.status !== "Completed") {
        router.replace(`/new?edit=${encodeURIComponent(slug)}`);
        return;
      }
      setRecord(rec);
      setDocuments(rec.documents);
      setDraft({
        executiveSummary: rec.executiveSummary,
        countrySituation: rec.introduction.countrySituation,
        objectives: rec.introduction.objectives,
        scope: rec.methodology.scope,
        dataCollection: rec.methodology.dataCollection,
        contextualFactors: rec.analysis.contextualFactors,
        inCountryStructure: rec.analysis.inCountryStructure,
        corporateResponseMechanisms: rec.analysis.corporateResponseMechanisms,
        deploymentOfExperts: rec.analysis.deploymentOfExperts,
        programmaticResponse: rec.analysis.programmaticResponse,
        operationalResponse: rec.analysis.operationalResponse,
        coordination: rec.analysis.coordination,
        communicationAndResourceMobilization:
          rec.analysis.communicationAndResourceMobilization,
      });
      setTimeline(rec.analysis.timeline);
      setFindingsMatrix(rec.findingsMatrix);
      setInterviewees(rec.interviewees);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const keyFindings = useMemo(
    () => findingsMatrix.map((r) => r.finding).filter(Boolean),
    [findingsMatrix],
  );
  const recommendations = useMemo(
    () => findingsMatrix.map((r) => r.recommendation).filter(Boolean),
    [findingsMatrix],
  );
  const documentMethods = Array.from(
    new Set(
      documents
        .map((d) => d.dataCollectionMethod)
        .filter((m): m is string => Boolean(m)),
    ),
  );

  function buildUpdatedRecord(statusOverride?: AarRecord["status"]): AarRecord | null {
    if (!record) return null;
    return {
      ...record,
      status: statusOverride ?? record.status,
      documents,
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
      updatedAt: new Date().toISOString(),
    };
  }

  async function handleSave() {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    const updated = buildUpdatedRecord();
    if (!updated) return;
    setIsSaving(true);
    await saveRecord(updated);
    setRecord(updated);
    setLastSaveTime(new Date());
    setIsSaving(false);
  }

  async function handleComplete() {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    const updated = buildUpdatedRecord("Completed");
    if (!updated) return;
    await saveRecord(updated);
    setRecord(updated);
    router.push("/");
  }

  // Autosave shortly after any edit, same pattern as the drafting wizard.
  // The timer is kept in a ref (not just the effect's closure) so an explicit
  // Save/Complete can cancel it directly -- relying on the cleanup function
  // alone is not reliable here, since router.push() navigation doesn't
  // guarantee this component unmounts before a near-due timer fires, which
  // let a stale autosave silently revert a just-completed AAR.
  useEffect(() => {
    if (!record) return;
    autosaveTimer.current = setTimeout(() => {
      const updated = buildUpdatedRecord();
      if (!updated) return;
      setIsSaving(true);
      saveRecord(updated)
        .then(() => {
          setRecord(updated);
          setLastSaveTime(new Date());
        })
        .finally(() => setIsSaving(false));
    }, 2000);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents, draft, timeline, findingsMatrix, interviewees]);

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
        readable.map(async (file) => {
          const res = await fetch("/api/documents", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              reviewSlug: slug,
              fileName: file.name,
              mimeType: file.type || undefined,
              contentBase64: await readFileAsBase64(file),
            }),
          });
          if (!res.ok) throw new Error("upload failed");
          return (await res.json()) as DocumentSource;
        }),
      );
      setDocuments((prev) => [...prev, ...added]);
    } catch {
      setFileError("Couldn't attach one of those files. Try again.");
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
    const doc = documents.find((d) => d.id === id);
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    if (doc?.sharepointId) {
      fetch(`/api/documents/${encodeURIComponent(doc.sharepointId)}`, {
        method: "DELETE",
      }).catch(() => {
        // The library file may be orphaned if this fails; not worth
        // blocking the UI removal over.
      });
    }
  }

  function setDocumentMethod(id: string, method: string) {
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, dataCollectionMethod: method } : d,
      ),
    );
  }

  if (loading) {
    return <main className="flex-1 bg-background" />;
  }

  if (notFound || !record) {
    return (
      <main className="flex-1 bg-background">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 text-center">
          <p className="text-sm text-un-muted">
            That After Action Review couldn&apos;t be found.
          </p>
          <Link
            href="/"
            className="mt-3 inline-block text-sm font-semibold text-un-blue-700 hover:text-un-blue-600"
          >
            &larr; Back to library
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 bg-background">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href={record.status === "Completed" ? "/" : "/workspace"}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-un-blue-700 hover:text-un-blue-600"
        >
          <span aria-hidden>&larr;</span>{" "}
          {record.status === "Completed" ? "Back to library" : "Back to workspace"}
        </Link>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-un-blue-600">
                {record.crisisType}
              </span>
              <StatusBadge review={record} />
            </div>
            <h1 className="mt-1 font-serif text-2xl font-semibold text-un-ink">
              {record.title}
            </h1>
            <p className="mt-1 text-sm text-un-muted">
              {formatPeriod(record.periodStart, record.periodEnd)} &middot;{" "}
              {record.office}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {isSaving && (
              <span className="text-xs font-medium text-un-muted">Saving...</span>
            )}
            {lastSaveTime && !isSaving && (
              <span className="text-xs font-medium text-emerald-600">
                ✓ Saved
              </span>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-full border border-un-border px-4 py-2 text-sm font-semibold text-un-blue-700 hover:bg-un-blue-50 disabled:cursor-wait disabled:opacity-70"
            >
              Save
            </button>
            {record.status !== "Completed" && (
              <button
                type="button"
                onClick={handleComplete}
                className="rounded-full bg-un-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-un-blue-700"
              >
                Complete AAR
              </button>
            )}
          </div>
        </div>

        <div className="mt-8 space-y-6">
          <Panel
            title="Attached documents"
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
                "flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors " +
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
              <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

          <div className="rounded-2xl border border-un-border bg-un-surface shadow-sm">
            <div className="border-b border-un-border px-6 py-4">
              <h2 className="font-serif text-lg font-semibold text-un-ink">
                Report
              </h2>
              <p className="text-xs text-un-muted">
                Edit any section below — changes save automatically.
              </p>
            </div>

            <div className="space-y-6 p-6">
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
                onChange={(v) => setDraft((d) => ({ ...d, objectives: v }))}
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
                  <TimelineField entries={timeline} onChange={setTimeline} />
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
                onChange={(v) => setDraft((d) => ({ ...d, coordination: v }))}
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
                    Add rows to the Annex 7 matrix above to populate this
                    section.
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
                    Add rows to the Annex 7 matrix above to populate this
                    section.
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
                <div className="mt-3">
                  <IntervieweeField
                    people={interviewees}
                    onChange={setInterviewees}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
