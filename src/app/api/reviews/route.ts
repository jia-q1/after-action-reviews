import { NextResponse } from "next/server";
import { listRecords } from "@/lib/db";

export async function GET() {
  return NextResponse.json(await listRecords());
}
