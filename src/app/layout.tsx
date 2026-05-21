import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import "./globals.css";

import AppVersionReload from "@/components/AppVersionReload";
import Header from "@/components/wisedish/Header";
import FooterCta from "@/components/wisedish/FooterCta";

export const metadata: Metadata = {
  title: "Wise Dish",
  description:
    "Wise Dish transforms dishes you already enjoy into higher-protein, practical recipes — same dish logic, clearer trade-offs.",
};

/** Wise Dish production Clarity project. Override with `NEXT_PUBLIC_CLARITY_PROJECT_ID`; set `NEXT_PUBLIC_CLARITY_DISABLED=true` to omit. */
const DEFAULT_CLARITY_PROJECT_ID = "wpkobycjfy";

function resolveClarityProjectId(): string {
  if (process.env.NEXT_PUBLIC_CLARITY_DISABLED === "true") return "";
  const fromEnv = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID?.trim();
  if (fromEnv === "false" || fromEnv === "0") return "";
  return fromEnv || DEFAULT_CLARITY_PROJECT_ID;
}

const clarityProjectId = resolveClarityProjectId();

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

