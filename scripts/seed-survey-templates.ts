// One-time script: pushes the 7 real Crisis Bureau survey templates from
// src/data/reviews.ts into the SharePoint SurveyTemplates list, via the
// "create" branch of the AAR Templates Power Automate flow. Run this once
// after that flow exists, to seed the list -- not part of the app's
// runtime.
//
// Usage:
//   POWER_AUTOMATE_TEMPLATES_URL="<flow url>" npx tsx scripts/seed-survey-templates.ts

import { surveyTemplates } from "../src/data/reviews";
import type { SurveyTemplateRecord } from "../src/lib/db";

async function main() {
  const flowUrl = process.env.POWER_AUTOMATE_TEMPLATES_URL;
  if (!flowUrl) {
    console.error("Set POWER_AUTOMATE_TEMPLATES_URL first.");
    process.exit(1);
  }

  for (const template of surveyTemplates) {
    const record: SurveyTemplateRecord = {
      id: template.id,
      name: template.name,
      audience: template.audience,
      description: template.description,
      informsSections: template.informsSections,
      suggestedRoles: template.suggestedRoles,
      questions: template.questions.map((text, index) => ({
        id: `${template.id}-q${index + 1}`,
        text,
        order: index,
      })),
      updatedAt: new Date().toISOString(),
    };

    const res = await fetch(flowUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation: "create", ...record }),
    });

    console.log(
      `${res.ok ? "OK  " : "FAIL"} ${template.id} (${template.questions.length} questions)${
        res.ok ? "" : ` - ${res.status} ${await res.text()}`
      }`,
    );
  }
}

main();
