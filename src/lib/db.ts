// Server-only SQLite persistence. This is what makes AARs real and shared:
// one file on disk instead of a static array + one browser's local storage.
// Every visitor hitting the same running server (e.g. your local `npm run
// dev`, or a traditional always-on Node host) sees and edits the same data.
//
// Caveat: on Vercel's serverless functions, the filesystem is ephemeral and
// not guaranteed to persist across invocations or be shared between
// concurrent instances. This file is written so swapping the storage
// backend (e.g. to Vercel Postgres) later only touches this module — but
// as deployed today on Vercel, do not expect writes here to reliably
// survive or be shared across requests. Locally, it's fully real.

import "server-only";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { reviews as seedReviews, type Review } from "@/data/reviews";
import type { DocumentSource, SurveyInvite } from "@/lib/aar-store";

export type AarRecord = Review & {
  invites: SurveyInvite[];
  documents: DocumentSource[];
  notes: string;
  updatedAt: string;
};

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "aar.db");

declare global {
  var __aarDb: Database.Database | undefined;
}

type ReviewRow = { data: string };

function seedIfEmpty(db: Database.Database) {
  const { count } = db
    .prepare("SELECT COUNT(*) as count FROM reviews")
    .get() as { count: number };
  if (count > 0) return;

  const insert = db.prepare(
    `INSERT INTO reviews (slug, status, stage, crisis_type, period_start, period_end, updated_at, data)
     VALUES (@slug, @status, @stage, @crisisType, @periodStart, @periodEnd, @updatedAt, @data)`,
  );
  const now = new Date().toISOString();
  const insertAll = db.transaction((records: AarRecord[]) => {
    for (const record of records) {
      insert.run({
        slug: record.slug,
        status: record.status,
        stage: record.stage ?? null,
        crisisType: record.crisisType,
        periodStart: record.periodStart,
        periodEnd: record.periodEnd,
        updatedAt: record.updatedAt,
        data: JSON.stringify(record),
      });
    }
  });
  insertAll(
    seedReviews.map((review) => ({
      ...review,
      invites: [],
      documents: [],
      notes: "",
      updatedAt: now,
    })),
  );
}

function getDb(): Database.Database {
  if (globalThis.__aarDb) return globalThis.__aarDb;

  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS reviews (
      slug TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      stage TEXT,
      crisis_type TEXT NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      data TEXT NOT NULL
    );
  `);
  seedIfEmpty(db);

  globalThis.__aarDb = db;
  return db;
}

function rowToRecord(row: ReviewRow): AarRecord {
  return JSON.parse(row.data) as AarRecord;
}

export function listRecords(): AarRecord[] {
  const rows = getDb()
    .prepare("SELECT data FROM reviews ORDER BY updated_at DESC")
    .all() as ReviewRow[];
  return rows.map(rowToRecord);
}

export function getRecordBySlug(slug: string): AarRecord | undefined {
  const row = getDb()
    .prepare("SELECT data FROM reviews WHERE slug = ?")
    .get(slug) as ReviewRow | undefined;
  return row ? rowToRecord(row) : undefined;
}

export function upsertRecord(record: AarRecord): AarRecord {
  getDb()
    .prepare(
      `INSERT INTO reviews (slug, status, stage, crisis_type, period_start, period_end, updated_at, data)
       VALUES (@slug, @status, @stage, @crisisType, @periodStart, @periodEnd, @updatedAt, @data)
       ON CONFLICT(slug) DO UPDATE SET
         status = excluded.status,
         stage = excluded.stage,
         crisis_type = excluded.crisis_type,
         period_start = excluded.period_start,
         period_end = excluded.period_end,
         updated_at = excluded.updated_at,
         data = excluded.data`,
    )
    .run({
      slug: record.slug,
      status: record.status,
      stage: record.stage ?? null,
      crisisType: record.crisisType,
      periodStart: record.periodStart,
      periodEnd: record.periodEnd,
      updatedAt: record.updatedAt,
      data: JSON.stringify(record),
    });
  return record;
}

export function deleteRecord(slug: string) {
  getDb().prepare("DELETE FROM reviews WHERE slug = ?").run(slug);
}
