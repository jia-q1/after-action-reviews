import "server-only";
import type { ReportDraft } from "@/lib/aar-store";
import type {
  FindingRow,
  ReviewerFlag,
  SurveyRating,
  TimelineEntry,
} from "@/data/reviews";

// Checks run on the AI's output after generation, independent of whether
// the model followed its instructions. They only ever raise flags for the
// reviewer -- nothing in the draft is changed or removed. Each one is
// deliberately simple (string matching against the source text), so it
// will miss some things and occasionally flag something that's fine; the
// point is to put the riskiest-looking spots in front of a human.

type FlagInput = Omit<ReviewerFlag, "id" | "resolved">;

const SECTION_LABELS: Record<keyof ReportDraft, string> = {
  executiveSummary: "Executive Summary",
  countrySituation: "1.1 Country situation",
  objectives: "1.2 Objectives",
  scope: "2.1 Scope",
  dataCollection: "2.2-2.4 Data collection",
  contextualFactors: "3.1 Contextual factors",
  inCountryStructure: "3.3 In-country structure",
  corporateResponseMechanisms: "3.4 Corporate response mechanisms",
  deploymentOfExperts: "3.5 Deployment of experts",
  programmaticResponse: "3.6 Programmatic response",
  operationalResponse: "3.7 Operational response",
  coordination: "3.8 Coordination",
  communicationAndResourceMobilization: "3.9 Communication and resource mobilization",
};

// Every piece of drafted text with the section it belongs to, so a flag
// can say where to look.
function draftTexts(input: {
  draft: ReportDraft;
  timeline: TimelineEntry[];
  findingsMatrix: FindingRow[];
}): { section: string; text: string }[] {
  return [
    ...(Object.keys(SECTION_LABELS) as (keyof ReportDraft)[]).map((field) => ({
      section: SECTION_LABELS[field],
      text: input.draft[field] ?? "",
    })),
    ...input.timeline.map((entry) => ({
      section: "3.2 Timeline",
      text: entry.event,
    })),
    ...input.findingsMatrix.map((row) => ({
      section: `Annex 7: ${row.responseArea}`,
      text: [row.finding, row.recommendation, row.keyActions].join(" "),
    })),
  ];
}

// --- Figures -------------------------------------------------------------

// Accepts English ("1,200,000", "6.8 million"), French/Spanish-style
// ("1 200 000", "6,8 millions") and percent spelled out in either.
const NUMBER_PATTERN =
  /(USD|US\$|\$|EUR|€)?\s?(?<![\d.,])(\d{1,3}(?:[,   ]\d{3})+(?:\.\d+)?|\d+(?:[.,]\d{1,2}(?!\d))?(?:\.\d+)?)\s?(millions?|millones|milliards?|billions?|thousands?|bn|m|k)?\b\s?(%|percent|per cent|pour cent|por ciento)?/gi;

function multiplier(suffix: string): number {
  const s = suffix.toLowerCase();
  if (s === "k" || s.startsWith("thousand")) return 1e3;
  if (s === "bn" || s.startsWith("billion") || s.startsWith("milliard")) return 1e9;
  return 1e6; // m, million(s), millones
}

// "1,200,000" / "1 200 000" -> 1200000; "6,8" (one or two digits after
// the comma) is a decimal comma -> 6.8.
function parseNumber(digits: string): number {
  if (/^\d{1,3}(?:[,   ]\d{3})+/.test(digits)) {
    return Number(digits.replace(/[,   ]/g, ""));
  }
  return Number(digits.replace(",", "."));
}

// `baseKey` is the number as written, before applying "million" etc. --
// tables often put the unit in the column header ("USD million") and list
// bare numbers, so "USD 203.3 million" in a draft should match "203.3".
type Figure = {
  raw: string;
  key: string;
  baseKey: string | null;
  checkable: boolean;
  // No currency, unit or percent sign -- e.g. a number in a table cell.
  bare: boolean;
  // For space-grouped numbers, the last group on its own: "Phase 2 100
  // families" is read as 2,100, but may just be 100.
  altKey: string | null;
};

// Normalizes "USD 6.8M", "6.8 million" and "6,800,000" to the same key so
// a figure the AI reformatted still matches its source.
function extractFigures(text: string): Figure[] {
  const figures: Figure[] = [];
  for (const match of text.matchAll(NUMBER_PATTERN)) {
    const [raw, currency, digits, suffix, percent] = match;
    const base = parseNumber(digits);
    if (!Number.isFinite(base)) continue;
    const value = base * (suffix ? multiplier(suffix) : 1);
    const isPercent = Boolean(percent);
    const key = `${isPercent ? "%" : ""}${Math.round(value * 100)}`;
    // Small bare numbers ("two staff", "18 days", section numbers) are
    // too common to check without drowning the reviewer in noise, and
    // bare four-digit years are covered by the date check instead.
    const isYear = !currency && !suffix && !isPercent && /^(19|20)\d{2}$/.test(digits);
    const checkable =
      !isYear && (Boolean(currency) || Boolean(suffix) || isPercent || value >= 100);
    const baseKey = suffix ? `${Math.round(base * 100)}` : null;
    const bare = !currency && !suffix && !isPercent;
    const altKey = /[^\d.,]/.test(digits)
      ? `${isPercent ? "%" : ""}${Math.round(
          Number(digits.split(/[^\d.,]/).pop()) * (suffix ? multiplier(suffix) : 1) * 100,
        )}`
      : null;
    figures.push({ raw: raw.trim(), key, baseKey, checkable, bare, altKey });
  }
  return figures;
}

// --- Dates ---------------------------------------------------------------

// English, Spanish and French month names -- source documents from
// Country Offices are often in Spanish or French even when the AAR is
// drafted in English.
const MONTH_PATTERNS = [
  "jan(?:uary)?|enero|janv(?:ier)?",
  "feb(?:ruary)?|febrero|f[ée]v(?:rier)?",
  "mar(?:ch)?|marzo|mars",
  "apr(?:il)?|abril|avr(?:il)?",
  "may|mayo|mai",
  "june?|junio|juin",
  "july?|julio|juil(?:let)?",
  "aug(?:ust)?|agosto|ao[uû]t",
  "sep(?:t(?:ember)?)?|se(?:p)?tiembre|septembre",
  "oct(?:ober)?|octubre|octobre",
  "nov(?:ember)?|noviembre|novembre",
  "dec(?:ember)?|diciembre|d[ée]c(?:embre)?",
].map((pattern) => new RegExp(`^(?:${pattern})$`, "i"));
const MONTH_NAME = `(${MONTH_PATTERNS.map((re) => re.source.slice(4, -2)).join("|")})`;
// Also catches lists and ranges sharing one month: "8 and 15 March",
// "2 to 4 March", "3, 9 and 12 May", "8 y 15 de marzo", "1er mars".
const DAY = "\\d{1,2}(?:st|nd|rd|th|er)?";
// The lookbehind keeps "SitRep No. 2 and 21 May" from reading as 2 May.
const DAY_MONTH = new RegExp(
  `(?<!(?:\\b(?:no|nos|number|n°)|#)\\.?\\s*)\\b(${DAY}(?:\\s*(?:,|and|y|et|&|to|al|au|-|–)\\s*${DAY})*)\\s+(?:(?:of|de|du)\\s+)?${MONTH_NAME}\\b`,
  "gi",
);
const MONTH_DAY = new RegExp(`\\b${MONTH_NAME}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, "gi");
const ISO_DATE = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g;
const NUMERIC_DATE = /\b(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})\b/g;

function monthIndex(name: string): number {
  return MONTH_PATTERNS.findIndex((re) => re.test(name)) + 1;
}

function dayKey(month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${month}-${day}`;
}

// Month-day pairs only (no year): sources mix "12 March", "March 12th" and
// "12/03/2026", and drafts rarely get the year wrong in a way that matters.
function extractDayKeys(text: string, { ambiguousNumeric }: { ambiguousNumeric: boolean }) {
  const keys = new Set<string>();
  const add = (key: string | null) => key && keys.add(key);
  // Lowercase "may" is the verb ("4 may have left"), not the month --
  // English capitalizes month names.
  const isMonth = (name: string) => name !== "may";
  for (const m of text.matchAll(DAY_MONTH)) {
    if (!isMonth(m[2])) continue;
    for (const day of m[1].match(/\d{1,2}/g) ?? []) add(dayKey(monthIndex(m[2]), Number(day)));
  }
  for (const m of text.matchAll(MONTH_DAY)) {
    if (isMonth(m[1])) add(dayKey(monthIndex(m[1]), Number(m[2])));
  }
  for (const m of text.matchAll(ISO_DATE)) add(dayKey(Number(m[2]), Number(m[3])));
  if (ambiguousNumeric) {
    // 03/12 could be either order depending on who wrote it -- accept both
    // on the source side so a correct date is never flagged because of it.
    for (const m of text.matchAll(NUMERIC_DATE)) {
      add(dayKey(Number(m[2]), Number(m[1])));
      add(dayKey(Number(m[1]), Number(m[2])));
    }
  }
  return keys;
}

// --- Wording -------------------------------------------------------------

// Words that judge rather than describe.
const LOADED_TERMS = new RegExp(
  "\\b(" +
    [
      "severe(?:ly)?",
      "violat\\w*",
      "mandated?",
      "burn-?out",
      "catastroph\\w*",
      "disastrous(?:ly)?",
      "crippl\\w*",
      "chaotic",
      "egregious(?:ly)?",
      "unacceptabl[ey]",
      "alarming(?:ly)?",
      "drastic(?:ally)?",
      "dramatic(?:ally)?",
    ].join("|") +
    ")\\b",
  "gi",
);

// A loaded word is fine when the AI is repeating a source's own phrasing
// ("severe flooding" straight from a sitrep). Checked as a two-word phrase
// with the word on either side, not the word alone -- otherwise one
// "severe flooding" in a sitrep would excuse "severe burnout" everywhere.
function usedInSource(text: string, index: number, word: string, source: string): boolean {
  const before = /(\S+)\s+$/.exec(text.slice(0, index))?.[1] ?? "";
  const after = /^\s+(\S+)/.exec(text.slice(index + word.length))?.[1] ?? "";
  const clean = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}-]/gu, "");
  const w = clean(word);
  return [
    before && `${clean(before)} ${w}`,
    after && `${w} ${clean(after)}`,
  ].some((phrase) => phrase && source.includes(phrase));
}

// "violating the 48-hour mandate" turns a target into a rule; "mandate
// sex-disaggregated assessments" in a recommendation is just a verb. Only
// the noun is worth flagging, recognized by what comes right before it.
function isNounMandate(text: string, index: number): boolean {
  const before = /(\S+)\s+$/.exec(text.slice(0, index))?.[1]?.toLowerCase() ?? "";
  return (
    /^(the|a|an|its|their|this|that|his|her|our|any|formal|clear|no)$/.test(before) ||
    /-(hour|day|week|month)$/.test(before)
  );
}

function excerpt(text: string, index: number, length: number): string {
  const start = Math.max(0, text.lastIndexOf(".", index) + 1);
  const endDot = text.indexOf(".", index + length);
  const end = endDot === -1 ? text.length : endDot + 1;
  const sentence = text.slice(start, end).trim();
  return sentence.length > 220 ? `${sentence.slice(0, 217)}...` : sentence;
}

// --- Entry point ---------------------------------------------------------

export function runDraftChecks(input: {
  draft: ReportDraft;
  timeline: TimelineEntry[];
  findingsMatrix: FindingRow[];
  sourceText: string;
  // Sources the AI read but this check can't (PDFs go to Gemini as files,
  // so their text never passes through our server).
  unsearchedSources: string[];
}): FlagInput[] {
  const flags: FlagInput[] = [];
  const texts = draftTexts(input);
  const sourceLower = input.sourceText
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, " ");
  const caveat =
    input.unsearchedSources.length > 0
      ? ` This check can't search ${input.unsearchedSources.join(", ")}, so it may come from there.`
      : "";

  // Figures that don't appear anywhere in the sources.
  const sourceFigureKeys = new Set<string>();
  for (const figure of extractFigures(input.sourceText)) {
    sourceFigureKeys.add(figure.key);
    // A bare "203.3" in a table headed "USD million" (or "thousand")
    // should also match a draft that writes it out as 203,300,000.
    if (figure.bare) {
      const value = Number(figure.key) / 100;
      sourceFigureKeys.add(`${Math.round(value * 1e3 * 100)}`);
      sourceFigureKeys.add(`${Math.round(value * 1e6 * 100)}`);
    }
  }
  const flaggedFigures = new Set<string>();
  for (const { section, text } of texts) {
    for (const figure of extractFigures(text)) {
      if (
        !figure.checkable ||
        sourceFigureKeys.has(figure.key) ||
        (figure.baseKey && sourceFigureKeys.has(figure.baseKey)) ||
        (figure.altKey && sourceFigureKeys.has(figure.altKey))
      ) {
        continue;
      }
      const dedupeKey = `${section}|${figure.key}`;
      if (flaggedFigures.has(dedupeKey)) continue;
      flaggedFigures.add(dedupeKey);
      flags.push({
        type: "unsupported",
        section,
        description: `"${figure.raw}" doesn't appear in any source. It may have been calculated from other figures, or invented. Check it before the final draft.${caveat}`,
        sources: [],
        origin: "check",
      });
    }
  }

  // Dates, from the timeline's date field and any "19 March"-style dates in
  // the prose.
  const sourceDays = extractDayKeys(input.sourceText, { ambiguousNumeric: true });
  const flaggedDays = new Set<string>();
  const checkDay = (section: string, key: string, label: string) => {
    if (sourceDays.has(key) || flaggedDays.has(`${section}|${key}`)) return;
    flaggedDays.add(`${section}|${key}`);
    flags.push({
      type: "unsupported",
      section,
      description: `The date ${label} doesn't appear in any source. Check it before the final draft.${caveat}`,
      sources: [],
      origin: "check",
    });
  };
  for (const entry of input.timeline) {
    const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(entry.date.trim());
    if (!iso) continue;
    const key = dayKey(Number(iso[2]), Number(iso[3]));
    if (key) checkDay("3.2 Timeline", key, `${entry.date} ("${entry.event}")`);
  }
  for (const { section, text } of texts) {
    for (const key of extractDayKeys(text, { ambiguousNumeric: false })) {
      const [month, day] = key.split("-").map(Number);
      const label = `${day} ${new Date(2000, month - 1, 1).toLocaleString("en", { month: "long" })}`;
      checkDay(section, key, label);
    }
  }

  // Judgmental wording the sources don't use.
  for (const { section, text } of texts) {
    for (const match of text.matchAll(LOADED_TERMS)) {
      const index = match.index ?? 0;
      if (usedInSource(text, index, match[0], sourceLower)) continue;
      if (/^mandate/i.test(match[0]) && !isNounMandate(text, index)) continue;
      flags.push({
        type: "wording",
        section,
        description: `"${match[0]}" is the AI's own wording, not the sources': "${excerpt(text, index, match[0].length)}" Consider stating the underlying facts instead.`,
        sources: [],
        origin: "check",
      });
    }
  }

  // Findings that rest on one source.
  for (const row of input.findingsMatrix) {
    const sources = row.sources ?? [];
    if (sources.length > 1) continue;
    flags.push({
      type: "single-source",
      section: `Annex 7: ${row.responseArea}`,
      description:
        sources.length === 1
          ? `This finding rests on one source only: "${row.finding}" Confirm it's corroborated, or make sure the text attributes it rather than stating it as fact.`
          : `The AI didn't cite any source for this finding: "${row.finding}" Confirm where it comes from.`,
      sources,
      origin: "check",
    });
  }

  return flags;
}

// Pulls scaled answers (questions that list their options in brackets,
// e.g. "(Strongly Integrated / Moderately Integrated / ...)") out of the
// survey responses directly, so they can't be dropped or paraphrased.
export function extractSurveyRatings(
  responses: { respondent: string; questions: { text: string; answer: string }[] }[],
): SurveyRating[] {
  const ratings: SurveyRating[] = [];
  for (const response of responses) {
    for (const { text, answer } of response.questions) {
      const scale = /\(([^()]*\/[^()]*)\)/.exec(text);
      if (!scale || !answer.trim()) continue;
      const options = scale[1]
        .split("/")
        .map((o) => o.trim().replace(/[.\s]+$/, ""))
        .filter(Boolean);
      const answerLower = answer.toLowerCase();
      // The option mentioned earliest in the answer wins; on a tie, the
      // longer one ("Somewhat Ineffective" over "Ineffective"). A negated
      // mention ("not very effective") is skipped -- it means the
      // opposite, and a missing rating is better than an inverted one.
      let best: { option: string; index: number } | null = null;
      for (const option of options) {
        const index = answerLower.indexOf(option.toLowerCase());
        if (index === -1) continue;
        // English, Spanish and French negations ("not", "no diría", "pas").
        const before = answerLower.slice(Math.max(0, index - 25), index);
        if (/(?<![\p{L}])(not|never|no|nunca|ni|pas|jamais)\s+([\p{L}']+\s+)?$|n't\s+([\p{L}']+\s+)?$/u.test(before)) {
          continue;
        }
        if (
          !best ||
          index < best.index ||
          (index === best.index && option.length > best.option.length)
        ) {
          best = { option, index };
        }
      }
      if (!best) continue;
      ratings.push({
        respondent: response.respondent,
        question: text.slice(0, scale.index).trim().replace(/[?:]?$/, "?"),
        rating: best.option,
      });
    }
  }
  return ratings;
}
