// Client-side access to AARs, backed by the real database via API routes
// (see src/lib/db.ts and src/app/api/reviews/**). Replaces the earlier
// localStorage-only prototype: every visitor hitting the same server now
// reads and writes the same data.

import type { CrisisType, Review, ReviewStage } from "@/data/reviews";

export type AarOverview = {
  country: string;
  crisisType: CrisisType;
  periodStart: string;
  periodEnd: string;
  office: string;
  leadAuthor: string;
  stage: ReviewStage;
  sharepointUrl: string;
};

export type DocumentSource = { id: string; name: string; size?: number };

export type InviteStatus = "Draft" | "Sent" | "Responded";

export type SurveyInvite = {
  id: string;
  name: string;
  role: string;
  unit: string;
  email: string;
  surveyId: string;
  status: InviteStatus;
  sentAt?: string;
  respondedAt?: string;
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
// plus the in-progress workspace extras (who's been invited, what's been
// attached, scratch notes) that only matter while it's still being put
// together.
export type AarRecord = Review & {
  invites: SurveyInvite[];
  documents: DocumentSource[];
  notes: string;
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
