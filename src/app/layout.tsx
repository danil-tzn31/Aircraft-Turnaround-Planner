import type { Metadata } from "next";
import { Barlow } from "next/font/google";
import Link from "next/link";
import "./globals.css";

// Barlow takes after highway and airport signage. Not a variable font, so weights are listed.
const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const SITE_NAME = "Aircraft Turnaround Planner";
const TAGLINE = "See how delays move an aircraft's departure, using critical path scheduling.";

export const metadata: Metadata = {
  metadataBase: new URL("https://aircraft-turnaround-planner.vercel.app"),
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: TAGLINE,
  applicationName: SITE_NAME,
  openGraph: { title: SITE_NAME, description: TAGLINE, siteName: SITE_NAME, type: "website" },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${barlow.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="border-b border-line bg-panel">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm font-semibold tracking-wide text-ink uppercase hover:text-accent-text"
            >
              <span aria-hidden className="inline-block h-3 w-3 rounded-sm border border-critical-ink bg-critical" />
              {SITE_NAME}
            </Link>
            <Link
              href="/about"
              className="text-sm font-semibold tracking-wide text-muted uppercase hover:text-accent-text"
            >
              About
            </Link>
          </div>
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
