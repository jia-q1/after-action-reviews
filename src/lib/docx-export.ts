import "server-only";
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from "docx";
import type { AarRecord } from "@/lib/aar-store";
import { formatMonthYear } from "@/lib/format";

const HEADER_FILL = "0C2A4E"; // un-blue-950
const HEADER_SHADING = { fill: HEADER_FILL };

function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]) {
  return new Paragraph({ text, heading: level, spacing: { before: 280, after: 120 } });
}

// whitespace-pre-line on the web view means blank lines are meaningful
// paragraph breaks; split on them so Word gets separate paragraphs instead
// of one run with literal newlines (which Word renders as line breaks, not
// paragraph spacing).
function prose(text: string): Paragraph[] {
  const value = text.trim();
  if (!value) {
    return [
      new Paragraph({
        children: [new TextRun({ text: "Not yet drafted for this review.", italics: true })],
        spacing: { after: 160 },
      }),
    ];
  }
  return value
    .split(/\n{2,}/)
    .map(
      (para) =>
        new Paragraph({
          children: [new TextRun(para.replace(/\n/g, " ").trim())],
          spacing: { after: 160 },
        }),
    );
}

function bulletList(items: string[]): Paragraph[] {
  if (items.length === 0) {
    return [
      new Paragraph({
        children: [new TextRun({ text: "Not yet drafted for this review.", italics: true })],
        spacing: { after: 160 },
      }),
    ];
  }
  return items.map(
    (item) =>
      new Paragraph({
        text: item,
        bullet: { level: 0 },
        spacing: { after: 100 },
      }),
  );
}

function headerCell(text: string): TableCell {
  return new TableCell({
    shading: HEADER_SHADING,
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: true, color: "FFFFFF" })],
      }),
    ],
  });
}

function bodyCell(text: string): TableCell {
  return new TableCell({
    children: [new Paragraph(text)],
  });
}

function findingsMatrixTable(review: AarRecord): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          headerCell("Response area"),
          headerCell("Finding"),
          headerCell("Recommendation"),
          headerCell("Key actions required"),
          headerCell("Priority"),
        ],
      }),
      ...review.findingsMatrix.map(
        (row) =>
          new TableRow({
            children: [
              bodyCell(row.responseArea),
              bodyCell(row.finding),
              bodyCell(row.recommendation),
              bodyCell(row.keyActions),
              bodyCell(row.priority),
            ],
          }),
      ),
    ],
  });
}

function intervieweeTable(review: AarRecord): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [headerCell("Name"), headerCell("Title"), headerCell("Agency / unit")],
      }),
      ...review.interviewees.map(
        (person) =>
          new TableRow({
            children: [
              bodyCell(person.name),
              bodyCell(person.title),
              bodyCell(person.agency),
            ],
          }),
      ),
    ],
  });
}

function timelineParagraphs(entries: { date: string; event: string }[]): Paragraph[] {
  return entries.map(
    (entry) =>
      new Paragraph({
        children: [
          new TextRun({ text: `${entry.date}  `, bold: true }),
          new TextRun(entry.event),
        ],
        spacing: { after: 100 },
      }),
  );
}

const NO_BORDER = {
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
};

function detailRow(label: string, value: string): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        borders: NO_BORDER,
        width: { size: 30, type: WidthType.PERCENTAGE },
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true })] })],
      }),
      new TableCell({
        borders: NO_BORDER,
        width: { size: 70, type: WidthType.PERCENTAGE },
        children: [new Paragraph(value)],
      }),
    ],
  });
}

export async function buildAarDocx(review: AarRecord): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];

  children.push(
    new Paragraph({
      children: [new TextRun({ text: review.title, bold: true, size: 56 })],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `${formatMonthYear(review.periodStart)} – ${formatMonthYear(review.periodEnd)} · ${review.office}`,
          italics: true,
          color: "666666",
        }),
      ],
      spacing: { after: 240 },
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        detailRow("Country / crisis", review.country),
        detailRow("Responsible office", review.office),
        detailRow("Lead author / team", review.leadAuthor || "—"),
        detailRow("Status", review.stage ? `${review.status} (${review.stage})` : review.status),
      ],
    }),
    new Paragraph({ text: "", spacing: { after: 200 } }),
  );

  children.push(heading("Executive Summary", HeadingLevel.HEADING_1));
  children.push(...prose(review.executiveSummary));

  children.push(heading("1. Introduction", HeadingLevel.HEADING_1));
  children.push(heading("1.1 Country situation and context", HeadingLevel.HEADING_2));
  children.push(...prose(review.introduction.countrySituation));
  children.push(heading("1.2 Objectives of After Action Review", HeadingLevel.HEADING_2));
  children.push(...prose(review.introduction.objectives));

  children.push(heading("2. Methodology", HeadingLevel.HEADING_1));
  children.push(heading("2.1 Scope of After Action Review", HeadingLevel.HEADING_2));
  children.push(...prose(review.methodology.scope));
  children.push(
    heading("2.2–2.4 Data collection, analysis, and validation", HeadingLevel.HEADING_2),
  );
  children.push(...prose(review.methodology.dataCollection));
  if (review.methodology.dataCollectionMethods.length > 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Methods used: ${review.methodology.dataCollectionMethods.join(", ")}`,
            italics: true,
          }),
        ],
        spacing: { after: 160 },
      }),
    );
  }

  children.push(heading("3. Analysis of the UNDP Response", HeadingLevel.HEADING_1));
  children.push(
    heading("3.1 Contextual factors influencing the response", HeadingLevel.HEADING_2),
  );
  children.push(...prose(review.analysis.contextualFactors));

  if (review.analysis.timeline.length > 0) {
    children.push(
      heading("3.2 Timeline of crisis events and response actions", HeadingLevel.HEADING_2),
    );
    children.push(...timelineParagraphs(review.analysis.timeline));
  }

  children.push(
    heading("3.3 UNDP in-country structure and response capacity", HeadingLevel.HEADING_2),
  );
  children.push(...prose(review.analysis.inCountryStructure));
  children.push(heading("3.4 UNDP corporate response mechanisms", HeadingLevel.HEADING_2));
  children.push(...prose(review.analysis.corporateResponseMechanisms));
  children.push(heading("3.5 Deployment of experts", HeadingLevel.HEADING_2));
  children.push(...prose(review.analysis.deploymentOfExperts));
  children.push(heading("3.6 Programmatic response", HeadingLevel.HEADING_2));
  children.push(...prose(review.analysis.programmaticResponse));
  children.push(heading("3.7 Operational response", HeadingLevel.HEADING_2));
  children.push(...prose(review.analysis.operationalResponse));
  children.push(heading("3.8 Coordination", HeadingLevel.HEADING_2));
  children.push(...prose(review.analysis.coordination));
  children.push(heading("3.9 Communication and resource mobilization", HeadingLevel.HEADING_2));
  children.push(...prose(review.analysis.communicationAndResourceMobilization));

  children.push(heading("4. Findings and Recommendations", HeadingLevel.HEADING_1));
  children.push(heading("4.1 Key findings and lessons learned", HeadingLevel.HEADING_2));
  children.push(...bulletList(review.keyFindings));
  children.push(heading("4.2 Actionable recommendations", HeadingLevel.HEADING_2));
  children.push(...bulletList(review.recommendations));

  if (review.findingsMatrix.length > 0) {
    children.push(
      heading("Annex 7: Matrix of Main Findings and Recommendations", HeadingLevel.HEADING_1),
    );
    children.push(findingsMatrixTable(review));
    children.push(new Paragraph({ text: "", spacing: { after: 200 } }));
  }

  if (review.documents.length > 0) {
    children.push(heading("Annex 2: Desk Review Bibliography", HeadingLevel.HEADING_1));
    children.push(
      ...review.documents.map(
        (doc) =>
          new Paragraph({
            text: doc.dataCollectionMethod ? `${doc.name} (${doc.dataCollectionMethod})` : doc.name,
            bullet: { level: 0 },
            spacing: { after: 80 },
          }),
      ),
    );
  }

  if (review.interviewees.length > 0) {
    children.push(heading("Annex 3: List of People Interviewed", HeadingLevel.HEADING_1));
    children.push(intervieweeTable(review));
  }

  const doc = new Document({
    sections: [{ children }],
    styles: {
      default: {
        document: {
          run: { size: 22 }, // 11pt
        },
      },
    },
  });

  return Packer.toBuffer(doc);
}
