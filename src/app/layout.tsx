import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

import Header from "@/components/proteinify/Header";
import FooterCta from "@/components/proteinify/FooterCta";

export const metadata: Metadata = {
  title: "Proteinify",
  description:
    "Protein optimizer for dishes you already love — we track protein per serving and delta, not calories or full macros.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // Browser extensions (e.g. Grammarly) inject attributes on <body> before hydration; suppress avoids noisy mismatch warnings.
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <div className="min-h-dvh flex flex-col">
          <Header />
          <main className="flex-1">{children}</main>
          <FooterCta />
        </div>
      </body>
    </html>
  );
}

