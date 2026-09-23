import { NextResponse } from "next/server";
import {
  deleteRecord,
  getRecordBySlug,
  upsertRecord,
  type AarRecord,
} from "@/lib/db";
import { requireAuth } from "@/lib/auth";

// Loose sanity check on a PATCH body before it's trusted; this is not a
// full schema (see the input-validation TODO for that), just a guard
// against the worst mass-assignment case: a caller sending something that
// isn't recognizably an AarRecord at all (wrong shape, wrong types on the
// fields most likely to matter) and having it written straight to the DB.
function isPlausibleAarRecord(body: unknown): body is AarRecord {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.country === "string" &&
    typeof b.title === "string" &&
    typeof b.status === "string" &&
    Array.isArray(b.documents) &&
    Array.isArray(b.tags) &&
    typeof b.executiveSummary === "string"
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { slug } = await params;
  const record = await getRecordBySlug(slug);
  if (!record) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(record);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { slug } = await params;
  const body = await request.json();
  if (!isPlausibleAarRecord(body)) {
    return NextResponse.json({ error: "Malformed review record." }, { status: 400 });
  }
  const saved = await upsertRecord({ ...body, slug });
  return NextResponse.json(saved);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { slug } = await params;
  await deleteRecord(slug);
  return NextResponse.json({ ok: true });
}
