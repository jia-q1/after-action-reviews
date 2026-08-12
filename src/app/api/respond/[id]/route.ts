import { NextResponse } from "next/server";
import { submitInviteResponse } from "@/lib/db";

// Public endpoint — no auth. The invite id itself (an unguessable UUID) is
// the access control, same pattern as most "fill out this form" links.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json()) as { answers: Record<string, string> };
  const invite = await submitInviteResponse(id, body.answers ?? {});
  if (!invite) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(invite);
}
