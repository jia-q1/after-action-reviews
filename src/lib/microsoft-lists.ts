// Reads/writes survey templates and survey invites via SharePoint Lists,
// reached through two Power Automate HTTP-triggered flows -- one per
// entity (POWER_AUTOMATE_TEMPLATES_URL, POWER_AUTOMATE_INVITES_URL) --
// each branching internally on an `operation` field rather than one flow
// per verb. Same signed-URL auth model as power-automate.ts and
// document-library.ts (no Azure AD app registration on our side).
//
// Each list's business key (TemplateId, InviteId) is a plain column,
// distinct from SharePoint's own internal item ID. This matters most for
// InviteId: it's the public, unguessable token embedded in the
// /respond/[id] link (see that page's own comment on this), so it must
// stay a real UUID we generate -- never SharePoint's own small sequential
// item ID, which would make other people's invites guessable.
//
// Falls back to Postgres (see db.ts) when these env vars aren't set, so
// this only takes effect once the SharePoint lists and flows exist.

import type { SurveyTemplateRecord, SurveyInviteRecord } from "@/lib/db";

export function isTemplatesListConfigured(): boolean {
  return Boolean(process.env.POWER_AUTOMATE_TEMPLATES_URL);
}

export function isInvitesListConfigured(): boolean {
  return Boolean(process.env.POWER_AUTOMATE_INVITES_URL);
}

// --- Survey templates -----------------------------------------------------

export async function getSurveyTemplatesFromList(): Promise<
  SurveyTemplateRecord[]
> {
  const flowUrl = process.env.POWER_AUTOMATE_TEMPLATES_URL;
  if (!flowUrl) return [];
  try {
    const res = await fetch(flowUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation: "get" }),
    });
    if (!res.ok) return [];
    return (await res.json()) as SurveyTemplateRecord[];
  } catch {
    return [];
  }
}

// Used both for one-time seeding of the real Crisis Bureau questionnaires
// and, going forward, for adding a new template without a code change --
// the original point of moving this to Lists.
export async function createSurveyTemplateInList(
  template: SurveyTemplateRecord,
): Promise<boolean> {
  const flowUrl = process.env.POWER_AUTOMATE_TEMPLATES_URL;
  if (!flowUrl) return false;
  try {
    const res = await fetch(flowUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation: "create", ...template }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// --- Survey invites ---------------------------------------------------

export async function listInvitesFromList(
  reviewSlug: string,
): Promise<SurveyInviteRecord[]> {
  const flowUrl = process.env.POWER_AUTOMATE_INVITES_URL;
  if (!flowUrl) return [];
  try {
    const res = await fetch(flowUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation: "list", reviewSlug }),
    });
    if (!res.ok) return [];
    return (await res.json()) as SurveyInviteRecord[];
  } catch {
    return [];
  }
}

export async function getInviteFromList(
  id: string,
): Promise<SurveyInviteRecord | undefined> {
  const flowUrl = process.env.POWER_AUTOMATE_INVITES_URL;
  if (!flowUrl) return undefined;
  try {
    const res = await fetch(flowUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation: "get", id }),
    });
    if (!res.ok) return undefined;
    const body = (await res.json()) as Partial<SurveyInviteRecord> | null;
    return body?.id ? (body as SurveyInviteRecord) : undefined;
  } catch {
    return undefined;
  }
}

export async function createInviteInList(input: {
  reviewSlug: string;
  templateId: string;
  name: string;
  role: string;
  unit: string;
  undpOffice: string;
  email: string;
}): Promise<SurveyInviteRecord> {
  const record: SurveyInviteRecord = {
    id: crypto.randomUUID(),
    reviewSlug: input.reviewSlug,
    templateId: input.templateId,
    name: input.name,
    role: input.role,
    unit: input.unit,
    undpOffice: input.undpOffice,
    email: input.email,
    status: "Draft",
    answers: null,
    sentAt: null,
    respondedAt: null,
    createdAt: new Date().toISOString(),
  };
  try {
    const flowUrl = process.env.POWER_AUTOMATE_INVITES_URL;
    if (flowUrl) {
      await fetch(flowUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "create", ...record }),
      });
    }
  } catch {
    // The invite still exists in the caller's response even if the flow
    // call failed to land -- same "don't block the UI on this" tradeoff
    // used elsewhere for flow calls.
  }
  return record;
}

export async function markInviteSentInList(
  id: string,
): Promise<SurveyInviteRecord | undefined> {
  const flowUrl = process.env.POWER_AUTOMATE_INVITES_URL;
  if (!flowUrl) return undefined;
  try {
    await fetch(flowUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operation: "markSent",
        id,
        sentAt: new Date().toISOString(),
      }),
    });
  } catch {
    // fall through to re-read below regardless
  }
  return getInviteFromList(id);
}

export async function submitResponseInList(
  id: string,
  answers: Record<string, string>,
): Promise<SurveyInviteRecord | undefined> {
  const flowUrl = process.env.POWER_AUTOMATE_INVITES_URL;
  if (!flowUrl) return undefined;
  try {
    await fetch(flowUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operation: "submitResponse",
        id,
        answers,
        respondedAt: new Date().toISOString(),
      }),
    });
  } catch {
    // fall through to re-read below regardless
  }
  return getInviteFromList(id);
}

export async function deleteInviteFromList(id: string): Promise<void> {
  const flowUrl = process.env.POWER_AUTOMATE_INVITES_URL;
  if (!flowUrl) return;
  try {
    await fetch(flowUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation: "delete", id }),
    });
  } catch {
    // best-effort cleanup, same as deleteDocumentFromLibrary
  }
}
