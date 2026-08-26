// Server-only Postgres persistence (Vercel Postgres / Neon), reachable from
// both the deployed app and local dev via the same POSTGRES_URL connection
// string — so unlike the earlier SQLite prototype, this is genuinely shared
// and durable everywhere, not just on one machine.
//
// Requires a database connected to this project (Vercel dashboard → Storage
// → Create Database → Postgres) and its connection string available as
// POSTGRES_URL (Vercel injects this automatically for the deployed app; for
// local dev, run `vercel env pull .env.local` or copy it manually).

import "server-only";
import { sql } from "@vercel/postgres";
import {
  reviews as seedReviews,
  surveyTemplates as seedSurveyTemplates,
  type Review,
  type ResponseArea,
} from "@/data/reviews";
import type { DocumentSource } from "@/lib/aar-store";

export type AarRecord = Review & {
  documents: DocumentSource[];
  notes: string;
  prompt: string;
  updatedAt: string;
};

export type SurveyQuestion = { id: string; text: string; order: number };

export type SurveyTemplateRecord = {
  id: string;
  name: string;
  audience: string;
  description: string;
  informsSections: ResponseArea[];
  suggestedRoles: string[];
  questions: SurveyQuestion[];
  updatedAt: string;
};

export type InviteStatus = "Draft" | "Sent" | "Responded";

export type SurveyInviteRecord = {
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

declare global {
  var __aarSchemaReady: Promise<void> | undefined;
}

async function ensureSchema(): Promise<void> {
  if (!globalThis.__aarSchemaReady) {
    globalThis.__aarSchemaReady = (async () => {
      // Table creation is unconditional (and idempotent via IF NOT EXISTS) —
      // seeding below is separately gated per-table so an already-seeded
      // `reviews` table doesn't short-circuit creating the newer survey
      // tables on an existing database.
      await sql`
        CREATE TABLE IF NOT EXISTS reviews (
          slug TEXT PRIMARY KEY,
          status TEXT NOT NULL,
          stage TEXT,
          crisis_type TEXT NOT NULL,
          period_start TEXT NOT NULL,
          period_end TEXT NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL,
          data JSONB NOT NULL
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS survey_templates (
          id TEXT PRIMARY KEY,
          updated_at TIMESTAMPTZ NOT NULL,
          data JSONB NOT NULL
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS survey_invites (
          id TEXT PRIMARY KEY,
          review_slug TEXT NOT NULL,
          template_id TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'Draft',
          created_at TIMESTAMPTZ NOT NULL,
          sent_at TIMESTAMPTZ,
          responded_at TIMESTAMPTZ,
          data JSONB NOT NULL
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS survey_invites_review_slug_idx
          ON survey_invites (review_slug)
      `;

      const { rows: reviewRows } = await sql<{ count: string }>`
        SELECT COUNT(*)::text AS count FROM reviews
      `;
      if (Number(reviewRows[0].count) === 0) {
        const now = new Date().toISOString();
        for (const review of seedReviews) {
          const record: AarRecord = {
            ...review,
            documents: [],
            notes: "",
            // Empty means "use whatever DEFAULT_PROMPT the client currently
            // has" — see the fallback in /new's hydration effect.
            prompt: "",
            updatedAt: now,
          };
          await sql`
            INSERT INTO reviews (slug, status, stage, crisis_type, period_start, period_end, updated_at, data)
            VALUES (
              ${record.slug},
              ${record.status},
              ${record.stage ?? null},
              ${record.crisisType},
              ${record.periodStart},
              ${record.periodEnd},
              ${record.updatedAt},
              ${JSON.stringify(record)}::jsonb
            )
            ON CONFLICT (slug) DO NOTHING
          `;
        }
      }

      const { rows: templateRows } = await sql<{ count: string }>`
        SELECT COUNT(*)::text AS count FROM survey_templates
      `;
      if (Number(templateRows[0].count) === 0) {
        const now = new Date().toISOString();
        for (const template of seedSurveyTemplates) {
          const record: SurveyTemplateRecord = {
            id: template.id,
            name: template.name,
            audience: template.audience,
            description: template.description,
            informsSections: template.informsSections,
            suggestedRoles: template.suggestedRoles,
            questions: template.questions.map((text, index) => ({
              id: `${template.id}-q${index + 1}`,
              text,
              order: index,
            })),
            updatedAt: now,
          };
          await sql`
            INSERT INTO survey_templates (id, updated_at, data)
            VALUES (${record.id}, ${record.updatedAt}, ${JSON.stringify(record)}::jsonb)
            ON CONFLICT (id) DO NOTHING
          `;
        }
      }
    })();
  }
  return globalThis.__aarSchemaReady;
}

export async function listRecords(): Promise<AarRecord[]> {
  await ensureSchema();
  const { rows } = await sql<{ data: AarRecord }>`
    SELECT data FROM reviews ORDER BY updated_at DESC
  `;
  return rows.map((row) => row.data);
}

export async function getRecordBySlug(
  slug: string,
): Promise<AarRecord | undefined> {
  await ensureSchema();
  const { rows } = await sql<{ data: AarRecord }>`
    SELECT data FROM reviews WHERE slug = ${slug}
  `;
  return rows[0]?.data;
}

export async function upsertRecord(record: AarRecord): Promise<AarRecord> {
  await ensureSchema();
  await sql`
    INSERT INTO reviews (slug, status, stage, crisis_type, period_start, period_end, updated_at, data)
    VALUES (
      ${record.slug},
      ${record.status},
      ${record.stage ?? null},
      ${record.crisisType},
      ${record.periodStart},
      ${record.periodEnd},
      ${record.updatedAt},
      ${JSON.stringify(record)}::jsonb
    )
    ON CONFLICT (slug) DO UPDATE SET
      status = excluded.status,
      stage = excluded.stage,
      crisis_type = excluded.crisis_type,
      period_start = excluded.period_start,
      period_end = excluded.period_end,
      updated_at = excluded.updated_at,
      data = excluded.data
  `;
  return record;
}

export async function deleteRecord(slug: string): Promise<void> {
  await ensureSchema();
  // review_slug isn't a foreign key (see the comment above the invites
  // section — a brand-new AAR can collect invites before it's ever been
  // saved), so deleting the review doesn't cascade automatically. Clean up
  // its invites explicitly instead of leaving them orphaned.
  await sql`DELETE FROM survey_invites WHERE review_slug = ${slug}`;
  await sql`DELETE FROM reviews WHERE slug = ${slug}`;
}

// --- Survey templates -------------------------------------------------

export async function listSurveyTemplates(): Promise<SurveyTemplateRecord[]> {
  await ensureSchema();
  const { rows } = await sql<{ data: SurveyTemplateRecord }>`
    SELECT data FROM survey_templates ORDER BY id
  `;
  return rows.map((row) => row.data);
}

export async function getSurveyTemplateById(
  id: string,
): Promise<SurveyTemplateRecord | undefined> {
  await ensureSchema();
  const { rows } = await sql<{ data: SurveyTemplateRecord }>`
    SELECT data FROM survey_templates WHERE id = ${id}
  `;
  return rows[0]?.data;
}

// --- Survey invites -----------------------------------------------------
// Kept in their own table, separate from the review's JSONB blob: invited
// people submit responses independently of whoever is editing the AAR
// itself, and normalizing this avoids one save clobbering another's
// answers the way a shared blob could. review_slug is a plain column, not
// a foreign key — a brand-new AAR can collect invites before it's ever
// been saved once.

type SurveyInviteRow = {
  id: string;
  review_slug: string;
  template_id: string;
  status: InviteStatus;
  created_at: string;
  sent_at: string | null;
  responded_at: string | null;
  data: {
    name: string;
    role: string;
    unit: string;
    undpOffice?: string;
    email: string;
    answers: Record<string, string> | null;
  };
};

function rowToInvite(row: SurveyInviteRow): SurveyInviteRecord {
  return {
    id: row.id,
    reviewSlug: row.review_slug,
    templateId: row.template_id,
    status: row.status,
    name: row.data.name,
    role: row.data.role,
    unit: row.data.unit,
    undpOffice: row.data.undpOffice ?? "",
    email: row.data.email,
    answers: row.data.answers,
    sentAt: row.sent_at,
    respondedAt: row.responded_at,
    createdAt: row.created_at,
  };
}

export async function listInvitesForReview(
  reviewSlug: string,
): Promise<SurveyInviteRecord[]> {
  await ensureSchema();
  const { rows } = await sql<SurveyInviteRow>`
    SELECT * FROM survey_invites WHERE review_slug = ${reviewSlug} ORDER BY created_at
  `;
  return rows.map(rowToInvite);
}

export async function getInviteById(
  id: string,
): Promise<SurveyInviteRecord | undefined> {
  await ensureSchema();
  const { rows } = await sql<SurveyInviteRow>`
    SELECT * FROM survey_invites WHERE id = ${id}
  `;
  return rows[0] ? rowToInvite(rows[0]) : undefined;
}

export async function createInvite(input: {
  reviewSlug: string;
  templateId: string;
  name: string;
  role: string;
  unit: string;
  undpOffice: string;
  email: string;
}): Promise<SurveyInviteRecord> {
  await ensureSchema();
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const data = {
    name: input.name,
    role: input.role,
    unit: input.unit,
    undpOffice: input.undpOffice,
    email: input.email,
    answers: null,
  };
  await sql`
    INSERT INTO survey_invites (id, review_slug, template_id, status, created_at, data)
    VALUES (${id}, ${input.reviewSlug}, ${input.templateId}, 'Draft', ${createdAt}, ${JSON.stringify(data)}::jsonb)
  `;
  return {
    id,
    reviewSlug: input.reviewSlug,
    templateId: input.templateId,
    status: "Draft",
    name: input.name,
    role: input.role,
    unit: input.unit,
    undpOffice: input.undpOffice,
    email: input.email,
    answers: null,
    sentAt: null,
    respondedAt: null,
    createdAt,
  };
}

export async function markInviteSent(
  id: string,
): Promise<SurveyInviteRecord | undefined> {
  await ensureSchema();
  const sentAt = new Date().toISOString();
  await sql`
    UPDATE survey_invites SET status = 'Sent', sent_at = ${sentAt}
    WHERE id = ${id} AND status = 'Draft'
  `;
  return getInviteById(id);
}

export async function submitInviteResponse(
  id: string,
  answers: Record<string, string>,
): Promise<SurveyInviteRecord | undefined> {
  await ensureSchema();
  const existing = await getInviteById(id);
  if (!existing) return undefined;
  const respondedAt = new Date().toISOString();
  const data = {
    name: existing.name,
    role: existing.role,
    unit: existing.unit,
    undpOffice: existing.undpOffice,
    email: existing.email,
    answers,
  };
  await sql`
    UPDATE survey_invites
    SET status = 'Responded', responded_at = ${respondedAt}, data = ${JSON.stringify(data)}::jsonb
    WHERE id = ${id}
  `;
  return getInviteById(id);
}

export async function deleteInvite(id: string): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM survey_invites WHERE id = ${id}`;
}
