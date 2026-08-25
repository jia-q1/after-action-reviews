"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  statusStyles,
  type ReviewStage,
} from "@/data/reviews";
import { formatPeriod } from "@/lib/format";
import { listRecords, listInvites, type AarRecord, type SurveyInvite } from "@/lib/aar-store";

// Internal tool for developing AARs: starting new ones, tracking survey
// responses, and picking up drafts already in progress. Deliberately
// separate from the public library (/) -- completed reviews and the
// recommendations dashboard there are meant for all UNDP personnel,
// while this workspace is the back-end drafting/review tooling. Note:
// there's no login/access-control layer yet, so this separation is
// currently by navigation only, not enforced.

// Pipeline order, earliest to latest — mirrors how a review actually moves
// through /new (surveys -> drafting -> validation).
const STAGE_ORDER: ReviewStage[] = [
  "Drafting",
  "Awaiting Survey Responses",
  "Under Review",
];

export default function WorkspacePage() {
  const [query, setQuery] = useState("");
  const [activeStage, setActiveStage] = useState<ReviewStage | "All">("All");
  const [records, setRecords] = useState<AarRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [invitesByReview, setInvitesByReview] = useState<Record<string, SurveyInvite[]>>({})

  useEffect(() => {
    let cancelled = false;
    listRecords().then((data) => {
      if (!cancelled) {
        setRecords(data);
        setLoading(false);

        // Load invites for records awaiting survey responses
        const awaitingRecords = data.filter((r) => r.stage === "Awaiting Survey Responses");
        Promise.all(
          awaitingRecords.map(async (record) => {
            const invites = await listInvites(record.slug);
            return { slug: record.slug, invites };
          })
        ).then((results) => {
          if (!cancelled) {
            const invitesMap: Record<string, SurveyInvite[]> = {};
            results.forEach(({ slug, invites }) => {
              invitesMap[slug] = invites;
            });
            setInvitesByReview(invitesMap);
          }
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDelete = async (slug: string) => {
    if (deleteConfirm !== slug) {
      setDeleteConfirm(slug);
      return;
    }

    setDeletingSlug(slug);
    try {
      const response = await fetch(`/api/reviews/${encodeURIComponent(slug)}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setRecords((prev) => prev.filter((r) => r.slug !== slug));
        setDeleteConfirm(null);
      }
    } finally {
      setDeletingSlug(null);
    }
  };

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records.filter((review) => {
      return (
        q.length === 0 ||
        review.title.toLowerCase().includes(q) ||
        review.country.toLowerCase().includes(q) ||
        review.summary.toLowerCase().includes(q) ||
        review.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    });
  }, [records, query]);

  const inProgress = matches
    .filter((r) => r.status === "In Progress")
    .filter(
      (r) => activeStage === "All" || (r.stage ?? "Drafting") === activeStage,
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const inProgressByStage = useMemo(() => {
    const groups = new Map<ReviewStage, typeof inProgress>();
    for (const review of inProgress) {
      const stage = review.stage ?? "Drafting";
      groups.set(stage, [...(groups.get(stage) ?? []), review]);
    }
    return STAGE_ORDER.filter((s) => groups.has(s)).map(
      (s) => [s, groups.get(s)!] as const,
    );
  }, [inProgress]);

  return (
    <main className="flex-1 bg-background">
      <section className="border-b border-un-border bg-gradient-to-br from-un-blue-950 via-un-blue-900 to-un-blue-700 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-un-blue-400">
            Internal tool &middot; AAR development
          </p>
          <h1 className="mt-3 font-serif text-3xl sm:text-4xl font-semibold max-w-2xl">
            AAR Workspace
          </h1>
          <p className="mt-4 max-w-2xl text-un-blue-100 leading-relaxed">
            Start a new After Action Review, track survey responses, and pick
            up drafts already in progress. Completed reviews and the
            recommendations dashboard for all staff live on the{" "}
            <Link href="/" className="underline hover:text-white">
              Review Library
            </Link>
            .
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-xl">
              <svg
                aria-hidden
                viewBox="0 0 20 20"
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-un-blue-600"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="9" cy="9" r="6.5" />
                <path d="M17.5 17.5 L13.5 13.5" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by country, crisis, or keyword"
                className="w-full rounded-full border-0 bg-white py-3 pl-11 pr-4 text-sm text-un-ink placeholder:text-un-muted shadow-lg focus:outline-none focus:ring-2 focus:ring-un-blue-400"
              />
            </div>
            <div className="flex gap-3">
              <Link
                href="/new"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-un-gold-500 px-6 py-3 text-sm font-semibold text-un-blue-950 shadow-lg transition-colors hover:bg-un-gold-600"
              >
                + Start a new AAR
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8">
        <div className="flex flex-wrap gap-2">
          <FilterChip
            label="All statuses"
            active={activeStage === "All"}
            onClick={() => setActiveStage("All")}
          />
          {STAGE_ORDER.map((stage) => (
            <FilterChip
              key={stage}
              label={stage}
              active={activeStage === stage}
              onClick={() => setActiveStage(stage)}
            />
          ))}
        </div>
      </div>

      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-serif text-2xl font-semibold text-un-ink">
            In-Progress AARs
          </h2>
        </div>

        {loading ? (
          <EmptyState message="Loading..." />
        ) : inProgressByStage.length > 0 ? (
          <div className="mt-6 space-y-8">
            {inProgressByStage.map(([stage, stageReviews]) => (
              <div key={stage}>
                <div className="flex items-center gap-2 border-b border-un-border pb-2">
                  <StageBadge stage={stage} />
                  <span className="text-sm text-un-muted">
                    ({stageReviews.length})
                  </span>
                </div>
                <ul className="mt-3 divide-y divide-un-border overflow-hidden rounded-2xl border border-un-border bg-un-surface shadow-sm">
                  {stageReviews.map((review) => (
                    <li key={review.slug}>
                      <div className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 group hover:bg-un-blue-50/60 transition-colors">
                        <Link
                          href={
                            review.stage === "Under Review"
                              ? `/reviews/${encodeURIComponent(review.slug)}/edit`
                              : `/new?edit=${encodeURIComponent(review.slug)}`
                          }
                          className="flex flex-col gap-2 min-w-0 flex-1"
                        >
                          <span className="text-xs font-semibold uppercase tracking-wide text-un-blue-600">
                            {review.crisisType}
                          </span>
                          <p className="mt-1 font-serif text-base font-semibold text-un-ink">
                            {review.title}
                          </p>
                          <p className="mt-0.5 truncate text-sm text-un-muted">
                            {review.office}
                          </p>
                          {review.stage === "Awaiting Survey Responses" && invitesByReview[review.slug] && (
                            <div className="mt-2 space-y-1">
                              <div className="flex items-center justify-between text-xs font-semibold text-un-ink">
                                <span>Survey Response Progress</span>
                                <span className="text-un-muted">
                                  {invitesByReview[review.slug].filter((i) => i.status === "Responded").length} of {invitesByReview[review.slug].length}
                                </span>
                              </div>
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-un-border">
                                <div
                                  className="h-full bg-emerald-500 transition-all duration-300"
                                  style={{
                                    width: `${(invitesByReview[review.slug].filter((i) => i.status === "Responded").length / invitesByReview[review.slug].length) * 100}%`,
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </Link>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm text-un-muted">
                            {formatPeriod(review.periodStart, review.periodEnd)}
                          </span>
                          {deleteConfirm === review.slug ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() =>
                                  handleDelete(review.slug)
                                }
                                disabled={deletingSlug === review.slug}
                                className="px-3 py-1 text-xs font-medium rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                              >
                                {deletingSlug === review.slug ? "..." : "Confirm"}
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="px-3 py-1 text-xs font-medium rounded border border-un-border hover:bg-un-blue-50"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() =>
                                handleDelete(review.slug)
                              }
                              className="px-3 py-1 text-xs font-medium rounded border border-un-border text-un-muted hover:text-red-600 hover:border-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="No in-progress reviews match your filters right now." />
        )}
      </section>
    </main>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors " +
        (active
          ? "border-un-blue-600 bg-un-blue-600 text-white"
          : "border-un-border bg-un-surface text-un-muted hover:border-un-blue-400 hover:text-un-blue-700")
      }
    >
      {label}
    </button>
  );
}

function StageBadge({ stage }: { stage: ReviewStage }) {
  const style = statusStyles[stage] ?? statusStyles.Drafting;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${style.badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {stage}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-un-border bg-un-surface py-16 text-center text-un-muted">
      {message}
    </div>
  );
}
