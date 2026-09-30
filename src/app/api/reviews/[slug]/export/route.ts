import { NextResponse } from "next/server";
import { getRecordBySlug } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { buildAarDocx } from "@/lib/docx-export";

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

  const buffer = await buildAarDocx(record);
  const filename = `${record.slug}.docx`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
