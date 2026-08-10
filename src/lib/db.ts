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
import { reviews as seedReviews, type Review } from "@/data/reviews";
import type { DocumentSource, SurveyInvite } from "@/lib/aar-store";

export type AarRecord = Review & {
  invites: SurveyInvite[];
  documents: DocumentSource[];
  notes: string;
  updatedAt: string;
};

declare global {
  var __aarSchemaReady: Promise<void> | undefined;
}

async function ensureSchema(): Promise<void> {
  if (!globalThis.__aarSchemaReady) {
    globalThis.__aarSchemaReady = (async () => {
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

      const { rows } = await sql<{ count: string }>`
        SELECT COUNT(*)::text AS count FROM reviews
      `;
      if (Number(rows[0].count) > 0) return;

      const now = new Date().toISOString();
      for (const review of seedReviews) {
        const record: AarRecord = {
          ...review,
          invites: [],
          documents: [],
          notes: "",
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
  await sql`DELETE FROM reviews WHERE slug = ${slug}`;
}
