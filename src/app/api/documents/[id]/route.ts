import { NextResponse } from "next/server";
import {
  deleteDocumentFromLibrary,
  isDocumentLibraryConfigured,
} from "@/lib/document-library";
import { requireAuth } from "@/lib/auth";

// `id` here is the document's sharepointId -- there's nothing to delete
// server-side for inline (fallback) documents, since those only ever live
// inside the review's own JSONB record and are removed by that record's
// next save.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (isDocumentLibraryConfigured()) {
    await deleteDocumentFromLibrary(id);
  }
  return NextResponse.json({ ok: true });
}
