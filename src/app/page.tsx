"use client";

import { useEffect, useMemo, useState } from "react";
import { reviewYear } from "@/data/reviews";
import ReviewCard from "@/components/review-card";
import { archivedAars } from "@/data/archive-documents";
import { listRecords, type AarRecord } from "@/lib/aar-store";

const SURGE_PORTAL_URL =
  "https://undp.sharepoint.com/teams/SURGEPortal/SURGE%20Planning%20Quick%20Links/Forms/AllItems.aspx?csf=1&web=1&e=A1ouIX&FolderCTID=0x0120006C37C0AF60177C4E998CDF472C146D6B&id=%2Fteams%2FSURGEPortal%2FSURGE%20Planning%20Quick%20Links%2FCrisis%20Response%20After%20Action%20Reviews%20%28AARs%29";

// Public-facing page for all UNDP personnel: completed reviews and a
// recommendations dashboard. In-progress drafting/survey/review work lives
// in the separate AAR Workspace (/workspace) instead.
export default function LibraryPage() {
  const [query, setQuery] = useState("");
  const [records, setRecords] = useState<AarRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listRecords().then((data) => {
      if (!cancelled) {
        setRecords(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
            Browse completed After Action Reviews and the recommendations
            they produced across UNDP crisis response.
          </p>

          <div className="mt-8 max-w-xl">
            <div className="relative">
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
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-2xl font-semibold text-un-ink">
              AARs Dashboard
            </h2>
            <p className="mt-1 text-sm text-un-muted">
              Recommendations dashboard, hosted on the SURGE Portal.
            </p>
          </div>
          <a
            href={SURGE_PORTAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-un-border px-4 py-2 text-xs font-semibold text-un-blue-700 hover:border-un-blue-600 hover:text-un-blue-600 transition-colors"
          >
            SURGE Portal
          </a>
        </div>

        <EmptyState message="Nothing here yet." />
      </section>

      <section className="border-t border-un-border bg-un-blue-50/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
          <h2 className="font-serif text-2xl font-semibold text-un-ink">
            Completed AARs Repository
          </h2>

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
                <EmptyState message="No completed reviews match your search yet." />
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-un-border bg-un-surface py-16 text-center text-un-muted">
      {message}
    </div>
  );
}
