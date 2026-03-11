import { NextResponse, type NextRequest } from "next/server";

const COOKIE_NAME = "ff_uid";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function middleware(req: NextRequest) {
  const devUserId = process.env.DEV_USER_ID?.trim();
  const incomingHeader = req.headers.get("x-ff-uid")?.trim();
  const existing = req.cookies.get(COOKIE_NAME)?.value?.trim();

  const value = devUserId || incomingHeader || existing || crypto.randomUUID();
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-ff-uid", value);
  const res = NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });

  // Make it readable by the browser (PostHog distinct_id) and sent to API requests.
  // Always (re)sets to ensure a long-lived cookie (migrates old session cookies to persistent).
  res.cookies.set(COOKIE_NAME, value, {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    secure: req.nextUrl.protocol === "https:",
    maxAge: ONE_YEAR_SECONDS
  });

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"]
};
