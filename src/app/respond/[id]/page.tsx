import { notFound } from "next/navigation";
import { getInviteById, getRecordBySlug, getSurveyTemplateById } from "@/lib/db";
import ResponseForm from "./response-form";

// Public page — no auth, the invite id (an unguessable UUID) is the access
// control. Content changes as answers come in, so never statically cache.
export const dynamic = "force-dynamic";

export default async function RespondPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invite = await getInviteById(id);
  if (!invite) notFound();

  const template = await getSurveyTemplateById(invite.templateId);
  if (!template) notFound();

  const review = await getRecordBySlug(invite.reviewSlug);

  return (
    <main className="flex-1 bg-background">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-un-blue-600">
          UNDP After Action Review
        </p>
        <h1 className="mt-1 font-serif text-2xl font-semibold text-un-ink">
          {template.name}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-un-muted">
          {review
            ? `You've been invited to contribute to the After Action Review for ${review.title}.`
            : "You've been invited to contribute to an After Action Review."}{" "}
          {template.description}
        </p>

        <div className="mt-8 rounded-2xl border border-un-border bg-un-surface p-6 shadow-sm">
          <ResponseForm invite={invite} template={template} />
        </div>
      </div>
    </main>
  );
}
