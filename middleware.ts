import { NextResponse, type NextRequest } from "next/server";

const COOKIE_NAME = "ff_uid";

export function middleware(req: NextRequest) {
  const devUserId = process.env.DEV_USER_ID?.trim();
  const existing = req.cookies.get(COOKIE_NAME)?.value?.trim();

  const value = devUserId || existing || crypto.randomUUID();
  const res = NextResponse.next();

  // Make it readable by the browser (PostHog distinct_id) and sent to API requests.
  if (!existing || (devUserId && existing !== devUserId)) {
    res.cookies.set(COOKIE_NAME, value, {
      path: "/",
      sameSite: "lax",
      httpOnly: false,
      secure: req.nextUrl.protocol === "https:"
    });
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"]
};

