import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import "./globals.css";

import AppVersionReload from "@/components/AppVersionReload";
import Header from "@/components/proteinify/Header";
import FooterCta from "@/components/proteinify/FooterCta";

export const metadata: Metadata = {
  title: "Wise Dish",
  description:
    "Wise Dish helps you transform dishes you already love into higher-protein versions with clear trade-offs.",
};

const clarityProjectId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID?.trim();

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // Browser extensions (e.g. Grammarly) inject attributes on <body> before hydration; suppress avoids noisy mismatch warnings.
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {clarityProjectId ? (
          <Script
            id="microsoft-clarity"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                (function(c,l,a,r,i,t,y){
                  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
                })(window, document, "clarity", "script", "${clarityProjectId}");
              `,
            }}
          />
        ) : null}
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

