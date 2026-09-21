import "server-only";
import mammoth from "mammoth";
import ExcelJS from "exceljs";
import JSZip from "jszip";

// Word/Excel/PowerPoint aren't formats Gemini can read natively (unlike
// PDF or plain text), so their text has to be pulled out here first and
// fed in as part of the prompt rather than as an attached file. Legacy
// binary formats (.doc/.xls/.ppt, pre-2007) aren't handled -- only the
// modern OOXML formats these libraries actually support.
export const EXTRACTABLE_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

// Keeps one pathologically large spreadsheet or transcript from silently
// blowing up the prompt context.
const MAX_EXTRACTED_CHARS = 60_000;

function truncate(text: string): string {
  if (text.length <= MAX_EXTRACTED_CHARS) return text;
  return `${text.slice(0, MAX_EXTRACTED_CHARS)}\n\n[... truncated, document continues ...]`;
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return truncate(result.value.trim());
}

async function extractXlsxText(buffer: Buffer): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheets: string[] = [];
  workbook.eachSheet((worksheet) => {
    const rows: string[] = [];
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      const line = values
        .map((v) => (v === null || v === undefined ? "" : String(v)))
        .join(" | ");
      if (line.trim()) rows.push(line);
    });
    if (rows.length > 0) {
      sheets.push(`Sheet: ${worksheet.name}\n${rows.join("\n")}`);
    }
  });
  return truncate(sheets.join("\n\n"));
}

async function extractPptxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = Number(/slide(\d+)\.xml/.exec(a)?.[1] ?? 0);
      const nb = Number(/slide(\d+)\.xml/.exec(b)?.[1] ?? 0);
      return na - nb;
    });

  const slides: string[] = [];
  for (let i = 0; i < slideFiles.length; i++) {
    const xml = await zip.files[slideFiles[i]].async("text");
    const texts = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]);
    const slideText = texts.join(" ").trim();
    if (slideText) slides.push(`Slide ${i + 1}: ${slideText}`);
  }
  return truncate(slides.join("\n\n"));
}

// Returns null for a mimeType this module doesn't handle -- callers
// should already have checked EXTRACTABLE_MIME_TYPES first.
export async function extractDocumentText(
  mimeType: string,
  buffer: Buffer,
): Promise<string | null> {
  switch (mimeType) {
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return extractDocxText(buffer);
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      return extractXlsxText(buffer);
    case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      return extractPptxText(buffer);
    default:
      return null;
  }
}
