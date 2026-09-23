import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

// Mints short-lived, single-upload tokens for the browser to use with
// @vercel/blob/client's upload(); the file bytes go straight from the
// browser to Blob storage, never through this route (or any other
// Vercel Function), which is what avoids Vercel's 4.5MB request body
// limit for larger documents.
export async function POST(request: Request): Promise<NextResponse> {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        addRandomSuffix: true,
        maximumSizeInBytes: 100 * 1024 * 1024,
      }),
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 },
    );
  }
}
