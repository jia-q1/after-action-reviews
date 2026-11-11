"use client";

import { useEffect, useState } from "react";

// When the 30-day session cookie expires (or SESSION_SECRET is rotated)
// while a page is open, every API call starts returning 401 -- and most of
// the client helpers in aar-store.ts treat a failed request as "no data",
// so lists went quietly empty and saves failed with no explanation. This
// watches for those 401s and says what's actually wrong.
//
// It shows a banner rather than redirecting to /login: a redirect would
// throw away unsaved edits in the report editor. Logging in from the
// banner's new tab sets the cookie for this tab too, so the person can
// just retry.
function isWatchedApiCall(input: RequestInfo | URL): boolean {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(raw, window.location.href);
  return (
    url.origin === window.location.origin &&
    url.pathname.startsWith("/api/") &&
    // A wrong access code is a 401 too, and survey invitees never log in.
    !url.pathname.startsWith("/api/login") &&
    !url.pathname.startsWith("/api/respond")
  );
}

export default function SessionWatcher() {
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith("/login") || path.startsWith("/respond")) return;

    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      const res = await originalFetch(input, init);
      if (res.status === 401 && isWatchedApiCall(input)) setExpired(true);
      return res;
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  if (!expired) return null;

  const next = encodeURIComponent(window.location.pathname + window.location.search);
  return (
    <div
      role="alert"
      className="sticky top-16 z-30 border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900"
    >
      Your login has expired, so changes on this page aren&apos;t being saved.{" "}
      <a
        href={`/login?next=${next}`}
        target="_blank"
        rel="noopener"
        onClick={() => setExpired(false)}
        className="font-semibold underline"
      >
        Log in again
      </a>{" "}
      (opens a new tab, so nothing here is lost), then retry.
    </div>
  );
}
