"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { categories, reviews, type ReviewStatus } from "@/data/reviews";
import ReviewCard from "@/components/review-card";

const statuses: ReviewStatus[] = ["Approved", "In Review", "Draft"];

export default function LibraryPage() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [activeStatus, setActiveStatus] = useState<string>("All");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reviews.filter((review) => {
      const matchesQuery =
        q.length === 0 ||
        review.title.toLowerCase().includes(q) ||
        review.summary.toLowerCase().includes(q) ||
        review.tags.some((tag) => tag.toLowerCase().includes(q));
      const matchesCategory =
        activeCategory === "All" || review.category === activeCategory;
      const matchesStatus =
        activeStatus === "All" || review.status === activeStatus;
      return matchesQuery && matchesCategory && matchesStatus;
    });
  }, [query, activeCategory, activeStatus]);

  const counts = {
    total: reviews.length,
    approved: reviews.filter((r) => r.status === "Approved").length,
    inReview: reviews.filter((r) => r.status === "In Review").length,
    draft: reviews.filter((r) => r.status === "Draft").length,
  };

  return (
    <main className="flex-1 bg-background">
      <section className="border-b border-un-border bg-gradient-to-br from-un-blue-950 via-un-blue-900 to-un-blue-700 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-un-blue-400">
            After Action Review Programme
          </p>
          <h1 className="mt-3 font-serif text-3xl sm:text-4xl font-semibold max-w-2xl">
            A shared library of lessons learned across every mission and
            programme.
          </h1>
          <p className="mt-4 max-w-2xl text-un-blue-100 leading-relaxed">
            Browse approved After Action Reviews, or start a new one with
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
                placeholder="Search reviews by title, theme, or keyword"
                className="w-full rounded-full border-0 bg-white py-3 pl-11 pr-4 text-sm text-un-ink placeholder:text-un-muted shadow-lg focus:outline-none focus:ring-2 focus:ring-un-blue-400"
              />
            </div>
            <Link
              href="/new"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-un-gold-500 px-6 py-3 text-sm font-semibold text-un-blue-950 shadow-lg transition-colors hover:bg-un-gold-600"
            >
              + Draft a new review
            </Link>
          </div>

          <dl className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl">
            <StatTile label="Total reviews" value={counts.total} />
            <StatTile label="Approved" value={counts.approved} />
            <StatTile label="In review" value={counts.inReview} />
            <StatTile label="Drafts" value={counts.draft} />
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <FilterChip
              label="All themes"
              active={activeCategory === "All"}
              onClick={() => setActiveCategory("All")}
            />
            {categories.map((category) => (
              <FilterChip
                key={category}
                label={category}
                active={activeCategory === category}
                onClick={() => setActiveCategory(category)}
              />
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <FilterChip
              label="All statuses"
              active={activeStatus === "All"}
              onClick={() => setActiveStatus("All")}
              variant="status"
            />
            {statuses.map((status) => (
              <FilterChip
                key={status}
                label={status}
                active={activeStatus === status}
                onClick={() => setActiveStatus(status)}
                variant="status"
              />
            ))}
          </div>
        </div>

        <p className="mt-6 text-sm text-un-muted">
          Showing {filtered.length} of {reviews.length} reviews
        </p>

        {filtered.length > 0 ? (
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((review) => (
              <ReviewCard key={review.slug} review={review} />
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-un-border bg-un-surface py-16 text-center text-un-muted">
            No reviews match your filters yet.
          </div>
        )}
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
  variant = "category",
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  variant?: "category" | "status";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors " +
        (active
          ? variant === "category"
            ? "border-un-blue-600 bg-un-blue-600 text-white"
            : "border-un-gold-600 bg-un-gold-500 text-un-blue-950"
          : "border-un-border bg-un-surface text-un-muted hover:border-un-blue-400 hover:text-un-blue-700")
      }
    >
      {label}
    </button>
  );
}
