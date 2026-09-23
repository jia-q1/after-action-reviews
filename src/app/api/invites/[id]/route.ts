import { NextResponse } from "next/server";
import { deleteInvite, markInviteSent } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const invite = await markInviteSent(id);
  if (!invite) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(invite);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await deleteInvite(id);
  return NextResponse.json({ ok: true });
}
