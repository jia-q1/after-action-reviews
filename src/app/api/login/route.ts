import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSessionToken, isValidAccessCode, SESSION_COOKIE } from "@/lib/auth";

export async function POST(request: Request) {
  const { code } = (await request.json().catch(() => ({}))) as { code?: string };

  // Trimmed: pasting or autofilling the code often adds a trailing space.
  if (!isValidAccessCode(typeof code === "string" ? code.trim() : "")) {
    return NextResponse.json({ error: "Incorrect access code." }, { status: 401 });
  }

  const { token, maxAgeSeconds } = createSessionToken();
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  });

  return NextResponse.json({ ok: true });
}
