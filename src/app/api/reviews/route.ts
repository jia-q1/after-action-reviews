import { NextResponse } from "next/server";
import { listRecords } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await listRecords());
}
