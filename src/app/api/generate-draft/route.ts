import { NextResponse } from "next/server";
import { getRecordBySlug, listInvitesForReview, listSurveyTemplates } from "@/lib/db";
import { generateDraft, isGeminiConfigured } from "@/lib/gemini";

// Reads the current record from the DB rather than trusting whatever the
// client has in memory -- the client should save before calling this, but
// this way a stale/incomplete client state can't produce a draft that
// disagrees with what's actually persisted.
export async function POST(request: Request) {
  if (!isGeminiConfigured()) {
    return NextResponse.json(
      { error: "AI drafting isn't configured (GEMINI_API_KEY is unset)." },
      { status: 503 },
    );
  }

  const { slug } = (await request.json()) as { slug?: string };
  if (!slug) {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }

  const record = await getRecordBySlug(slug);
  if (!record) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  const [invites, templates] = await Promise.all([
    listInvitesForReview(slug),
    listSurveyTemplates(),
  ]);

  const result = await generateDraft({
    overview: {
      country: record.country,
      crisisName: record.crisisName,
      crisisType: record.crisisType,
      periodStart: record.periodStart,
      periodEnd: record.periodEnd,
      office: record.office,
    },
    documents: record.documents,
    notes: record.notes,
    prompt: record.prompt,
    invites,
    templates,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({
    draft: result.draft,
    unreadableDocuments: result.unreadableDocuments,
  });
}
