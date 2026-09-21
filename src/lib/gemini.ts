import "server-only";
import { GoogleGenAI, Type } from "@google/genai";
import { responseAreas, priorityLevels } from "@/data/reviews";
import type { ReportDraft, DocumentSource, SurveyInvite, SurveyTemplate } from "@/lib/aar-store";
import type { TimelineEntry, FindingRow } from "@/data/reviews";

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

// Gemini can read these natively via inline data. Word/Excel/PowerPoint
// need text extraction first (mammoth / a spreadsheet parser) -- not
// wired up yet, so those documents are described by name only for now
// rather than silently dropped or crashing the request.
const NATIVELY_READABLE_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/csv",
  "text/markdown",
]);

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

  // Build the document parts: natively-readable files go in as inline
  // data; anything else (SharePoint-only, or an unsupported format) is
  // named in the prompt text instead so the model knows it exists but
  // can't read it, rather than the gap being invisible.
  const fileParts: { inlineData: { mimeType: string; data: string } }[] = [];
  const unreadableDocuments: string[] = [];
  for (const doc of input.documents) {
    const mimeType = doc.mimeType ?? "";
    if (doc.content && NATIVELY_READABLE_MIME_TYPES.has(mimeType)) {
      fileParts.push({ inlineData: { mimeType, data: doc.content } });
    } else {
      unreadableDocuments.push(doc.name);
    }
  }

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
