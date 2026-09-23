import { del } from "@vercel/blob";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export async function POST(request: Request) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { url } = (await request.json()) as { url?: string };
  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }
  await del(url);
  return NextResponse.json({ ok: true });
}
