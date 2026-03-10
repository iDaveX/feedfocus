import type { ReactNode } from "react";
import Script from "next/script";
import Link from "next/link";
import "./globals.css";
import PosthogInit from "@/src/app/PosthogInit";

export const metadata = {
  title: "FeedFocus",
  description: "Анализ фидбека → pain points (CJM) → гипотезы"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      </head>
      <body>
        <main className="container">
          <PosthogInit />
          <div className="topbar">
            <div className="brand">
              <Link href="/">FeedFocus</Link>
            </div>
            <div className="nav">
              <Link href="/">Анализ</Link>
              <Link href="/dashboard">Dashboard</Link>
            </div>
          </div>
          {children}
        </main>
      </body>
    </html>
  );
}
