"use client";

import { useState } from "react";
import type { SurveyInvite, SurveyTemplate } from "@/lib/aar-store";

export default function ResponseForm({
  invite,
  template,
}: {
  invite: SurveyInvite;
  template: SurveyTemplate;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>(
    invite.answers ?? {},
  );
  const [status, setStatus] = useState<"idle" | "saving" | "done">(
    invite.status === "Responded" ? "done" : "idle",
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    await fetch(`/api/respond/${invite.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    setStatus("done");
  }

  if (status === "done") {
    return (
      <div className="text-center">
        <p className="font-serif text-lg font-semibold text-un-ink">
          Thank you — your response has been recorded.
        </p>
        <p className="mt-2 text-sm text-un-muted">
          You can close this page. If you&apos;d like to change your
          answers, just revisit this same link.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-4 text-sm font-semibold text-un-blue-700 underline hover:text-un-blue-600"
        >
          Edit my response
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="text-sm text-un-muted">
        Hi {invite.name.split(" ")[0] || invite.name} — answer as many of
        these as you can. Short, specific points are more useful than a long
        narrative.
      </p>
      {template.questions.map((question, index) => (
        <div key={question.id}>
          <label className="block text-sm font-semibold text-un-ink">
            {index + 1}. {question.text}
          </label>
          <textarea
            value={answers[question.id] ?? ""}
            onChange={(e) =>
              setAnswers((a) => ({ ...a, [question.id]: e.target.value }))
            }
            className="mt-2 min-h-[80px] w-full rounded-lg border border-un-border bg-white px-3 py-2 text-sm text-un-ink focus:outline-none focus:ring-2 focus:ring-un-blue-400"
          />
        </div>
      ))}
      <button
        type="submit"
        disabled={status === "saving"}
        className="w-full rounded-full bg-un-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-un-blue-700 disabled:cursor-wait disabled:opacity-70"
      >
        {status === "saving" ? "Submitting..." : "Submit response"}
      </button>
    </form>
  );
}
