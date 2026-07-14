import Link from "next/link";
import { notFound } from "next/navigation";
import { getReviewBySlug, reviews } from "@/data/reviews";
import StatusBadge from "@/components/status-badge";

export function generateStaticParams() {
  return reviews.map((review) => ({ slug: review.slug }));
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const review = getReviewBySlug(slug);

  if (!review) {
    notFound();
  }

  return (
    <main className="flex-1 bg-background">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-un-blue-700 hover:text-un-blue-600"
        >
          <span aria-hidden>&larr;</span> Back to library
        </Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_280px]">
          <article>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-un-blue-600">
                {review.category}
              </span>
              <StatusBadge status={review.status} />
            </div>

            <h1 className="mt-3 font-serif text-3xl font-semibold text-un-ink">
              {review.title}
            </h1>
            <p className="mt-3 text-un-muted leading-relaxed">
              {review.summary}
            </p>

            <div className="mt-8 space-y-8">
              <Section title="Context">
                <p className="text-sm leading-relaxed text-un-ink/90">
                  {review.sections.context}
                </p>
              </Section>

              <Section title="What worked well">
                <BulletList items={review.sections.whatWorked} tone="good" />
              </Section>

              <Section title="Challenges">
                <BulletList
                  items={review.sections.challenges}
                  tone="challenge"
                />
              </Section>

              <Section title="Recommendations">
                <BulletList
                  items={review.sections.recommendations}
                  tone="action"
                />
              </Section>
            </div>
          </article>

          <aside className="space-y-5 lg:sticky lg:top-24 h-fit">
            <div className="rounded-2xl border border-un-border bg-un-surface p-5 shadow-sm">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-un-muted">
                Review details
              </h2>
              <dl className="mt-3 space-y-3 text-sm">
                <div>
                  <dt className="text-un-muted">Responsible office</dt>
                  <dd className="font-medium text-un-ink">{review.office}</dd>
                </div>
                <div>
                  <dt className="text-un-muted">Location</dt>
                  <dd className="font-medium text-un-ink">
                    {review.location}
                  </dd>
                </div>
                <div>
                  <dt className="text-un-muted">Event date</dt>
                  <dd className="font-medium text-un-ink">
                    {formatDate(review.eventDate)}
                  </dd>
                </div>
              </dl>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {review.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-un-blue-50 px-2.5 py-1 text-xs font-medium text-un-blue-700"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-un-border bg-un-surface p-5 shadow-sm space-y-2">
              <button
                type="button"
                className="w-full rounded-full bg-un-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-un-blue-700"
              >
                Edit this review
              </button>
              <button
                type="button"
                className="w-full rounded-full border border-un-border px-4 py-2.5 text-sm font-semibold text-un-blue-700 transition-colors hover:bg-un-blue-50"
              >
                Export as document
              </button>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-serif text-xl font-semibold text-un-ink border-b border-un-border pb-2">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

const toneDot: Record<string, string> = {
  good: "bg-emerald-500",
  challenge: "bg-un-gold-500",
  action: "bg-un-blue-600",
};

function BulletList({
  items,
  tone,
}: {
  items: string[];
  tone: keyof typeof toneDot;
}) {
  return (
    <ul className="space-y-2.5">
      {items.map((item, index) => (
        <li key={index} className="flex gap-3 text-sm leading-relaxed">
          <span
            className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${toneDot[tone]}`}
          />
          <span className="text-un-ink/90">{item}</span>
        </li>
      ))}
    </ul>
  );
}
