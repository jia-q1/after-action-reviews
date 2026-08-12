import { NextResponse } from "next/server";
import { listSurveyTemplates } from "@/lib/db";

export async function GET() {
  return NextResponse.json(await listSurveyTemplates());
}
