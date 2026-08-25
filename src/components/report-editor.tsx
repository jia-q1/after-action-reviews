"use client";

// Shared building blocks for editing an AAR report — used by both the
// drafting wizard (src/app/new) and the standalone post-submission review
// page (src/app/reviews/[slug]/edit), so the two don't drift apart.

import { useEffect, useRef, useState } from "react";
import {
  priorityLevels,
  responseAreas,
  type FindingRow,
  type Interviewee,
  type PriorityLevel,
  type ResponseArea,
  type TimelineEntry,
} from "@/data/reviews";
import type { DocumentSource } from "@/lib/aar-store";

export const MAX_FILE_BYTES = 15 * 1024 * 1024;

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

export function MatrixField({
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
