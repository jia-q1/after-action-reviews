import "server-only";
import { GoogleGenAI, Type } from "@google/genai";
import { get as getBlob } from "@vercel/blob";
import { responseAreas, priorityLevels } from "@/data/reviews";
import type { ReportDraft, DocumentSource, SurveyInvite, SurveyTemplate } from "@/lib/aar-store";
import type { TimelineEntry, FindingRow } from "@/data/reviews";
import { EXTRACTABLE_MIME_TYPES, extractDocumentText } from "@/lib/document-extraction";

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

// Documents attached before Blob storage existed (or synced from
// SharePoint) still carry base64 content inline; larger ones uploaded
// since live in Blob storage instead, with only a URL on the record.
// This resolves either into one in-memory Buffer so the rest of the
// pipeline doesn't need to care which. Returns null for a document this
// server genuinely can't read (SharePoint-only, with no way for us to
// authenticate back to it).
async function resolveDocumentBuffer(doc: DocumentSource): Promise<Buffer | null> {
  if (doc.content) {
    return Buffer.from(doc.content, "base64");
  }
  if (doc.blobUrl) {
    try {
      const result = await getBlob(doc.blobUrl, { access: "private" });
      if (!result) return null;
      return Buffer.from(await new Response(result.stream).arrayBuffer());
    } catch {
      return null;
    }
  }
  return null;
}

// Plain text formats are just folded into the prompt text directly (no
// reason to round-trip them through the Files API). PDF is the one
// binary format Gemini reads natively -- it goes through the Files API
// (uploaded once, referenced by URI) rather than inline base64, so
// attaching several large PDFs doesn't blow past the inline request-size
// ceiling the way it used to.
const INLINE_TEXT_MIME_TYPES = new Set(["text/plain", "text/csv", "text/markdown"]);
const FILE_API_MIME_TYPES = new Set(["application/pdf"]);

async function uploadAndWaitForActive(
  ai: GoogleGenAI,
  input: { mimeType: string; buffer: Buffer; displayName: string },
): Promise<{ fileUri: string; mimeType: string }> {
  const blob = new Blob([new Uint8Array(input.buffer)], { type: input.mimeType });

  // Upload is the most network-heavy step here (bigger files = more time
  // for a transient blip), so it gets one retry rather than failing the
  // whole document on the first hiccup.
  let uploaded;
  try {
    uploaded = await ai.files.upload({
      file: blob,
      config: { mimeType: input.mimeType, displayName: input.displayName },
    });
  } catch {
    uploaded = await ai.files.upload({
      file: blob,
      config: { mimeType: input.mimeType, displayName: input.displayName },
    });
  }

  let file = uploaded;
  const deadline = Date.now() + 60_000;
  while (file.state === "PROCESSING" && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    if (!file.name) break;
    file = await ai.files.get({ name: file.name });
  }
  if (file.state !== "ACTIVE" || !file.uri) {
    throw new Error(`File "${input.displayName}" did not finish processing (state: ${file.state}).`);
  }
  return { fileUri: file.uri, mimeType: file.mimeType ?? input.mimeType };
}

const DRAFT_FIELDS: (keyof ReportDraft)[] = [
  "executiveSummary",
  "countrySituation",
  "objectives",
  "scope",
  "dataCollection",
  "contextualFactors",
  "inCountryStructure",
  "corporateResponseMechanisms",
  "deploymentOfExperts",
  "programmaticResponse",
  "operationalResponse",
  "coordination",
  "communicationAndResourceMobilization",
];

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    executiveSummary: { type: Type.STRING },
    countrySituation: { type: Type.STRING },
    objectives: { type: Type.STRING },
    scope: { type: Type.STRING },
    dataCollection: { type: Type.STRING },
    contextualFactors: { type: Type.STRING },
    inCountryStructure: { type: Type.STRING },
    corporateResponseMechanisms: { type: Type.STRING },
    deploymentOfExperts: { type: Type.STRING },
    programmaticResponse: { type: Type.STRING },
    operationalResponse: { type: Type.STRING },
    coordination: { type: Type.STRING },
    communicationAndResourceMobilization: { type: Type.STRING },
    timeline: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          date: { type: Type.STRING, description: "YYYY-MM-DD, or as precise as the sources allow" },
          event: { type: Type.STRING },
        },
        required: ["date", "event"],
      },
    },
    findingsMatrix: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          responseArea: { type: Type.STRING, enum: [...responseAreas] },
          finding: { type: Type.STRING },
          recommendation: { type: Type.STRING },
          keyActions: { type: Type.STRING },
          priority: { type: Type.STRING, enum: [...priorityLevels] },
        },
        required: ["responseArea", "finding", "recommendation", "keyActions", "priority"],
      },
    },
  },
  required: [...DRAFT_FIELDS, "timeline", "findingsMatrix"],
};

export type GeneratedDraft = ReportDraft & {
  timeline: TimelineEntry[];
  findingsMatrix: FindingRow[];
};

export type GenerateDraftResult =
  | { ok: true; draft: GeneratedDraft; unreadableDocuments: string[] }
  | { ok: false; error: string };

export async function generateDraft(input: {
  overview: {
    country: string;
    crisisName?: string;
    crisisType: string;
    periodStart: string;
    periodEnd: string;
    office: string;
  };
  documents: DocumentSource[];
  notes: string;
  prompt: string;
  invites: SurveyInvite[];
  templates: SurveyTemplate[];
}): Promise<GenerateDraftResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "Gemini isn't configured (GEMINI_API_KEY is unset)." };
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";

  // Build the document inputs in parallel: PDFs go through the Files API
  // (referenced by URI, not inlined -- keeps the actual generateContent
  // request small regardless of how large or how many PDFs are
  // attached); plain text is folded straight into the prompt; Word/
  // Excel/PowerPoint get their text extracted first. Anything else
  // (SharePoint-only documents with no content, an unsupported format,
  // or a file that fails to process) is named in the prompt so the model
  // knows it exists but can't read it, rather than the gap being
  // invisible or the whole request failing over one bad document.
  const fileParts: { fileData: { fileUri: string; mimeType: string } }[] = [];
  const extractedTextBlocks: string[] = [];
  const unreadableDocuments: string[] = [];

  await Promise.all(
    input.documents.map(async (doc) => {
      const mimeType = doc.mimeType ?? "";
      const buffer = await resolveDocumentBuffer(doc);
      if (!buffer) {
        unreadableDocuments.push(doc.name);
        return;
      }
      try {
        if (FILE_API_MIME_TYPES.has(mimeType)) {
          const uploaded = await uploadAndWaitForActive(ai, {
            mimeType,
            buffer,
            displayName: doc.name,
          });
          fileParts.push({ fileData: uploaded });
        } else if (INLINE_TEXT_MIME_TYPES.has(mimeType)) {
          const text = buffer.toString("utf-8");
          extractedTextBlocks.push(`--- Document: ${doc.name} ---\n${text}`);
        } else if (EXTRACTABLE_MIME_TYPES.has(mimeType)) {
          const text = await extractDocumentText(mimeType, buffer);
          if (text?.trim()) {
            extractedTextBlocks.push(`--- Document: ${doc.name} ---\n${text}`);
          } else {
            unreadableDocuments.push(doc.name);
          }
        } else {
          unreadableDocuments.push(doc.name);
        }
      } catch (err) {
        console.error(`generateDraft: failed to process document "${doc.name}"`, err);
        unreadableDocuments.push(doc.name);
      }
    }),
  );

  const respondedInvites = input.invites.filter(
    (i) => i.status === "Responded" && i.answers,
  );
  const surveySections = respondedInvites.map((invite) => {
    const template = input.templates.find((t) => t.id === invite.templateId);
    const qa = template
      ? template.questions
          .map((q) => {
            const answer = invite.answers?.[q.id]?.trim();
            return answer ? `Q: ${q.text}\nA: ${answer}` : null;
          })
          .filter(Boolean)
          .join("\n\n")
      : "";
    return `--- Survey response: ${invite.name} (${invite.role || "role not given"}, ${invite.unit || "unit not given"}) ---\n${qa}`;
  });

  const contextText = [
    `AAR overview: country=${input.overview.country || "unspecified"}; crisis=${input.overview.crisisName || "unspecified"}; type=${input.overview.crisisType}; period=${input.overview.periodStart} to ${input.overview.periodEnd}; office=${input.overview.office || "unspecified"}.`,
    input.notes.trim() ? `Notes from the reviewer:\n${input.notes.trim()}` : "",
    unreadableDocuments.length > 0
      ? `Note: the following attached documents could not be read by you (unsupported format or stored externally) -- do not fabricate their content, just be aware they exist and may need manual review: ${unreadableDocuments.join(", ")}.`
      : "",
    extractedTextBlocks.length > 0
      ? `Extracted document text:\n\n${extractedTextBlocks.join("\n\n")}`
      : "",
    surveySections.length > 0
      ? `Survey responses collected:\n\n${surveySections.join("\n\n")}`
      : "No survey responses have been collected yet.",
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [{ text: contextText }, ...fileParts],
        },
      ],
      config: {
        systemInstruction: input.prompt,
        responseMimeType: "application/json",
        responseSchema,
      },
    });

    const text = response.text;
    if (!text) {
      return { ok: false, error: "Gemini returned an empty response." };
    }

    const parsed = JSON.parse(text) as GeneratedDraft;
    return { ok: true, draft: parsed, unreadableDocuments };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
