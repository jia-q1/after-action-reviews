import { NextResponse } from "next/server";
import {
  isDocumentLibraryConfigured,
  uploadDocumentToLibrary,
} from "@/lib/document-library";

// Approximate decoded byte size of a base64 string, for the size shown in
// the UI -- doesn't need to be exact.
function base64ByteSize(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

export async function POST(request: Request) {
  const body = await request.json();
  const { reviewSlug, fileName, mimeType, contentBase64, dataCollectionMethod } =
    body as {
      reviewSlug?: string;
      fileName?: string;
      mimeType?: string;
      contentBase64?: string;
      dataCollectionMethod?: string;
    };

  if (!fileName || !contentBase64) {
    return NextResponse.json({ error: "Missing file data." }, { status: 400 });
  }

  const size = base64ByteSize(contentBase64);

  if (isDocumentLibraryConfigured()) {
    const result = await uploadDocumentToLibrary({
      reviewSlug: reviewSlug ?? "",
      fileName,
      mimeType,
      contentBase64,
      dataCollectionMethod,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }
    return NextResponse.json({
      id: crypto.randomUUID(),
      name: fileName,
      size,
      mimeType,
      dataCollectionMethod,
      sharepointId: result.sharepointId,
      sharepointUrl: result.sharepointUrl,
    });
  }

  // Fallback: store the file inline on the review record, exactly as
  // before the document library existed.
  return NextResponse.json({
    id: crypto.randomUUID(),
    name: fileName,
    size,
    mimeType,
    content: contentBase64,
    dataCollectionMethod,
  });
}
