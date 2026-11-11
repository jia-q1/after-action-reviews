// Regression tests for the reviewer-flag checks. The matching here is
// regex-heavy and easy to break in either direction (flagging correct text,
// or missing invented figures), so each case pins down one behavior.
//
// Run with: npm test
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runDraftChecks, extractSurveyRatings } from "./draft-checks.ts";
import type { ReportDraft } from "./aar-store.ts";
import type { FindingRow, TimelineEntry } from "../data/reviews.ts";

const EMPTY_DRAFT: ReportDraft = {
  executiveSummary: "",
  countrySituation: "",
  objectives: "",
  scope: "",
  dataCollection: "",
  contextualFactors: "",
  inCountryStructure: "",
  corporateResponseMechanisms: "",
  deploymentOfExperts: "",
  programmaticResponse: "",
  operationalResponse: "",
  coordination: "",
  communicationAndResourceMobilization: "",
} as ReportDraft;

function check(
  draft: Partial<ReportDraft>,
  sourceText: string,
  extra: { timeline?: TimelineEntry[]; findingsMatrix?: FindingRow[] } = {},
) {
  return runDraftChecks({
    draft: { ...EMPTY_DRAFT, ...draft },
    timeline: extra.timeline ?? [],
    findingsMatrix: extra.findingsMatrix ?? [],
    sourceText,
    unsearchedSources: [],
  });
}

const descriptions = (flags: ReturnType<typeof check>) => flags.map((f) => f.description);

describe("figures", () => {
  it("flags a figure that appears in no source", () => {
    const flags = check({ executiveSummary: "USD 3.2 million was mobilized." }, "USD 2.1 million was mobilized.");
    assert.equal(flags.length, 1);
    assert.match(flags[0].description, /USD 3\.2 million/);
  });

  it("matches a figure the draft reformatted", () => {
    assert.deepEqual(check({ executiveSummary: "USD 6.8 million was mobilized." }, "Total: 6,800,000 USD."), []);
  });

  it("matches a draft figure against a bare number in a 'USD million' table", () => {
    assert.deepEqual(check({ executiveSummary: "Funding reached USD 203.3 million." }, "Funding (USD million): 203.3"), []);
  });

  it("matches French/Spanish number formatting", () => {
    assert.deepEqual(check({ executiveSummary: "1,200,000 people were affected." }, "1 200 000 personnes touchées."), []);
    assert.deepEqual(check({ executiveSummary: "USD 6.8 million." }, "6,8 millones de dólares."), []);
  });

  it("flags an invented space-grouped number", () => {
    assert.equal(check({ executiveSummary: "Some 1 200 000 people." }, "Some 800 000 people.").length, 1);
  });

  it("doesn't read 'Phase 2 100 families' as 2,100", () => {
    assert.deepEqual(check({ programmaticResponse: "In Phase 2 100 families received cash." }, "In Phase 2, 100 families received cash."), []);
  });

  it("ignores small counts and bare years", () => {
    assert.deepEqual(check({ operationalResponse: "18 staff worked for 2 months in 2026." }, ""), []);
  });
});

describe("dates", () => {
  it("flags a date that appears in no source, in prose and in the timeline", () => {
    const flags = check(
      { operationalResponse: "Funds were loaded on 21 May and approved March 12." },
      "Funds were approved on 14 March.",
      { timeline: [{ date: "2026-04-02", event: "SURGE deployed", sources: [] } as TimelineEntry] },
    );
    const text = descriptions(flags).join("\n");
    assert.match(text, /21 May/);
    assert.match(text, /12 March/);
    assert.match(text, /2026-04-02/);
    assert.equal(flags.length, 3);
  });

  it("matches dates written differently in the source", () => {
    assert.deepEqual(check({ operationalResponse: "Approved on 14 March." }, "Approved March 14th."), []);
    assert.deepEqual(check({ operationalResponse: "Approved on 14 March." }, "Aprobado el 14 de marzo."), []);
    assert.deepEqual(check({ operationalResponse: "Approved on 14 March." }, "Approved 14/03/2026."), []);
  });

  it("covers every day in a list of dates sharing one month", () => {
    const flags = check({ coordination: "Meetings were held on 8 and 15 March." }, "Meeting on 8 March.");
    assert.equal(flags.length, 1);
    assert.match(flags[0].description, /15 March/);
  });

  it("accepts the review period from the AAR overview", () => {
    // gemini.ts puts the overview line into the source text.
    const source = "AAR overview: country=X; period=2026-03-01 to 2026-06-30; office=Y.";
    assert.deepEqual(check({ scope: "The review covers 1 March to 30 June 2026." }, source), []);
  });

  it("doesn't read the verb 'may' as the month", () => {
    assert.deepEqual(check({ dataCollection: "Of the 12 respondents, 4 may have left." }, ""), []);
  });

  it("still reads a capitalized 'May' as the month", () => {
    assert.equal(check({ coordination: "The cluster met on 4 May." }, "").length, 1);
    assert.deepEqual(check({ coordination: "The cluster met on 4 May." }, "Cluster meeting, 4 May."), []);
  });

  it("doesn't read a document number as a day", () => {
    const source = "The 21 May report notes flooding.";
    assert.deepEqual(check({ contextualFactors: "SitRep #2 and 21 May reports describe flooding." }, source), []);
    assert.deepEqual(check({ contextualFactors: "SitRep No. 2 and 21 May reports describe flooding." }, source), []);
  });
});

describe("wording", () => {
  it("flags loaded words the sources don't use", () => {
    const flags = check({ operationalResponse: "Staff suffered severe burnout." }, "Staff worked 12-hour days.");
    assert.equal(flags.filter((f) => f.type === "wording").length, 2);
  });

  it("allows a loaded word when the source uses the same phrase", () => {
    assert.deepEqual(check({ countrySituation: "The country faced severe flooding." }, "Severe flooding hit the north."), []);
  });

  it("doesn't let one source phrase excuse the word everywhere", () => {
    const flags = check({ operationalResponse: "Staff faced severe pressure." }, "Severe flooding hit the north.");
    assert.equal(flags.length, 1);
  });

  it("flags 'mandate' as a noun but not as a verb", () => {
    assert.equal(check({ operationalResponse: "BMS missed the 48-hour mandate." }, "").length, 1);
    assert.deepEqual(check({ programmaticResponse: "HQ should mandate sex-disaggregated assessments." }, ""), []);
  });
});

describe("single-source findings", () => {
  const row = (sources: string[]) =>
    ({ responseArea: "Coordination", finding: "F", recommendation: "R", keyActions: "K", sources }) as unknown as FindingRow;

  it("flags findings with zero or one source, not two", () => {
    const flags = check({}, "", { findingsMatrix: [row([]), row(["A"]), row(["A", "B"])] });
    assert.equal(flags.length, 2);
    assert.ok(flags.every((f) => f.type === "single-source"));
  });
});

describe("extractSurveyRatings", () => {
  const rate = (text: string, answer: string) =>
    extractSurveyRatings([{ respondent: "CO", questions: [{ text, answer }] }]);
  const SCALE = "How effective was SURGE? (Very Effective / Somewhat Effective / Somewhat Ineffective / Ineffective)";

  it("picks the longer option on a tie", () => {
    assert.equal(rate(SCALE, "Somewhat Ineffective, mostly.")[0].rating, "Somewhat Ineffective");
  });

  it("skips negated mentions", () => {
    assert.equal(rate(SCALE, "Not very effective. I'd say Somewhat Ineffective.")[0].rating, "Somewhat Ineffective");
    assert.deepEqual(rate(SCALE, "It was not very effective."), []);
  });

  it("ignores questions without a scale", () => {
    assert.deepEqual(rate("What went well?", "Very Effective coordination."), []);
  });

  it("cleans up the question text", () => {
    assert.equal(rate(SCALE, "Ineffective")[0].question, "How effective was SURGE?");
  });
});
