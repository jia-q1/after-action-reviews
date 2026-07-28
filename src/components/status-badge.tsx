import { statusStyles, type Review } from "@/data/reviews";

export default function StatusBadge({ review }: { review: Review }) {
  const label =
    review.status === "Completed" ? "Completed" : review.stage ?? "In Progress";
  const style = statusStyles[label] ?? statusStyles["In Progress"];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${style.badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {label}
    </span>
  );
}
