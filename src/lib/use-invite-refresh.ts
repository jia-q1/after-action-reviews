"use client";

import { useEffect, type Dispatch, type SetStateAction } from "react";
import { listInvites, type SurveyInvite } from "@/lib/aar-store";

// Survey responses arrive while an AAR is open in another tab or on another
// screen. Invites used to load once, so "X of N received" stayed stale until
// the AAR was reopened (in testing it showed "0 of 3 received" after all
// three had answered). This re-fetches every 30 seconds while the tab is
// visible, and whenever the window regains focus.
export function useInviteRefresh(
  slug: string | null | undefined,
  setInvites: Dispatch<SetStateAction<SurveyInvite[]>>,
) {
  useEffect(() => {
    if (!slug) return;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      listInvites(slug).then((loaded) =>
        // listInvites returns [] when the request fails, too -- don't let a
        // failed refresh wipe a list that was showing.
        setInvites((prev) => (loaded.length === 0 && prev.length > 0 ? prev : loaded)),
      );
    };
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [slug, setInvites]);
}
