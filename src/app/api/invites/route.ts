import { NextResponse } from "next/server";
import { createInvite, listInvitesForReview } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(request: Request) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const reviewSlug = searchParams.get("reviewSlug");
  if (!reviewSlug) {
    return NextResponse.json({ error: "reviewSlug is required" }, { status: 400 });
  }
  return NextResponse.json(await listInvitesForReview(reviewSlug));
}

export async function POST(request: Request) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json()) as {
    reviewSlug: string;
    templateId: string;
    name: string;
    role: string;
    unit: string;
    undpOffice: string;
    email: string;
  };
  if (!body.reviewSlug || !body.templateId || !body.name || !body.email) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  const invite = await createInvite(body);
  return NextResponse.json(invite, { status: 201 });
}
