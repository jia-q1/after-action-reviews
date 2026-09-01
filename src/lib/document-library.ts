// Uploads/deletes AAR source-document files to a SharePoint Document
// Library, reached through a single Power Automate HTTP-triggered flow
// (POWER_AUTOMATE_DOCUMENTS_URL) that branches internally on an
// `operation` field -- same signed-URL auth model as
// src/lib/power-automate.ts (no Azure AD app registration on our side).
// Only the file bytes move here; which documents are attached to an AAR
// is still tracked in the review's own record (see DocumentSource in
// aar-store.ts), same as before.
//
// If this env var isn't set, callers fall back to storing the file
// inline (the original behavior) -- see the POST handler in
// src/app/api/documents/route.ts -- so this only takes effect once the
// SharePoint library and flow exist and are wired up.

export function isDocumentLibraryConfigured(): boolean {
  return Boolean(process.env.POWER_AUTOMATE_DOCUMENTS_URL);
}

export async function uploadDocumentToLibrary(input: {
  reviewSlug: string;
  fileName: string;
  mimeType?: string;
  contentBase64: string;
  dataCollectionMethod?: string;
}): Promise<
  | { ok: true; sharepointId: string; sharepointUrl?: string }
  | { ok: false; error: string }
> {
  const flowUrl = process.env.POWER_AUTOMATE_DOCUMENTS_URL;
  if (!flowUrl) {
    return { ok: false, error: "Document library isn't configured." };
  }

  try {
    const res = await fetch(flowUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation: "upload", ...input }),
    });
    if (!res.ok) {
      return { ok: false, error: `Flow responded with ${res.status}` };
    }
    const body = (await res.json()) as { id: string; url?: string };
    return { ok: true, sharepointId: body.id, sharepointUrl: body.url };
  } catch {
    return { ok: false, error: "Could not reach the document upload flow." };
  }
}

export async function deleteDocumentFromLibrary(
  sharepointId: string,
): Promise<boolean> {
  const flowUrl = process.env.POWER_AUTOMATE_DOCUMENTS_URL;
  if (!flowUrl) return false;

  try {
    const res = await fetch(flowUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation: "delete", id: sharepointId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
