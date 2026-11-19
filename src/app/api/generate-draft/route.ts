import { NextResponse } from "next/server";
import {
  getRecordBySlug,
  listInvitesForReview,
  listSurveyTemplates,
  upsertRecord,
  type AarRecord,
} from "@/lib/db";
import { generateDraft, isGeminiConfigured, type GeneratedDraft } from "@/lib/gemini";
import { requireAuth } from "@/lib/auth";
import type { DraftBasis } from "@/data/reviews";

// PDF uploads plus two Gemini calls can take a couple of minutes on a large
// AAR (13 documents took 1-2 minutes in testing). Without this the platform
// default applies, which can cut a long generation off.
export const maxDuration = 300;

// Writes the generated draft into the record. Done here, not left to the
// browser: the browser used to be the only thing that saved it (via
// autosave, after the response arrived), so a generation that outlasted the
// tab -- a hung browser, a closed laptop, a timeout -- produced nothing.
function withDraft(record: AarRecord, draft: GeneratedDraft, basis: DraftBasis): AarRecord {
  return {
    ...record,
    summary: record.summary || draft.executiveSummary.slice(0, 220),
    executiveSummary: draft.executiveSummary,
    introduction: {
      countrySituation: draft.countrySituation,
      objectives: draft.objectives,
    },
    methodology: {
      ...record.methodology,
      scope: draft.scope,
      dataCollection: draft.dataCollection,
    },
    analysis: {
      contextualFactors: draft.contextualFactors,
      timeline: draft.timeline,
      inCountryStructure: draft.inCountryStructure,
      corporateResponseMechanisms: draft.corporateResponseMechanisms,
      deploymentOfExperts: draft.deploymentOfExperts,
      programmaticResponse: draft.programmaticResponse,
      operationalResponse: draft.operationalResponse,
      coordination: draft.coordination,
      communicationAndResourceMobilization: draft.communicationAndResourceMobilization,
    },
    findingsMatrix: draft.findingsMatrix,
    keyFindings: draft.findingsMatrix.map((r) => r.finding).filter(Boolean),
    recommendations: draft.findingsMatrix.map((r) => r.recommendation).filter(Boolean),
    reviewerFlags: draft.reviewerFlags,
    surveyRatings: draft.surveyRatings,
    draftBasis: basis,
    updatedAt: new Date().toISOString(),
  };
}

// Reads the current record from the DB rather than trusting whatever the
// client has in memory -- the client should save before calling this, but
// this way a stale/incomplete client state can't produce a draft that
// disagrees with what's actually persisted.
export async function POST(request: Request) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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

  // Same rule generateDraft uses for which responses go into the prompt.
  const draftBasis: DraftBasis = {
    generatedAt: new Date().toISOString(),
    respondedInviteIds: invites
      .filter((i) => i.status === "Responded" && i.answers)
      .map((i) => i.id),
    documentIds: record.documents.map((d) => d.id),
  };

  // Re-read just before saving: generation takes a minute or more, and the
  // record may have been autosaved in the meantime (notes, a stage change).
  // Only the draft fields are replaced; everything else is kept as it is now.
  try {
    const latest = (await getRecordBySlug(slug)) ?? record;
    await upsertRecord(withDraft(latest, result.draft, draftBasis));
  } catch (err) {
    // The browser still gets the draft and its autosave will store it, so
    // a failed save here isn't worth failing the whole request over.
    console.error("generate-draft: couldn't save the draft server-side", err);
  }

  return NextResponse.json({
    draft: result.draft,
    draftBasis,
    unreadableDocuments: result.unreadableDocuments,
  });
}
