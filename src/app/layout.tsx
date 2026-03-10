import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";
import PosthogInit from "@/src/app/PosthogInit";

export const metadata = {
  title: "FeedFocus",
  description: "Анализ фидбека → pain points (CJM) → гипотезы"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY || "";
  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

  return (
    <html lang="ru">
      <body>
        <main className="container">
          <PosthogInit apiKey={posthogKey} apiHost={posthogHost} />
          <div className="topbar">
            <div className="brand">
              <Link href="/">FeedFocus</Link>
            </div>
            <div className="nav">
              <Link href="/">Анализ</Link>
              <Link href="/dashboard">Дашборд</Link>
            </div>
          </div>
          {children}
        </main>
      </body>
    </html>
  );
}
