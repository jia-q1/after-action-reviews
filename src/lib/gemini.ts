import "server-only";
import { GoogleGenAI, Type } from "@google/genai";
import { get as getBlob } from "@vercel/blob";
import { responseAreas, priorityLevels, recommendationOwners } from "@/data/reviews";
import type { ReportDraft, DocumentSource, SurveyInvite, SurveyTemplate } from "@/lib/aar-store";
import type {
  TimelineEntry,
  FindingRow,
  ReviewerFlag,
  ReviewerFlagType,
  SurveyRating,
} from "@/data/reviews";
import {
  EXTRACTABLE_MIME_TYPES,
  extractDocumentText,
  extractPdfText,
} from "@/lib/document-extraction";
import { extractSurveyRatings, runDraftChecks } from "@/lib/draft-checks";

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

const SOURCES_FIELD = {
  type: Type.ARRAY,
  items: { type: Type.STRING },
  description: "Labels of the sources this is based on, exactly as given in the input",
};

// "wording" flags only ever come from the automated check -- the model
// isn't asked to police its own tone after the fact.
const AI_FLAG_TYPES: ReviewerFlagType[] = [
  "conflict",
  "single-source",
  "thin-evidence",
  "unsupported",
  "omitted",
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
          sources: SOURCES_FIELD,
        },
        required: ["date", "event", "sources"],
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
          owner: {
            type: Type.STRING,
            enum: [...recommendationOwners],
            description: "The part of the organization best placed to act on the recommendation",
          },
          sources: SOURCES_FIELD,
        },
        required: ["responseArea", "finding", "recommendation", "keyActions", "priority", "owner", "sources"],
      },
    },
    reviewerFlags: {
      type: Type.ARRAY,
      description: "Issues the human reviewer must resolve before the final draft. Never part of the report text.",
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, enum: [...AI_FLAG_TYPES] },
          section: { type: Type.STRING, description: "The report section affected, e.g. \"3.5 Deployment of experts\"" },
          description: { type: Type.STRING },
          sources: SOURCES_FIELD,
        },
        required: ["type", "section", "description", "sources"],
      },
    },
  },
  required: [...DRAFT_FIELDS, "timeline", "findingsMatrix", "reviewerFlags"],
};

type ModelOutput = ReportDraft & {
  timeline: TimelineEntry[];
  findingsMatrix: FindingRow[];
  reviewerFlags: Pick<ReviewerFlag, "type" | "section" | "description" | "sources">[];
};

export type GeneratedDraft = ReportDraft & {
  timeline: TimelineEntry[];
  findingsMatrix: FindingRow[];
  reviewerFlags: ReviewerFlag[];
  surveyRatings: SurveyRating[];
};

export type GenerateDraftResult =
  | { ok: true; draft: GeneratedDraft; unreadableDocuments: string[] }
  | { ok: false; error: string };

// Rules tied to the output format and the review workflow, appended after
// the (user-editable, per-AAR) prompt rather than written into it: they
// have to hold for every AAR, including ones whose saved prompt predates
// them, and editing the prompt shouldn't be able to switch them off.
const DRAFTING_RULES = `Rules that always apply to this draft, in addition to the instructions above:

SOURCES
- Each source is introduced by a line of the form "--- Source: <label> ---". Use those labels exactly, and only those labels, in every "sources" field.
- Every timeline entry and every findings matrix row must list the sources that support it.
- Only state a figure, amount, percentage, count or date if it appears in a source. Do not round, convert, combine or estimate figures into new ones. If you're unsure of a figure, leave it out and add a reviewer flag.

DISAGREEMENTS AND WEAK EVIDENCE
- When sources disagree about the same fact or explanation (a date, an amount, who caused a delay), do not merge them into one neutral account and do not pick a side. Present each view in the text, attributed to its source (e.g. "The Crisis Bureau respondent attributed the delay to ...; the SURGE adviser attributed it to ..."), and add a "conflict" reviewer flag.
- When two sources give different dates for the same event, write ONE timeline entry, mention both dates in the event text, and add a "conflict" reviewer flag. Do not list it as two separate events.
- A claim that comes from a single respondent must be attributed in the text ("One respondent reported ...", "The Operations Manager noted ..."), not stated as established fact.

NEUTRAL LANGUAGE
- Describe what happened; do not label or judge it. Do not add intensifiers or characterizations ("severe", "severely", "violating", "failure", "burnout", "critical") unless a source uses that wording.
- Call a target a target and a deadline a deadline. Do not upgrade an action point agreed in a meeting into a "mandate", "rule" or "requirement".
- Examples:
  - Source: Crisis Board action point "BMS to ensure funds are available in the system within 48 hours"; funds loaded 19 March, five days after approval. Not: "BMS violated the 48-hour mandate." Instead: "Funds were loaded on 19 March, five days after approval, against a 48-hour target set by the Crisis Board."
  - Source: staff worked 12-hour days for about two months without rotation; two took sick leave. Not: "severe burnout". Instead: "Staff worked 12-hour days for about two months without rotation; two took sick leave."
  - Source: SURGE adviser said the remote period "did not work well" because colleagues couldn't reach them. Not: "severely diminished field responsiveness". Instead: "The adviser reported that the switch to remote support reduced their availability to field colleagues."

COVERAGE
- Some invited respondents may not have answered (listed under "Invited but did not respond"). Say so in the data collection section, and don't present the views of those who did answer as the full picture for areas the missing respondents would have covered.
- Leave out points that aren't about the crisis response itself (e.g. general office complaints like old equipment or parking), even if a respondent raised them. If you're unsure whether something is relevant, leave it out of the report and add an "omitted" reviewer flag instead.
- Gender is its own response area: put gender findings in their own findings matrix row(s) with responseArea "Gender", including any gender-based violence or protection risks respondents raised and whether they were followed up.
- Where a respondent chose a rating on a scale (e.g. "Limited Integrated", "Somewhat Ineffective"), report that rating in the relevant section, attributed.
- Every findings matrix row needs an "owner": whoever is best placed to act on the recommendation. Where respondents named who should act, use that.

REVIEWER FLAGS
- Use "reviewerFlags" for anything the human reviewer must check before the final draft:
  - "conflict": sources disagree. Say what each source says, e.g. "The Crisis Bureau respondent says the CO requested SURGE late; the SURGE adviser says HQ approval was slow. Resolve before the final draft (this could be a factual error or a difference of opinion)."
  - "single-source": an important claim in the section text rests on one source. (Findings matrix rows are checked for this automatically; don't flag them.)
  - "thin-evidence": a section has little or no evidence behind it.
  - "unsupported": a figure or date you included but couldn't confirm in a source.
  - "omitted": a point a respondent raised that you couldn't fit into the draft.
- Flags are notes to the reviewer only. Never mention them in the report text.

FINAL CHECK
- Before answering, re-read every number and date in your draft and confirm it appears in a source. Remove any that don't, or keep them and add an "unsupported" flag.`;

// Spotting disagreements between sources is the one thing the drafting
// request did unreliably (in testing it caught a planted date conflict in
// only 2 of 3 runs) -- it's one instruction among many there. This is a
// separate request whose only job is that comparison.
const REPORT_SECTIONS = [
  "Executive Summary",
  "1.1 Country situation",
  "3.1 Contextual factors",
  "3.2 Timeline",
  "3.3 In-country structure",
  "3.4 Corporate response mechanisms",
  "3.5 Deployment of experts",
  "3.6 Programmatic response",
  "3.7 Operational response",
  "3.8 Coordination",
  "3.9 Communication and resource mobilization",
  "Gender",
] as const;

const CONFLICT_CHECK_PROMPT =`You are checking the source material for an After Action Review (AAR) before a report is drafted from it. Your only task is to find places where two or more sources DISAGREE about the same thing. Do not summarize the sources and do not draft anything.

Each source is introduced by a line of the form "--- Source: <label> ---". Compare every source against every other source, and look in particular for:
- Different dates for the same event or decision (e.g. one document says something was approved on 12 March, another says 14 March).
- Different amounts, counts, durations or percentages for the same thing.
- Different explanations of the same outcome, especially who or what caused a delay or problem (e.g. one respondent blames the Country Office, another blames HQ). Compare survey respondents against each other carefully: respondents from different units (Country Office, Crisis Bureau, SURGE advisers, HQ) often explain the same delay differently, and each blames someone else. That counts as a disagreement even if both accounts could be partly true.
- Opposite assessments of the same thing (e.g. one respondent calls a mechanism effective, another calls it ineffective).

For each disagreement, say what each source says, quoting or closely paraphrasing it, and name the sources using their labels exactly. Write it as a note to the human reviewer, ending with "Resolve before the final draft." Also give the report section it most affects.

Do NOT report:
- Sources that simply give different levels of detail, or where one source mentions something another doesn't.
- Differences in wording that mean the same thing.

If there are no disagreements, return an empty list.`;

const conflictSchema = {
  type: Type.OBJECT,
  properties: {
    conflicts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          section: {
            type: Type.STRING,
            enum: [...REPORT_SECTIONS],
            description: "The report section most affected",
          },
          description: { type: Type.STRING },
          sources: SOURCES_FIELD,
        },
        required: ["section", "description", "sources"],
      },
    },
  },
  required: ["conflicts"],
};

function surveyLabel(invite: SurveyInvite, role: string): string {
  return `Survey: ${invite.name}, ${role} (unit: ${invite.unit || "not given"})`;
}

// Maps a source the model cited back to the exact label it was given:
// exact match first, then ignoring the "Document:"/"Survey:" prefix and
// case, then by containment either way (a trimmed or truncated label).
// Anything unrecognizable is kept as written.
function canonicalSource(cited: string, labels: string[]): string {
  if (labels.includes(cited)) return cited;
  const norm = (s: string) =>
    s.replace(/^\s*(document|survey)\s*:\s*/i, "").trim().toLowerCase();
  const c = norm(cited);
  if (!c) return cited;
  return (
    labels.find((l) => norm(l) === c) ??
    labels.find((l) => norm(l).startsWith(c) || c.startsWith(norm(l))) ??
    labels.find((l) => norm(l).includes(c)) ??
    cited
  );
}

// Two conflict flags are the same issue when they cite at least two of
// the same sources -- used to drop the draft's copy of a conflict the
// dedicated check also found.
function sameConflict(a: { sources: string[] }, b: { sources: string[] }): boolean {
  return a.sources.filter((s) => b.sources.includes(s)).length >= 2;
}

// Returns null (not an empty list) when the check itself fails, so the
// caller can tell "no conflicts found" apart from "didn't get to look".
async function findSourceConflicts(
  ai: GoogleGenAI,
  model: string,
  contents: { role: string; parts: object[] }[],
): Promise<Omit<ReviewerFlag, "id" | "resolved">[] | null> {
  try {
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction: CONFLICT_CHECK_PROMPT,
        responseMimeType: "application/json",
        responseSchema: conflictSchema,
      },
    });
    if (!response.text) return null;
    const { conflicts } = JSON.parse(response.text) as {
      conflicts: { section: string; description: string; sources: string[] }[];
    };
    return (conflicts ?? []).map((c) => ({
      type: "conflict" as const,
      section: c.section,
      description: c.description,
      sources: c.sources ?? [],
      origin: "ai" as const,
    }));
  } catch (err) {
    console.error("generateDraft: source conflict check failed", err);
    return null;
  }
}

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
  //
  // Every source gets a "--- Source: <label> ---" header (PDFs included,
  // as a text part right before the file) so the model can cite it by
  // label in its "sources" fields.
  const fileParts: (
    | { text: string }
    | { fileData: { fileUri: string; mimeType: string } }
  )[] = [];
  // PDF text is extracted separately just for the post-generation checks
  // (the model reads the PDF itself). PDFs it can't get text out of are
  // listed so the checks can say they couldn't search them.
  const pdfTexts: string[] = [];
  const unsearchablePdfs: string[] = [];
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
          const [uploaded, pdfText] = await Promise.all([
            uploadAndWaitForActive(ai, { mimeType, buffer, displayName: doc.name }),
            extractPdfText(buffer).catch(() => ""),
          ]);
          fileParts.push(
            { text: `--- Source: Document: ${doc.name} (attached PDF follows) ---` },
            { fileData: uploaded },
          );
          if (pdfText) pdfTexts.push(pdfText);
          else unsearchablePdfs.push(doc.name);
        } else if (INLINE_TEXT_MIME_TYPES.has(mimeType)) {
          const text = buffer.toString("utf-8");
          extractedTextBlocks.push(`--- Source: Document: ${doc.name} ---\n${text}`);
        } else if (EXTRACTABLE_MIME_TYPES.has(mimeType)) {
          const text = await extractDocumentText(mimeType, buffer);
          if (text?.trim()) {
            extractedTextBlocks.push(`--- Source: Document: ${doc.name} ---\n${text}`);
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
  const surveyResponses = respondedInvites.map((invite) => {
    const template = input.templates.find((t) => t.id === invite.templateId);
    const questions = (template?.questions ?? [])
      .map((q) => ({ text: q.text, answer: invite.answers?.[q.id]?.trim() ?? "" }))
      .filter((q) => q.answer);
    const role = invite.role || template?.name || invite.unit || "role not given";
    return { invite, role, questions };
  });
  // Who was invited but never answered -- named in the prompt so the model
  // can say whose perspective is missing, and flagged for the reviewer.
  const nonResponders = input.invites
    .filter((i) => !(i.status === "Responded" && i.answers))
    .map((invite) => {
      const template = input.templates.find((t) => t.id === invite.templateId);
      return `${invite.role || template?.name || "role not given"} (${template?.name ?? (invite.unit || "unit not given")})`;
    });
  const surveySections = surveyResponses.map(({ invite, role, questions }) => {
    const qa = questions.map((q) => `Q: ${q.text}\nA: ${q.answer}`).join("\n\n");
    return `--- Source: ${surveyLabel(invite, role)} ---\n${qa}`;
  });

  // Every label the model was given, for mapping its citations back to
  // them (it sometimes drops the "Document: " prefix or trims a label).
  const sourceLabels = [
    ...input.documents.map((doc) => `Document: ${doc.name}`),
    ...surveyResponses.map(({ invite, role }) => surveyLabel(invite, role)),
    "Reviewer notes",
  ];
  const canonical = (sources: string[] | undefined) =>
    (sources ?? []).map((s) => canonicalSource(s, sourceLabels));

  const notes = input.notes.trim();
  const contextText = [
    `AAR overview: country=${input.overview.country || "unspecified"}; crisis=${input.overview.crisisName || "unspecified"}; type=${input.overview.crisisType}; period=${input.overview.periodStart} to ${input.overview.periodEnd}; office=${input.overview.office || "unspecified"}.`,
    notes ? `--- Source: Reviewer notes ---\n${notes}` : "",
    unreadableDocuments.length > 0
      ? `Note: the following attached documents could not be read by you (unsupported format or stored externally) -- do not fabricate their content, just be aware they exist and may need manual review: ${unreadableDocuments.join(", ")}.`
      : "",
    extractedTextBlocks.length > 0
      ? `Extracted document text:\n\n${extractedTextBlocks.join("\n\n")}`
      : "",
    surveySections.length > 0
      ? `Survey responses collected:\n\n${surveySections.join("\n\n")}`
      : "No survey responses have been collected yet.",
    nonResponders.length > 0
      ? `Invited but did not respond (${nonResponders.length} of ${input.invites.length}): ${nonResponders.join("; ")}.`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const contents = [
    {
      role: "user",
      parts: [{ text: contextText }, ...fileParts],
    },
  ];

  try {
    // The conflict check runs alongside the draft rather than after it (it
    // only needs the sources, not the draft), so it adds cost but not wait.
    const [response, rawSourceConflicts] = await Promise.all([
      ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: `${input.prompt}\n\n${DRAFTING_RULES}`,
          responseMimeType: "application/json",
          responseSchema,
        },
      }),
      findSourceConflicts(ai, model, contents),
    ]);

    const text = response.text;
    if (!text) {
      return { ok: false, error: "Gemini returned an empty response." };
    }

    const { reviewerFlags: rawAiFlags, ...parsed } = JSON.parse(text) as ModelOutput;
    const timeline = (parsed.timeline ?? []).map((e) => ({ ...e, sources: canonical(e.sources) }));
    const findingsMatrix = (parsed.findingsMatrix ?? []).map((r) => ({
      ...r,
      sources: canonical(r.sources),
    }));
    const aiFlags = (rawAiFlags ?? []).map((f) => ({ ...f, sources: canonical(f.sources) }));
    const sourceConflicts = rawSourceConflicts?.map((f) => ({ ...f, sources: canonical(f.sources) })) ?? null;

    const checkFlags = runDraftChecks({
      draft: parsed,
      timeline,
      findingsMatrix,
      sourceText: [
        notes,
        ...extractedTextBlocks,
        ...pdfTexts,
        ...surveyResponses.flatMap((r) => r.questions.map((q) => `${q.text}\n${q.answer}`)),
      ].join("\n\n"),
      unsearchedSources: unsearchablePdfs,
    });
    // Neither the dedicated conflict check nor the draft's own conflict
    // flags catch everything (in testing each missed a planted conflict
    // the other found), so both are kept, minus the draft's copies of
    // conflicts the check already reported.
    const draftFlags = aiFlags.filter(
      (flag) =>
        flag.type !== "conflict" ||
        !(sourceConflicts ?? []).some((c) => sameConflict(c, flag)),
    );
    const missingResponses =
      nonResponders.length > 0
        ? [
            {
              type: "thin-evidence" as const,
              section: "2.2-2.4 Data collection",
              description: `${nonResponders.length} of ${input.invites.length} invited respondents didn't respond: ${nonResponders.join("; ")}. Their perspectives are missing from this draft, so sections that depend on them may be one-sided. Consider following up before the final draft.`,
              sources: [],
              origin: "check" as const,
            },
          ]
        : [];
    const reviewerFlags: ReviewerFlag[] = [
      ...missingResponses,
      ...(sourceConflicts ?? []),
      ...draftFlags.map((flag) => ({ ...flag, origin: "ai" as const })),
      ...checkFlags,
    ].map((flag) => ({ ...flag, id: crypto.randomUUID(), resolved: false }));

    const surveyRatings = extractSurveyRatings(
      surveyResponses.map((r) => ({ respondent: r.role, questions: r.questions })),
    );

    return {
      ok: true,
      draft: { ...parsed, timeline, findingsMatrix, reviewerFlags, surveyRatings },
      unreadableDocuments,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
