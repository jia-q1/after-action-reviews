import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getReviewBySlug,
  reviews,
  priorityStyles,
  type Review,
} from "@/data/reviews";
import StatusBadge from "@/components/status-badge";
import { formatMonthYear, formatPeriod } from "@/lib/format";

export function generateStaticParams() {
  return reviews.map((review) => ({ slug: review.slug }));
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

  const isInProgress = review.status === "In Progress";

  return (
    <main className="flex-1 bg-background">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-un-blue-700 hover:text-un-blue-600"
        >
          <span aria-hidden>&larr;</span> Back to library
        </Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_300px]">
          <article>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-un-blue-600">
                {review.crisisType}
              </span>
              <StatusBadge review={review} />
            </div>

            <h1 className="mt-3 font-serif text-3xl font-semibold text-un-ink">
              {review.title}
            </h1>
            <p className="mt-1 text-sm text-un-muted">
              {formatPeriod(review.periodStart, review.periodEnd)} &middot;{" "}
              {review.office}
            </p>

            {isInProgress && (
              <div className="mt-4 rounded-xl border border-un-gold-500/40 bg-un-gold-100/60 px-4 py-3 text-sm text-un-blue-950">
                This After Action Review is still in progress
                {review.stage ? ` (${review.stage})` : ""}. Sections below
                reflect the current draft and are subject to change before
                validation.
              </div>
            )}

            <div className="mt-8 space-y-8">
              <Section title="Executive Summary">
                <Prose text={review.executiveSummary} />
              </Section>

              <Section title="1. Introduction">
                <SubSection title="1.1 Country situation and context">
                  <Prose text={review.introduction.countrySituation} />
                </SubSection>
                <SubSection title="1.2 Objectives of After Action Review">
                  <Prose text={review.introduction.objectives} />
                </SubSection>
              </Section>

              <Section title="2. Methodology">
                <SubSection title="2.1 Scope of After Action Review">
                  <Prose text={review.methodology.scope} />
                </SubSection>
                <SubSection title="2.2–2.4 Data collection, analysis, and validation">
                  <Prose text={review.methodology.dataCollection} />
                  {review.methodology.dataCollectionMethods.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {review.methodology.dataCollectionMethods.map(
                        (method) => (
                          <span
                            key={method}
                            className="rounded-full bg-un-blue-50 px-2.5 py-1 text-xs font-medium text-un-blue-700"
                          >
                            {method}
                          </span>
                        ),
                      )}
                    </div>
                  )}
                </SubSection>
              </Section>

              <Section title="3. Analysis of the UNDP Response">
                <SubSection title="3.1 Contextual factors influencing the response">
                  <Prose text={review.analysis.contextualFactors} />
                </SubSection>

                {review.analysis.timeline.length > 0 && (
                  <SubSection title="3.2 Timeline of crisis events and response actions">
                    <Timeline entries={review.analysis.timeline} />
                  </SubSection>
                )}

                <AccordionSubSection title="3.3 UNDP in-country structure and response capacity">
                  <Prose text={review.analysis.inCountryStructure} />
                </AccordionSubSection>
                <AccordionSubSection title="3.4 UNDP corporate response mechanisms">
                  <Prose text={review.analysis.corporateResponseMechanisms} />
                </AccordionSubSection>
                <AccordionSubSection title="3.5 Deployment of experts">
                  <Prose text={review.analysis.deploymentOfExperts} />
                </AccordionSubSection>
                <AccordionSubSection title="3.6 Programmatic response">
                  <Prose text={review.analysis.programmaticResponse} />
                </AccordionSubSection>
                <AccordionSubSection title="3.7 Operational response">
                  <Prose text={review.analysis.operationalResponse} />
                </AccordionSubSection>
                <AccordionSubSection title="3.8 Coordination">
                  <Prose text={review.analysis.coordination} />
                </AccordionSubSection>
                <AccordionSubSection title="3.9 Communication and resource mobilization">
                  <Prose
                    text={review.analysis.communicationAndResourceMobilization}
                  />
                </AccordionSubSection>
              </Section>

              <Section title="4. Findings and Recommendations">
                <SubSection title="4.1 Key findings and lessons learned">
                  {review.keyFindings.length > 0 ? (
                    <BulletList items={review.keyFindings} tone="challenge" />
                  ) : (
                    <EmptyNote />
                  )}
                </SubSection>
                <SubSection title="4.2 Actionable recommendations">
                  {review.recommendations.length > 0 ? (
                    <BulletList items={review.recommendations} tone="action" />
                  ) : (
                    <EmptyNote />
                  )}
                </SubSection>
              </Section>

              {review.findingsMatrix.length > 0 && (
                <Section title="Annex 7: Matrix of Main Findings and Recommendations">
                  <FindingsMatrix review={review} />
                </Section>
              )}

              {review.interviewees.length > 0 && (
                <Section title="Annex 3: List of People Interviewed">
                  <IntervieweeList review={review} />
                </Section>
              )}
            </div>
          </article>

          <aside className="space-y-5 lg:sticky lg:top-24 h-fit">
            <div className="rounded-2xl border border-un-border bg-un-surface p-5 shadow-sm">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-un-muted">
                Review details
              </h2>
              <dl className="mt-3 space-y-3 text-sm">
                <div>
                  <dt className="text-un-muted">Country / crisis</dt>
                  <dd className="font-medium text-un-ink">
                    {review.country}
                  </dd>
                </div>
                <div>
                  <dt className="text-un-muted">Responsible office</dt>
                  <dd className="font-medium text-un-ink">{review.office}</dd>
                </div>
                <div>
                  <dt className="text-un-muted">Lead author / team</dt>
                  <dd className="font-medium text-un-ink">
                    {review.leadAuthor}
                  </dd>
                </div>
                <div>
                  <dt className="text-un-muted">Review period</dt>
                  <dd className="font-medium text-un-ink">
                    {formatMonthYear(review.periodStart)} &ndash;{" "}
                    {formatMonthYear(review.periodEnd)}
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
              {review.sharepointUrl && (
                <a
                  href={review.sharepointUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block w-full rounded-full bg-un-blue-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-un-blue-700"
                >
                  View full report on SharePoint
                </a>
              )}
              <button
                type="button"
                className="w-full rounded-full border border-un-border px-4 py-2.5 text-sm font-semibold text-un-blue-700 transition-colors hover:bg-un-blue-50"
              >
                {isInProgress ? "Continue drafting" : "Edit this review"}
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
      <div className="mt-4 space-y-5">{children}</div>
    </section>
  );
}

function SubSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="font-semibold text-sm text-un-ink">{title}</h3>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function AccordionSubSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-lg border border-un-border open:bg-un-blue-50/30">
      <summary className="cursor-pointer list-none px-3.5 py-2.5 text-sm font-semibold text-un-ink marker:content-none flex items-center justify-between gap-2">
        {title}
        <span
          aria-hidden
          className="text-un-muted transition-transform group-open:rotate-180"
        >
          &#9662;
        </span>
      </summary>
      <div className="px-3.5 pb-3.5 pt-1">{children}</div>
    </details>
  );
}

function Prose({ text }: { text: string }) {
  return (
    <p className="text-sm leading-relaxed text-un-ink/90 whitespace-pre-line">
      {text}
    </p>
  );
}

function EmptyNote() {
  return (
    <p className="text-sm italic text-un-muted">
      Not yet drafted for this review.
    </p>
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

function Timeline({
  entries,
}: {
  entries: { date: string; event: string }[];
}) {
  return (
    <ol className="relative ml-1.5 space-y-4 border-l border-un-border pl-5">
      {entries.map((entry, index) => (
        <li key={index} className="relative">
          <span className="absolute -left-[1.45rem] top-1 h-2.5 w-2.5 rounded-full bg-un-blue-600 ring-4 ring-un-surface" />
          <p className="text-xs font-semibold uppercase tracking-wide text-un-blue-600">
            {entry.date}
          </p>
          <p className="text-sm text-un-ink/90">{entry.event}</p>
        </li>
      ))}
    </ol>
  );
}

function FindingsMatrix({ review }: { review: Review }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-un-border">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-un-blue-950 text-white">
          <tr>
            <th className="px-3 py-2.5 font-semibold">Response area</th>
            <th className="px-3 py-2.5 font-semibold">Finding</th>
            <th className="px-3 py-2.5 font-semibold">Recommendation</th>
            <th className="px-3 py-2.5 font-semibold">Key actions required</th>
            <th className="px-3 py-2.5 font-semibold">Priority</th>
          </tr>
        </thead>
        <tbody>
          {review.findingsMatrix.map((row, index) => (
            <tr
              key={index}
              className="border-t border-un-border align-top odd:bg-un-surface even:bg-un-blue-50/30"
            >
              <td className="px-3 py-3 font-medium text-un-ink whitespace-nowrap">
                {row.responseArea}
              </td>
              <td className="px-3 py-3 text-un-ink/90">{row.finding}</td>
              <td className="px-3 py-3 text-un-ink/90">
                {row.recommendation}
              </td>
              <td className="px-3 py-3 text-un-ink/90">{row.keyActions}</td>
              <td className="px-3 py-3">
                <span
                  className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${priorityStyles[row.priority]}`}
                >
                  {row.priority}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IntervieweeList({ review }: { review: Review }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-un-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-un-blue-50 text-un-blue-950">
          <tr>
            <th className="px-3 py-2.5 font-semibold">Name</th>
            <th className="px-3 py-2.5 font-semibold">Title</th>
            <th className="px-3 py-2.5 font-semibold">Agency / unit</th>
          </tr>
        </thead>
        <tbody>
          {review.interviewees.map((person, index) => (
            <tr key={index} className="border-t border-un-border">
              <td className="px-3 py-2.5 font-medium text-un-ink">
                {person.name}
              </td>
              <td className="px-3 py-2.5 text-un-ink/90">{person.title}</td>
              <td className="px-3 py-2.5 text-un-ink/90">{person.agency}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
