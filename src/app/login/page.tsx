"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

// Only same-site paths: "//evil.example" or "javascript:..." in ?next=
// would otherwise send someone off-site (or run script) after logging in.
function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return "/workspace";
  }
  return value;
}

function LoginForm() {
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      if (res.ok) {
        // A full page load, not router.push + router.refresh: the client
        // router may still hold pages it fetched while logged out (cached
        // redirects back to /login), and push followed by refresh rendered
        // the destination twice. replace() also keeps the login page out
        // of the back-button history.
        window.location.replace(next);
        return;
      }
      setError(
        res.status === 401
          ? "Incorrect access code."
          : "Something went wrong on the server. Please try again.",
      );
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    }
    setSubmitting(false);
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
            name="password"
            autoComplete="current-password"
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
