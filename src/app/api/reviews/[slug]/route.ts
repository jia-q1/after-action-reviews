import { NextResponse } from "next/server";
import {
  deleteRecord,
  getRecordBySlug,
  upsertRecord,
  type AarRecord,
} from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const record = getRecordBySlug(slug);
  if (!record) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(record);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const body = (await request.json()) as AarRecord;
  const saved = upsertRecord({ ...body, slug });
  return NextResponse.json(saved);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  deleteRecord(slug);
  return NextResponse.json({ ok: true });
}
