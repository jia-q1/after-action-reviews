import { NextResponse } from "next/server";
import { getInviteById, markInviteSent } from "@/lib/db";
import { sendInviteEmail } from "@/lib/power-automate";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { surveyLink, aarTitle } = (await request.json()) as {
    surveyLink: string;
    aarTitle: string;
  };

  const invite = await getInviteById(id);
  if (!invite) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const result = await sendInviteEmail({
    recipientEmail: invite.email,
    recipientName: invite.name,
    recipientRole: invite.role,
    aarTitle,
    surveyLink,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  const updated = await markInviteSent(id);
  return NextResponse.json(updated);
}
