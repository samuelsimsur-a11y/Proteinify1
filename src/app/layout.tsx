import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

import AppVersionReload from "@/components/AppVersionReload";
import Header from "@/components/proteinify/Header";
import FooterCta from "@/components/proteinify/FooterCta";

export const metadata: Metadata = {
  title: "FoodZap",
  description:
    "FoodZap helps you transform dishes you already love into higher-protein versions with clear trade-offs.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // Browser extensions (e.g. Grammarly) inject attributes on <body> before hydration; suppress avoids noisy mismatch warnings.
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <div className="min-h-dvh flex flex-col">
          <AppVersionReload />
          <Header />
          <main className="flex-1">{children}</main>
          <FooterCta />
        </div>
      </body>
    </html>
  );
}

