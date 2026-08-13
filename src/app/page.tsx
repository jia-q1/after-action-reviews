"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  reviewYear,
  statusStyles,
  type ReviewStage,
} from "@/data/reviews";
import ReviewCard from "@/components/review-card";
import { archivedAars } from "@/data/archive-documents";
import { formatPeriod } from "@/lib/format";
import { listRecords, listInvites, type AarRecord, type SurveyInvite } from "@/lib/aar-store";

// Pipeline order, earliest to latest — mirrors how a review actually moves
// through /new (surveys -> drafting -> validation).
const STAGE_ORDER: ReviewStage[] = [
  "Awaiting Survey Responses",
  "Drafting",
  "Validation",
];

export default function LibraryPage() {
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

  const handleDelete = async (slug: string, title: string) => {
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

  const completed = matches
    .filter((r) => r.status === "Completed")
    .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));

  const inProgress = matches
    .filter((r) => r.status === "In Progress")
    .filter(
      (r) => activeStage === "All" || (r.stage ?? "Drafting") === activeStage,
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const completedByYear = useMemo(() => {
    const groups = new Map<number, typeof completed>();
    for (const review of completed) {
      const y = reviewYear(review);
      groups.set(y, [...(groups.get(y) ?? []), review]);
    }
    return [...groups.entries()].sort((a, b) => b[0] - a[0]);
  }, [completed]);

  const archiveGroups = useMemo(
    () =>
      Array.from(
        archivedAars.reduce((groups, doc) => {
          const bucket = groups.get(Number(doc.year)) ?? [];
          bucket.push(doc);
          groups.set(Number(doc.year), bucket);
          return groups;
        }, new Map<number, typeof archivedAars>()),
      ).sort((a, b) => b[0] - a[0]),
    [],
  );

  const mergedCompletedByYear = useMemo(() => {
    const groups = new Map<
      number,
      { reviews: typeof completed; archive: typeof archivedAars }
    >();

    for (const [year, yearReviews] of completedByYear) {
      groups.set(year, { reviews: yearReviews, archive: [] });
    }

    for (const [year, docs] of archiveGroups) {
      const current = groups.get(year) ?? { reviews: [], archive: [] };
      current.archive = [...current.archive, ...docs];
      groups.set(year, current);
    }

    return [...groups.entries()].sort((a, b) => b[0] - a[0]);
  }, [archiveGroups, completedByYear]);

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

  const counts = {
    total: records.length,
    completed: records.filter((r) => r.status === "Completed").length,
    inProgress: records.filter((r) => r.status === "In Progress").length,
  };

  return (
    <main className="flex-1 bg-background">
      <section className="border-b border-un-border bg-gradient-to-br from-un-blue-950 via-un-blue-900 to-un-blue-700 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-un-blue-400">
            United Nations
          </p>
          <h1 className="mt-3 font-serif text-3xl sm:text-4xl font-semibold max-w-2xl">
            After Action Review Library
          </h1>
          <p className="mt-4 max-w-2xl text-un-blue-100 leading-relaxed">
            Browse completed After Action Reviews, or start a new one with
            AI-assisted drafting, reviewed and approved by a human editor
            before it joins the library.
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

          <dl className="mt-10 grid grid-cols-3 gap-4 max-w-xl">
            <StatTile label="Total reviews" value={counts.total} />
            <StatTile label="Completed" value={counts.completed} />
            <StatTile label="In progress" value={counts.inProgress} />
          </dl>
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

        <nav className="mt-4 flex gap-4 text-sm">
          <a
            href="#in-progress"
            className="font-medium text-un-blue-700 hover:text-un-blue-600"
          >
            Section 1 &middot; In progress ({inProgress.length})
          </a>
          <a
            href="#completed"
            className="font-medium text-un-blue-700 hover:text-un-blue-600"
          >
            Section 2 &middot; Completed ({completed.length})
          </a>
        </nav>
      </div>

      <section id="in-progress" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 scroll-mt-20">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-serif text-2xl font-semibold text-un-ink">
            Section 1 &middot; In-Progress AARs
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
                          href={`/new?edit=${encodeURIComponent(review.slug)}`}
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
                                  handleDelete(review.slug, review.title)
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
                                handleDelete(review.slug, review.title)
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

      <section id="completed" className="border-t border-un-border bg-un-blue-50/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 scroll-mt-20">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <h2 className="font-serif text-2xl font-semibold text-un-ink">
                Section 2 &middot; Completed AARs
              </h2>
              <a
                href="https://undp.sharepoint.com/teams/SURGEPortal/SURGE%20Planning%20Quick%20Links/Forms/AllItems.aspx?csf=1&web=1&e=A1ouIX&FolderCTID=0x0120006C37C0AF60177C4E998CDF472C146D6B&id=%2Fteams%2FSURGEPortal%2FSURGE%20Planning%20Quick%20Links%2FCrisis%20Response%20After%20Action%20Reviews%20%28AARs%29"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-un-border px-4 py-2 text-xs font-semibold text-un-blue-700 hover:border-un-blue-600 hover:text-un-blue-600 transition-colors"
              >
                SURGE Portal
              </a>
            </div>
          </div>

          {loading ? (
            <EmptyState message="Loading..." />
          ) : (
            <div className="mt-6 space-y-10">
              {mergedCompletedByYear.length > 0 ? (
                mergedCompletedByYear.map(([year, { reviews, archive }]) => (
                  <div key={year}>
                    <h3 className="font-serif text-lg font-semibold text-un-blue-800 border-b border-un-border pb-2">
                      {year}
                    </h3>
                    <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                      {archive.map((doc) => (
                        <a
                          key={doc.href}
                          href={doc.href}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-2xl border border-un-border bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-un-blue-400"
                        >
                          <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-un-blue-600">
                            Archived AAR
                          </span>
                          <p className="mt-2 text-sm font-medium leading-snug text-un-ink">
                            {doc.name}
                          </p>
                        </a>
                      ))}
                      {reviews.map((review) => (
                        <ReviewCard key={review.slug} review={review} />
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState message="No completed reviews match your filters yet." />
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/10 backdrop-blur-sm px-4 py-3 ring-1 ring-white/15">
      <dt className="text-xs text-un-blue-100">{label}</dt>
      <dd className="mt-1 font-serif text-2xl font-semibold text-white">
        {value}
      </dd>
    </div>
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
