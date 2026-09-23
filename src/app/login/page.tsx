"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/workspace";

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (res.ok) {
      router.push(next);
      router.refresh();
    } else {
      setError("Incorrect access code.");
      setSubmitting(false);
    }
  }

  return (
    <main className="flex-1 bg-background">
      <div className="mx-auto mt-16 max-w-sm px-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-un-blue-600">
          Internal tool
        </p>
        <h1 className="mt-2 font-serif text-2xl font-semibold text-un-ink">
          Enter the access code
        </h1>
        <p className="mt-2 text-sm text-un-muted">
          This tool, including the Review Library, is for internal UNDP
          staff only.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <input
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Access code"
            autoFocus
            className="input"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting || !code}
            className="w-full rounded-full bg-un-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-un-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Checking..." : "Continue"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
