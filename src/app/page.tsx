"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  crisisTypes,
  reviews,
  reviewYear,
  statusStyles,
  type ReviewStage,
} from "@/data/reviews";
import ReviewCard from "@/components/review-card";
import { formatPeriod } from "@/lib/format";
import { listSavedDrafts, type SavedAarDraft } from "@/lib/draft-storage";

type InProgressItem = {
  key: string;
  href: string;
  origin: "draft" | "sample";
  crisisType: string;
  title: string;
  office: string;
  period: string;
  stage: ReviewStage;
};

function draftToItem(draft: SavedAarDraft): InProgressItem {
  const { overview } = draft;
  return {
    key: draft.id,
    href: `/new?draft=${draft.id}`,
    origin: "draft",
    crisisType: overview.crisisType,
    title: overview.country
      ? `${overview.country} — ${overview.crisisType}`
      : "Untitled draft",
    office: overview.office || "Office not set",
    period: formatPeriod(overview.periodStart, overview.periodEnd),
    stage: overview.stage,
  };
}

export default function LibraryPage() {
  const [query, setQuery] = useState("");
  const [activeCrisisType, setActiveCrisisType] = useState<string>("All");
  const [savedDrafts, setSavedDrafts] = useState<SavedAarDraft[]>([]);

  // One-time read from localStorage (an external system) on mount.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setSavedDrafts(listSavedDrafts());
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reviews.filter((review) => {
      const matchesQuery =
        q.length === 0 ||
        review.title.toLowerCase().includes(q) ||
        review.country.toLowerCase().includes(q) ||
        review.summary.toLowerCase().includes(q) ||
        review.tags.some((tag) => tag.toLowerCase().includes(q));
      const matchesCrisisType =
        activeCrisisType === "All" || review.crisisType === activeCrisisType;
      return matchesQuery && matchesCrisisType;
    });
  }, [query, activeCrisisType]);

  const completed = matches
    .filter((r) => r.status === "Completed")
    .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));

  const inProgressSamples = matches
    .filter((r) => r.status === "In Progress")
    .sort((a, b) => b.periodStart.localeCompare(a.periodStart));

  const inProgress = useMemo(() => {
    const q = query.trim().toLowerCase();
    const draftItems = savedDrafts
      .filter((d) => {
        const matchesQuery =
          q.length === 0 || d.overview.country.toLowerCase().includes(q);
        const matchesCrisisType =
          activeCrisisType === "All" ||
          d.overview.crisisType === activeCrisisType;
        return matchesQuery && matchesCrisisType;
      })
      .map(draftToItem);
    const sampleItems: InProgressItem[] = inProgressSamples.map((review) => ({
      key: review.slug,
      href: `/reviews/${review.slug}`,
      origin: "sample",
      crisisType: review.crisisType,
      title: review.title,
      office: review.office,
      period: formatPeriod(review.periodStart, review.periodEnd),
      stage: review.stage ?? "Drafting",
    }));
    return [...draftItems, ...sampleItems];
  }, [savedDrafts, inProgressSamples, query, activeCrisisType]);

  const completedByYear = useMemo(() => {
    const groups = new Map<number, typeof completed>();
    for (const review of completed) {
      const y = reviewYear(review);
      groups.set(y, [...(groups.get(y) ?? []), review]);
    }
    return [...groups.entries()].sort((a, b) => b[0] - a[0]);
  }, [completed]);

  const counts = {
    total: reviews.length + savedDrafts.length,
    completed: reviews.filter((r) => r.status === "Completed").length,
    inProgress:
      reviews.filter((r) => r.status === "In Progress").length +
      savedDrafts.length,
  };

  return (
    <main className="flex-1 bg-background">
      <section className="border-b border-un-border bg-gradient-to-br from-un-blue-950 via-un-blue-900 to-un-blue-700 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-un-blue-400">
            After Action Review Programme
          </p>
          <h1 className="mt-3 font-serif text-3xl sm:text-4xl font-semibold max-w-2xl">
            A shared library of lessons learned across every crisis response.
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
            <Link
              href="/new"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-un-gold-500 px-6 py-3 text-sm font-semibold text-un-blue-950 shadow-lg transition-colors hover:bg-un-gold-600"
            >
              + Start a new AAR
            </Link>
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
            label="All crisis types"
            active={activeCrisisType === "All"}
            onClick={() => setActiveCrisisType("All")}
          />
          {crisisTypes.map((type) => (
            <FilterChip
              key={type}
              label={type}
              active={activeCrisisType === type}
              onClick={() => setActiveCrisisType(type)}
            />
          ))}
        </div>

        <nav className="mt-4 flex gap-4 text-sm">
          <a
            href="#completed"
            className="font-medium text-un-blue-700 hover:text-un-blue-600"
          >
            Section 1 &middot; Completed ({completed.length})
          </a>
          <a
            href="#in-progress"
            className="font-medium text-un-blue-700 hover:text-un-blue-600"
          >
            Section 2 &middot; In progress ({inProgress.length})
          </a>
        </nav>
      </div>

      <section id="completed" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 scroll-mt-20">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-serif text-2xl font-semibold text-un-ink">
            Section 1 &middot; Completed AARs
          </h2>
          <span className="text-sm text-un-muted">
            Organized by year &middot; published to the library or linked
            from SharePoint
          </span>
        </div>

        {completedByYear.length > 0 ? (
          <div className="mt-6 space-y-10">
            {completedByYear.map(([year, yearReviews]) => (
              <div key={year}>
                <h3 className="font-serif text-lg font-semibold text-un-blue-800 border-b border-un-border pb-2">
                  {year}
                </h3>
                <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {yearReviews.map((review) => (
                    <ReviewCard key={review.slug} review={review} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="No completed reviews match your filters yet." />
        )}
      </section>

      <section id="in-progress" className="border-t border-un-border bg-un-blue-50/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 scroll-mt-20">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-serif text-2xl font-semibold text-un-ink">
              Section 2 &middot; In-Progress AARs
            </h2>
            <span className="text-sm text-un-muted">
              Being drafted, reviewed, or validated
            </span>
          </div>

          {inProgress.length > 0 ? (
            <ul className="mt-6 divide-y divide-un-border overflow-hidden rounded-2xl border border-un-border bg-un-surface shadow-sm">
              {inProgress.map((item) => (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    className="flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-un-blue-50/60 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-un-blue-600">
                          {item.crisisType}
                        </span>
                        <StageBadge stage={item.stage} />
                      </div>
                      <p className="mt-1 font-serif text-base font-semibold text-un-ink">
                        {item.title}
                      </p>
                      <p className="mt-0.5 truncate text-sm text-un-muted">
                        {item.office}
                        {item.origin === "draft" && (
                          <span className="text-un-blue-600">
                            {" "}
                            &middot; saved on this device
                          </span>
                        )}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm text-un-muted">
                      {item.period}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState message="No in-progress reviews match your filters right now." />
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
