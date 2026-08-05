// Browser-local persistence for in-progress AAR drafts (the "Draft a New
// Review" workspace state). There is no backend yet, so this uses
// localStorage: it survives reloads and lets you resume a draft later, but
// it is scoped to one browser on one device — it will not appear for a
// coworker on a different machine.

import type {
  CrisisType,
  FindingRow,
  Interviewee,
  ReviewStage,
  TimelineEntry,
} from "@/data/reviews";

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

export type SavedAarDraft = {
  id: string;
  step: 1 | 2 | 3;
  updatedAt: string;
  overview: AarOverview;
  invites: SurveyInvite[];
  documents: DocumentSource[];
  methods: string[];
  notes: string;
  reportDraft: ReportDraft;
  timeline: TimelineEntry[];
  findingsMatrix: FindingRow[];
  interviewees: Interviewee[];
};

const STORAGE_KEY = "aar-drafts";

function readAll(): SavedAarDraft[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedAarDraft[]) : [];
  } catch {
    return [];
  }
}

function writeAll(drafts: SavedAarDraft[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
}

export function listSavedDrafts(): SavedAarDraft[] {
  return readAll().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getSavedDraft(id: string): SavedAarDraft | undefined {
  return readAll().find((d) => d.id === id);
}

export function upsertSavedDraft(draft: SavedAarDraft) {
  const all = readAll();
  const index = all.findIndex((d) => d.id === draft.id);
  if (index >= 0) all[index] = draft;
  else all.push(draft);
  writeAll(all);
}

export function deleteSavedDraft(id: string) {
  writeAll(readAll().filter((d) => d.id !== id));
}
