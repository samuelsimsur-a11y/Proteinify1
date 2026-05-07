import type { Metadata } from "next";

function normalizeSiteOrigin(raw: string | undefined): string | undefined {
  const s = raw?.trim();
  if (!s) return undefined;
  return s.endsWith("/") ? s.slice(0, -1) : s;
}

const siteOrigin = normalizeSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL);

/** Set `NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL` in production (required for reviewers). */
const privacyContactEmail = process.env.NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL?.trim() ?? "";

const LAST_UPDATED_DISPLAY = "May 7, 2026";

export const metadata: Metadata = {
  title: "Privacy policy — Wise Dish",
  description:
    "Wise Dish privacy policy — no account required, local recipe storage, and OpenAI processing for recipe transformations.",
  ...(siteOrigin ? { alternates: { canonical: `${siteOrigin}/privacy` } } : {}),
};

export default function PrivacyPage() {
  return (
    <section className="px-4 py-8">
      <div className="mx-auto w-full max-w-3xl">
        <div className="pf-card p-6">
          <h1 className="font-display text-xl font-bold text-[color:var(--text-primary)]">Privacy policy</h1>
          <p className="mt-2 text-xs text-[color:var(--text-muted)]">Last updated: {LAST_UPDATED_DISPLAY}</p>
          <p className="mt-3 text-sm leading-relaxed text-[color:var(--text-muted)]">
            Wise Dish is designed to be privacy-first.
          </p>

          <div className="mt-5 space-y-4 text-sm leading-relaxed text-[color:var(--text-muted)]">
            <p>
              <span className="font-semibold text-[color:var(--text-primary)]">Public access:</span> You can read this
              privacy policy in any browser without installing the app, signing in, or creating an account. It is not
              behind a login wall on either the website or inside the mobile app.
            </p>

            {siteOrigin ? (
              <p>
                <span className="font-semibold text-[color:var(--text-primary)]">Public URL for store listings:</span>{" "}
                <a
                  href={`${siteOrigin}/privacy`}
                  className="font-semibold text-[color:var(--accent)] underline underline-offset-2 hover:opacity-90"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {`${siteOrigin}/privacy`}
                </a>
              </p>
            ) : (
              <p>
                <span className="font-semibold text-[color:var(--text-primary)]">Public URL for store listings:</span>{" "}
                Set{" "}
                <code className="rounded bg-black/5 px-1.5 py-0.5 text-[color:var(--text-primary)] dark:bg-white/10">
                  NEXT_PUBLIC_SITE_URL
                </code>{" "}
                on your deployment so this page prints the exact HTTPS address for forms such as Google Play.
              </p>
            )}

            <p>
              Wise Dish does not collect personal information. No account is required.
            </p>

            <p>
              Recipe transformation requests are sent to OpenAI for processing. OpenAI may temporarily retain this data
              per their privacy policy at{" "}
              <a
                href="https://openai.com/privacy"
                className="font-semibold text-[color:var(--accent)] underline underline-offset-2 hover:opacity-90"
                rel="noopener noreferrer"
                target="_blank"
              >
                openai.com/privacy
              </a>
              . We do not store your recipe requests on our servers.
            </p>

            <p>Saved recipes are stored locally on your device only. We cannot access this data.</p>

            <p>
              <span className="font-semibold text-[color:var(--text-primary)]">Website analytics:</span> The public
              website may load Microsoft Clarity only when configured by the operator. Clear your browser/app data if
              you want to discard local telemetry cookies from providers you use outside Wise Dish core features.
            </p>

            <p>
              <span className="font-semibold text-[color:var(--text-primary)]">Contact:</span> For privacy questions,
              email{" "}
              {privacyContactEmail ? (
                <a
                  href={`mailto:${privacyContactEmail}`}
                  className="font-semibold text-[color:var(--accent)] underline underline-offset-2 hover:opacity-90"
                >
                  {privacyContactEmail}
                </a>
              ) : (
                <>
                  <span className="text-[color:var(--accent)] font-semibold">[configured at deploy]</span> — add{" "}
                  <code className="rounded bg-black/5 px-1 py-0.5 text-[color:var(--text-primary)] dark:bg-white/10">
                    NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL
                  </code>{" "}
                  to production environment variables before publishing store listings.
                </>
              )}
              .
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
