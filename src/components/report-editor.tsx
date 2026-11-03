"use client";

// Shared building blocks for editing an AAR report — used by both the
// drafting wizard (src/app/new) and the standalone post-submission review
// page (src/app/reviews/[slug]/edit), so the two don't drift apart.

import { useEffect, useRef, useState } from "react";
import {
  groupRecommendationsByOwner,
  priorityLevels,
  recommendationOwners,
  responseAreas,
  type FindingRow,
  type Interviewee,
  type PriorityLevel,
  type ResponseArea,
  type ReviewerFlag,
  type ReviewerFlagType,
  type SurveyRating,
  type TimelineEntry,
} from "@/data/reviews";
import { upload } from "@vercel/blob/client";
import type { DocumentSource, SurveyInvite } from "@/lib/aar-store";

// Files upload straight from the browser to Vercel Blob storage (see
// uploadFileToBlob below), not through our own server, so this is no
// longer bounded by Vercel's 4.5MB request-body limit -- kept generous
// but not unbounded. Must match the server-side maximumSizeInBytes in
// /api/documents/blob-upload, which is the limit actually enforced.
export const MAX_FILE_BYTES = 100 * 1024 * 1024;

// Report text fields grow to fit whatever's in them instead of clipping
// long generated paragraphs inside a fixed-height box.
function autoResize(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Uploads a file directly from the browser to Vercel Blob storage,
// bypassing our server for the actual bytes (only a short-lived token
// round-trips through /api/documents/blob-upload). Shared by both the
// drafting wizard and the standalone review-edit page so their attach
// logic doesn't drift apart the way handleGenerate's autosave-cancel
// bug once did.
export async function uploadFileToBlob(file: File): Promise<DocumentSource> {
  const blob = await upload(`documents/${file.name}`, file, {
    access: "private",
    handleUploadUrl: "/api/documents/blob-upload",
  });
  return {
    id: crypto.randomUUID(),
    name: file.name,
    size: file.size,
    mimeType: file.type || undefined,
    blobUrl: blob.url,
  };
}

// A file mid-upload to Blob storage, or one that failed -- tracked
// separately from `documents` (which only ever holds files that finished
// uploading) so the list can show "Attaching..." the instant a file is
// picked instead of going silent until every file in the batch resolves.
export type PendingUpload = { id: string; name: string; size: number; error?: string };

// Kicks off each upload independently (not Promise.all) so one slow or
// failed file doesn't hold up feedback on the others, and calls back as
// soon as each one settles rather than waiting for the whole batch.
export function attachFilesWithProgress(
  files: File[],
  callbacks: {
    onStart: (pending: PendingUpload) => void;
    onSuccess: (pendingId: string, doc: DocumentSource) => void;
    onError: (pendingId: string, message: string) => void;
  },
) {
  for (const file of files) {
    const pendingId = crypto.randomUUID();
    callbacks.onStart({ id: pendingId, name: file.name, size: file.size });
    uploadFileToBlob(file)
      .then((doc) => callbacks.onSuccess(pendingId, doc))
      .catch(() => callbacks.onError(pendingId, "Couldn't attach — try again."));
  }
}

export function PendingUploadRow({
  upload,
  onDismiss,
}: {
  upload: PendingUpload;
  onDismiss: (id: string) => void;
}) {
  return (
    <li
      className={
        "rounded-xl border p-3.5 " +
        (upload.error
          ? "border-red-300 bg-red-50/60"
          : "border-un-border bg-un-blue-50/40")
      }
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-sm text-un-ink">
          {upload.error ? (
            <span className="shrink-0 text-red-500">!</span>
          ) : (
            <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-un-blue-300 border-t-un-blue-600" />
          )}
          <span className="min-w-0 truncate font-medium">{upload.name}</span>
        </span>
        {upload.error && (
          <button
            type="button"
            onClick={() => onDismiss(upload.id)}
            aria-label={`Dismiss ${upload.name}`}
            className="shrink-0 rounded-full p-1 text-un-muted hover:bg-white hover:text-red-600"
          >
            &times;
          </button>
        )}
      </div>
      <p
        className={
          "mt-0.5 text-xs " + (upload.error ? "text-red-600" : "text-un-blue-600")
        }
      >
        {upload.error ?? "Attaching…"}
      </p>
    </li>
  );
}

export function formatBytes(bytes?: number) {
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

export function Panel({
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
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold text-un-ink">{title}</h2>
          {subtitle && (
            <span className="text-xs text-un-muted">{subtitle}</span>
          )}
        </div>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function Field({
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

export function TimelineField({
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
              <span className="w-20 shrink-0 font-mono text-xs text-un-blue-700">
                {entry.date || "no date"}
              </span>
              <span className="flex-1 text-un-ink">
                {entry.event}
                <SourceList sources={entry.sources} />
              </span>
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
        <div className="w-36 shrink-0">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input"
          />
        </div>
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

export function IntervieweeField({
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

// Reviewer-only: which sources an AI-drafted entry is based on. Renders
// nothing for hand-entered entries (no sources recorded).
function SourceList({ sources }: { sources?: string[] }) {
  if (!sources || sources.length === 0) return null;
  return (
    <span className="mt-0.5 block text-[0.7rem] text-un-muted">
      Sources: {sources.join("; ")}
    </span>
  );
}

// "2 of 7 respondents, 1 document" -- how widely a finding is supported.
function supportSummary(sources: string[], respondentCount: number): string {
  const surveys = sources.filter((s) => s.startsWith("Survey:")).length;
  const others = sources.length - surveys;
  const parts: string[] = [];
  if (surveys > 0) {
    parts.push(
      respondentCount > 0
        ? `${surveys} of ${respondentCount} respondent${respondentCount === 1 ? "" : "s"}`
        : `${surveys} respondent${surveys === 1 ? "" : "s"}`,
    );
  }
  if (others > 0) parts.push(`${others} document${others === 1 ? "" : "s"}`);
  return parts.join(", ");
}

export function MatrixField({
  rows,
  onChange,
  respondentCount = 0,
}: {
  rows: FindingRow[];
  onChange: (rows: FindingRow[]) => void;
  respondentCount?: number;
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
                  {row.owner && (
                    <span className="ml-1.5 rounded-full bg-white px-2 py-0.5 text-[0.65rem] font-semibold text-un-ink ring-1 ring-un-border">
                      Owner: {row.owner}
                    </span>
                  )}
                  {row.sources && (
                    <span
                      className={
                        "ml-1.5 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ring-1 " +
                        (row.sources.length <= 1
                          ? "bg-un-gold-100 text-un-gold-700 ring-un-gold-500/40"
                          : "bg-white text-un-muted ring-un-border")
                      }
                    >
                      {row.sources.length === 0
                        ? "No source cited"
                        : supportSummary(row.sources, respondentCount)}
                    </span>
                  )}
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
              <SourceList sources={row.sources} />
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
          <Field label="Owner (who should act)">
            <select
              value={form.owner ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, owner: e.target.value || undefined }))
              }
              className="input"
            >
              <option value="">Not specified</option>
              {recommendationOwners.map((owner) => (
                <option key={owner} value={owner}>
                  {owner}
                </option>
              ))}
            </select>
          </Field>
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

export function ArtifactField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    autoResize(ref.current);
  }, [value]);

  return (
    <div>
      <h3 className="font-serif text-base font-semibold text-un-ink border-b border-un-border pb-2">
        {label}
      </h3>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          autoResize(e.target);
        }}
        rows={1}
        className="input mt-2 min-h-[90px] resize-none overflow-hidden leading-relaxed"
      />
    </div>
  );
}

export function AccordionArtifact({
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
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    autoResize(ref.current);
  }, [value]);

  return (
    <details
      className="group rounded-lg border border-un-border open:bg-un-blue-50/20"
      open={defaultOpen}
      onToggle={(e) => {
        if (e.currentTarget.open) autoResize(ref.current);
      }}
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
          ref={ref}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            autoResize(e.target);
          }}
          rows={1}
          className="input min-h-[80px] resize-none overflow-hidden leading-relaxed"
        />
      </div>
    </details>
  );
}

export function UploadIcon() {
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

export function DocIcon() {
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

// Auto-derived from whatever's attached — no fixed document categories,
// so it holds up the same way for any country or crisis type rather than
// baking in one AAR's specific source breakdown.
export function Bibliography({ documents }: { documents: DocumentSource[] }) {
  return (
    <div>
      <div className="flex items-center justify-between border-b border-un-border pb-2">
        <h3 className="font-serif text-base font-semibold text-un-ink">
          Annex 2: Desk review bibliography
        </h3>
        <span className="text-xs text-un-muted">
          {documents.length} document{documents.length === 1 ? "" : "s"}
        </span>
      </div>
      {documents.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center gap-2 text-sm text-un-ink/90"
            >
              <DocIcon />
              <span className="min-w-0 truncate">{doc.name}</span>
              {doc.dataCollectionMethod && (
                <span className="shrink-0 rounded-full bg-un-blue-50 px-2 py-0.5 text-[0.65rem] font-medium text-un-blue-700">
                  {doc.dataCollectionMethod}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-un-muted">
          No source documents attached yet.
        </p>
      )}
    </div>
  );
}

// 4.2, grouped by who should act. Derived from the matrix like 4.1.
export function RecommendationsByOwner({ rows }: { rows: FindingRow[] }) {
  const groups = groupRecommendationsByOwner(rows);
  if (groups.length === 0) {
    return (
      <p className="mt-2 text-sm text-un-muted">
        Add rows to the Annex 7 matrix above to populate this section.
      </p>
    );
  }
  return (
    <div className="mt-3 space-y-3">
      {groups.map((group) => (
        <div key={group.owner}>
          <p className="text-xs font-semibold uppercase tracking-wide text-un-blue-600">
            {group.owner}
          </p>
          <ul className="mt-1.5 space-y-2 text-sm">
            {group.recommendations.map((r, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-un-blue-600" />
                <span className="text-un-ink/90">{r}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// Annex 5: the scaled answers respondents picked, straight from the surveys.
export function SurveyRatingsAnnex({ ratings }: { ratings: SurveyRating[] }) {
  return (
    <div>
      <div className="flex items-center justify-between border-b border-un-border pb-2">
        <h3 className="font-serif text-base font-semibold text-un-ink">
          Annex 5: Survey ratings
        </h3>
        <span className="text-xs text-un-muted">
          {ratings.length} rating{ratings.length === 1 ? "" : "s"}
        </span>
      </div>
      {ratings.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {ratings.map((r, i) => (
            <li
              key={i}
              className="rounded-lg border border-un-border bg-un-blue-50/40 px-3 py-1.5 text-sm"
            >
              <span className="text-un-ink/90">{r.question}</span>
              <span className="mt-0.5 block text-xs text-un-muted">
                {r.respondent}:{" "}
                <span className="font-semibold text-un-ink">{r.rating}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-un-muted">
          Filled in from scaled survey answers when the draft is generated.
        </p>
      )}
    </div>
  );
}

const FLAG_LABELS: Record<ReviewerFlagType, string> = {
  conflict: "Sources disagree",
  "single-source": "One source only",
  unsupported: "Not found in sources",
  "thin-evidence": "Thin evidence",
  omitted: "Left out of draft",
  wording: "Loaded wording",
};

const FLAG_ORDER: ReviewerFlagType[] = [
  "conflict",
  "unsupported",
  "single-source",
  "wording",
  "thin-evidence",
  "omitted",
];

// "For the reviewer": everything the AI or the automated checks think a
// human needs to look at before the final draft. Ticking one off only
// marks it resolved -- fixing the text is still the reviewer's job.
export function ReviewerFlagsPanel({
  flags,
  onChange,
}: {
  flags: ReviewerFlag[];
  onChange: (flags: ReviewerFlag[]) => void;
}) {
  const [showResolved, setShowResolved] = useState(false);
  if (flags.length === 0) return null;

  const open = flags.filter((f) => !f.resolved).length;
  const visible = flags
    .filter((f) => showResolved || !f.resolved)
    .sort((a, b) => FLAG_ORDER.indexOf(a.type) - FLAG_ORDER.indexOf(b.type));

  function toggle(id: string) {
    onChange(flags.map((f) => (f.id === id ? { ...f, resolved: !f.resolved } : f)));
  }

  return (
    <div className="rounded-xl border border-un-gold-500/40 bg-un-gold-100/40 px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-un-ink">For the reviewer</h3>
          <p className="text-xs text-un-muted">
            {open > 0
              ? `${open} of ${flags.length} item${flags.length === 1 ? "" : "s"} to resolve before the final draft. Not included in the exported report.`
              : `All ${flags.length} items resolved.`}
          </p>
        </div>
        {flags.length > open && (
          <button
            type="button"
            onClick={() => setShowResolved((v) => !v)}
            className="shrink-0 text-xs font-semibold text-un-blue-700 hover:text-un-blue-600"
          >
            {showResolved ? "Hide resolved" : "Show resolved"}
          </button>
        )}
      </div>
      {visible.length > 0 && (
        <ul className="mt-3 max-h-[28rem] space-y-2 overflow-y-auto pr-1">
          {visible.map((flag) => (
            <li
              key={flag.id}
              className={
                "flex gap-2.5 rounded-lg border border-un-border bg-un-surface px-3 py-2 text-sm " +
                (flag.resolved ? "opacity-60" : "")
              }
            >
              <input
                type="checkbox"
                checked={flag.resolved}
                onChange={() => toggle(flag.id)}
                aria-label="Mark resolved"
                className="mt-1 shrink-0"
              />
              <div className="min-w-0">
                <p className="text-xs">
                  <span className="font-semibold text-un-gold-700">
                    {FLAG_LABELS[flag.type] ?? flag.type}
                  </span>
                  <span className="text-un-muted"> &middot; {flag.section}</span>
                </p>
                <p className="mt-0.5 text-un-ink/90">{flag.description}</p>
                {flag.sources.length > 0 && (
                  <p className="mt-0.5 text-[0.7rem] text-un-muted">
                    Sources: {flag.sources.join("; ")}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// --- AI generation: shared between the drafting wizard and the
// post-submission review page, so "Generate"/"Regenerate" behaves the same
// wherever it's triggered from (see AGENTS.md-adjacent context: this used
// to only exist in the wizard, which meant survey responses or new
// documents added after "Submit for review" could never make it into the
// draft -- see project history for the full diagnosis). ----------------

export function SurveyResponseSummary({ invites }: { invites: SurveyInvite[] }) {
  if (invites.length === 0) return null;
  const responded = invites.filter((i) => i.status === "Responded").length;
  return (
    <p className="text-xs text-un-muted">
      Survey responses:{" "}
      <span className="font-semibold text-un-ink">
        {responded} of {invites.length}
      </span>{" "}
      received
    </p>
  );
}

// Reasons to pause and ask before actually calling the AI, rather than
// generating immediately: responses still outstanding (drafting early
// loses their input), or a previous draft's text is about to be
// overwritten (regenerating never merges, so unsaved manual edits vanish).
export function buildGenerateWarnings({
  invites,
  hasExistingDraft,
}: {
  invites: SurveyInvite[];
  hasExistingDraft: boolean;
}): string[] {
  const warnings: string[] = [];
  const responded = invites.filter((i) => i.status === "Responded").length;
  const total = invites.length;
  if (total > 0 && responded < total) {
    const outstanding = total - responded;
    warnings.push(
      `${outstanding} of ${total} survey invite${total === 1 ? "" : "s"} ${outstanding === 1 ? "hasn't" : "haven't"} responded yet. Generating now won't include ${outstanding === 1 ? "that response" : "those responses"}.`,
    );
  }
  if (hasExistingDraft) {
    warnings.push(
      "This will overwrite the current draft text with a new AI-generated version. Any manual edits will be lost.",
    );
  }
  return warnings;
}

export function GenerateConfirmBanner({
  warnings,
  onConfirm,
  onCancel,
}: {
  warnings: string[];
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-xl border border-un-gold-500/40 bg-un-gold-100/60 px-4 py-3 text-sm text-un-blue-950">
      <ul className="list-disc space-y-1 pl-4">
        {warnings.map((warning, i) => (
          <li key={i}>{warning}</li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-full bg-un-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-un-blue-700"
        >
          Generate anyway
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-un-border px-3 py-1.5 text-xs font-semibold text-un-blue-700 hover:bg-un-blue-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// Rough scale, not a precise ETA -- actual time depends on document mix (a
// 40-page PDF costs more than a one-page memo), but this gives people a
// sense of whether "still working" means seconds or minutes. Calibrated
// against a real run: ~90s for ~38 large documents.
function estimateGenerationTime(documentCount: number): string {
  if (documentCount > 20) return "a few minutes";
  if (documentCount > 5) return "1-2 minutes";
  return "under a minute";
}

export function GeneratingBanner({ documentCount }: { documentCount: number }) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  const elapsedLabel = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

  return (
    <div className="flex items-center justify-center gap-3 rounded-xl border border-un-blue-100 bg-un-blue-50/60 px-4 py-3 text-center">
      <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-un-blue-300 border-t-un-blue-600" />
      <p className="text-sm text-un-blue-900">
        <span className="font-semibold">Working on it…</span> Generating from{" "}
        {documentCount || "your"} document{documentCount === 1 ? "" : "s"}{" "}
        usually takes {estimateGenerationTime(documentCount)}. Elapsed:{" "}
        {elapsedLabel}
      </p>
    </div>
  );
}
