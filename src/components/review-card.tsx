import Link from "next/link";
import type { Review } from "@/data/reviews";
import StatusBadge from "@/components/status-badge";
import { formatPeriod } from "@/lib/format";

export default function ReviewCard({ review }: { review: Review }) {
  return (
    <Link
      href={`/reviews/${review.slug}`}
      className="group flex flex-col rounded-2xl border border-un-border bg-un-surface p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-un-blue-400"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-un-blue-600">
          {review.crisisType}
        </span>
        <StatusBadge review={review} />
      </div>

      <h3 className="mt-3 font-serif text-lg font-semibold leading-snug text-un-ink group-hover:text-un-blue-700">
        {review.title}
      </h3>

      <p className="mt-2 text-sm leading-relaxed text-un-muted line-clamp-3">
        {review.summary}
      </p>

      <div className="mt-4 flex items-center justify-between border-t border-un-border pt-3 text-xs text-un-muted">
        <span className="truncate">{review.office}</span>
        <span className="shrink-0">
          {formatPeriod(review.periodStart, review.periodEnd)}
        </span>
      </div>
    </Link>
  );
}
