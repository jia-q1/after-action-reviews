// Sends survey invite emails via a Power Automate flow triggered by a
// signed "When a HTTP request is received" URL. The signature in the URL
// (sp/sv/sig query params) is the flow's entire auth model -- there's no
// Azure AD app registration on our side. If POWER_AUTOMATE_INVITE_URL
// isn't set, sending is treated as unavailable rather than throwing, so
// local dev / previews without the secret configured just fall back to
// the manual "Copy link" flow.

export function isInviteEmailConfigured(): boolean {
  return Boolean(process.env.POWER_AUTOMATE_INVITE_URL);
}

export async function sendInviteEmail(input: {
  recipientEmail: string;
  recipientName: string;
  recipientRole: string;
  aarTitle: string;
  surveyLink: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const flowUrl = process.env.POWER_AUTOMATE_INVITE_URL;
  if (!flowUrl) {
    return { ok: false, error: "Email sending isn't configured." };
  }

  try {
    const res = await fetch(flowUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      return { ok: false, error: `Flow responded with ${res.status}` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not reach the email flow." };
  }
}
