// Client-side access to AARs, backed by the real database via API routes
// (see src/lib/db.ts and src/app/api/**). Replaces the earlier
// localStorage-only prototype: every visitor hitting the same server now
// reads and writes the same data.

import type { CrisisType, Review, ReviewStage, ResponseArea } from "@/data/reviews";

export type AarOverview = {
  country: string;
  crisisName: string;
  crisisType: CrisisType;
  crisisBureauFocalPointRegional: string;
  crisisBureauFocalPointSops: string;
  regionalBureauFocalPoint: string;
  periodStart: string;
  periodEnd: string;
  office: string;
  leadAuthor: string;
  stage: ReviewStage;
};

// `content` is the raw file bytes, base64-encoded, so the eventual AI
// drafting step has something real to read — manually-added sources (no
// file, just a typed label) have no content. Once the SharePoint document
// library is configured (see src/lib/document-library.ts), new uploads
// carry `sharepointId`/`sharepointUrl` instead of `content` — the bytes
// live in SharePoint, not in this record — so both are optional and a
// document should only ever have one or the other, never neither (except
// manually-added, content-less sources).
export type DocumentSource = {
  id: string;
  name: string;
  size?: number;
  mimeType?: string;
  content?: string;
  sharepointId?: string;
  sharepointUrl?: string;
  // How this specific piece of evidence was gathered (desk review, key
  // informant interview, etc.) — a property of the document, not the AAR
  // as a whole, since different sources are gathered different ways.
  dataCollectionMethod?: string;
};

export type ReportDraft = {
  executiveSummary: string;
  countrySituation: string;
  objectives: string;
  scope: string;
  dataCollection: string;
  contextualFactors: string;
  inCountryStructure: string;
  corporateResponseMechanisms: string;
  deploymentOfExperts: string;
  programmaticResponse: string;
  operationalResponse: string;
  coordination: string;
  communicationAndResourceMobilization: string;
};

// The full persisted shape: every field a finished report needs (Review),
// plus the in-progress workspace extras (what's been attached, scratch
// notes) that only matter while it's still being put together. Survey
// invites are NOT part of this record — they live in their own table (see
// below) so independent respondents never race against whoever is editing
// the report itself.
export type AarRecord = Review & {
  documents: DocumentSource[];
  notes: string;
  // The exact prompt text used for this AAR's draft — saved per-record
  // (rather than always re-reading the current DEFAULT_PROMPT) so an
  // AAR's generation instructions stay reproducible even if the default
  // template is tuned later.
  prompt: string;
  updatedAt: string;
};

export async function listRecords(): Promise<AarRecord[]> {
  const res = await fetch("/api/reviews", { cache: "no-store" });
  if (!res.ok) return [];
  return (await res.json()) as AarRecord[];
}

export async function getRecord(slug: string): Promise<AarRecord | undefined> {
  const res = await fetch(`/api/reviews/${encodeURIComponent(slug)}`, {
    cache: "no-store",
  });
  if (!res.ok) return undefined;
  return (await res.json()) as AarRecord;
}

export async function saveRecord(record: AarRecord): Promise<AarRecord> {
  const res = await fetch(`/api/reviews/${encodeURIComponent(record.slug)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record),
  });
  if (!res.ok) {
    throw new Error(`Failed to save ${record.slug}: ${res.status}`);
  }
  return (await res.json()) as AarRecord;
}

// --- Survey templates -------------------------------------------------

export type SurveyQuestion = { id: string; text: string; order: number };

export type SurveyTemplate = {
  id: string;
  name: string;
  audience: string;
  description: string;
  informsSections: ResponseArea[];
  suggestedRoles: string[];
  questions: SurveyQuestion[];
  updatedAt: string;
};

export async function listSurveyTemplates(): Promise<SurveyTemplate[]> {
  const res = await fetch("/api/survey-templates", { cache: "no-store" });
  if (!res.ok) return [];
  return (await res.json()) as SurveyTemplate[];
}

// --- Survey invites -----------------------------------------------------

export type InviteStatus = "Draft" | "Sent" | "Responded";

export type SurveyInvite = {
  id: string;
  reviewSlug: string;
  templateId: string;
  name: string;
  role: string;
  unit: string;
  undpOffice: string;
  email: string;
  status: InviteStatus;
  answers: Record<string, string> | null;
  sentAt: string | null;
  respondedAt: string | null;
  createdAt: string;
};

export async function listInvites(reviewSlug: string): Promise<SurveyInvite[]> {
  const res = await fetch(
    `/api/invites?reviewSlug=${encodeURIComponent(reviewSlug)}`,
    { cache: "no-store" },
  );
  if (!res.ok) return [];
  return (await res.json()) as SurveyInvite[];
}

export async function createInvite(input: {
  reviewSlug: string;
  templateId: string;
  name: string;
  role: string;
  unit: string;
  undpOffice: string;
  email: string;
}): Promise<SurveyInvite | undefined> {
  const res = await fetch("/api/invites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) return undefined;
  return (await res.json()) as SurveyInvite;
}

export async function markInviteSent(id: string): Promise<SurveyInvite | undefined> {
  const res = await fetch(`/api/invites/${encodeURIComponent(id)}`, {
    method: "PATCH",
  });
  if (!res.ok) return undefined;
  return (await res.json()) as SurveyInvite;
}

export async function sendInvite(
  id: string,
  input: { surveyLink: string; aarTitle: string },
): Promise<{ ok: true; invite: SurveyInvite } | { ok: false; error: string }> {
  const res = await fetch(`/api/invites/${encodeURIComponent(id)}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { ok: false, error: body.error ?? "Failed to send." };
  }
  return { ok: true, invite: (await res.json()) as SurveyInvite };
}

export async function deleteInvite(id: string): Promise<void> {
  await fetch(`/api/invites/${encodeURIComponent(id)}`, { method: "DELETE" });
}
