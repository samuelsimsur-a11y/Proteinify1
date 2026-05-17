import type { Metadata } from "next";

function normalizeSiteOrigin(raw: string | undefined): string | undefined {
  const s = raw?.trim();
  if (!s) return undefined;
  return s.endsWith("/") ? s.slice(0, -1) : s;
}

const siteOrigin = normalizeSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL);
const privacyContactEmail = process.env.NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL?.trim() ?? "";

/** Renders contact line: real email from env, or literal `[your email]` until configured. */
function ContactEmail({ className }: { className?: string }) {
  const base = "font-medium text-[color:var(--accent)]";
  if (privacyContactEmail) {
    return (
      <a href={`mailto:${privacyContactEmail}`} className={`${base} underline underline-offset-2 hover:opacity-90 ${className ?? ""}`}>
        {privacyContactEmail}
      </a>
    );
  }
  return <span className={`text-[color:var(--text-primary)] ${className ?? ""}`}>[your email]</span>;
}

export const metadata: Metadata = {
  title: "Privacy Policy — Wise Dish",
  description:
    "Privacy policy for Wise Dish: recipe transformations with OpenAI, Microsoft Clarity analytics, local storage, no account required.",
  ...(siteOrigin ? { alternates: { canonical: `${siteOrigin}/privacy` } } : {}),
};

export default function PrivacyPage() {
  return (
    <section className="px-4 py-8">
      <div className="mx-auto w-full max-w-2xl">
        <article className="pf-card p-8 md:p-10">
          <header className="border-b border-[color:var(--divider)] pb-6">
            <h1 className="font-display text-2xl font-bold tracking-tight text-[color:var(--text-primary)] md:text-[1.65rem]">
              Privacy Policy — Wise Dish
            </h1>
            <p className="mt-3 text-sm text-[color:var(--text-muted)]">Last updated: May 2026</p>
          </header>

          <div className="mt-8 space-y-10 text-sm leading-relaxed text-[color:var(--text-muted)]">
            <section>
              <h2 className="font-display text-base font-semibold text-[color:var(--text-primary)]">Overview</h2>
              <p className="mt-3">
                Wise Dish is a recipe transformation tool. We are committed to protecting your privacy.
              </p>
            </section>

            <section>
              <h2 className="font-display text-base font-semibold text-[color:var(--text-primary)]">Data We Collect</h2>
              <p className="mt-3">
                Wise Dish does not collect personal information. No account is required to use the app.
              </p>
            </section>

            <section>
              <h2 className="font-display text-base font-semibold text-[color:var(--text-primary)]">Recipe Processing</h2>
              <p className="mt-3">
                Recipe transformation requests are sent to OpenAI for processing. OpenAI may temporarily retain this data
                for abuse monitoring per their privacy policy at{" "}
                <a
                  href="https://openai.com/privacy"
                  className="font-medium text-[color:var(--accent)] underline underline-offset-2 hover:opacity-90"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  openai.com/privacy
                </a>
                . We do not store your recipe requests on our servers.
              </p>
            </section>

            <section>
              <h2 className="font-display text-base font-semibold text-[color:var(--text-primary)]">Local Storage</h2>
              <p className="mt-3">
                Saved recipes are stored locally on your device only. We cannot access this data. You can delete it at
                any time by clearing the app data on your device.
              </p>
            </section>

            <section>
              <h2 className="font-display text-base font-semibold text-[color:var(--text-primary)]">
                Third Party Services
              </h2>
              <p className="mt-3">
                We use OpenAI to process recipe transformations. We use Vercel to host the application. Neither OpenAI
                nor Vercel receives personally identifiable information from Wise Dish through those services. Microsoft
                Clarity is used for anonymous product analytics as described in the Analytics section.
              </p>
            </section>

            <section>
              <h2 className="font-display text-base font-semibold text-[color:var(--text-primary)]">Analytics</h2>
              <p className="mt-3">
                We use Microsoft Clarity to understand how users interact with Wise Dish. Clarity collects anonymous
                session data including taps, scrolls, and interaction patterns. This data is processed by Microsoft per
                their privacy policy at{" "}
                <a
                  href="https://www.microsoft.com/privacy"
                  className="font-medium text-[color:var(--accent)] underline underline-offset-2 hover:opacity-90"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  microsoft.com/privacy
                </a>
                . No personally identifiable information is collected through Clarity.
              </p>
            </section>

            <section>
              <h2 className="font-display text-base font-semibold text-[color:var(--text-primary)]">
                Children&apos;s Privacy
              </h2>
              <p className="mt-3">
                Wise Dish is not directed at children under 13. We do not knowingly collect data from minors.
              </p>
            </section>

            <section>
              <h2 className="font-display text-base font-semibold text-[color:var(--text-primary)]">Your Rights</h2>
              <p className="mt-3">
                Since we collect no personal data, there is nothing to access, correct, or delete on our end. For
                questions contact: <ContactEmail />
              </p>
            </section>

            <section>
              <h2 className="font-display text-base font-semibold text-[color:var(--text-primary)]">
                Changes to This Policy
              </h2>
              <p className="mt-3">
                We may update this policy as the app evolves. Continued use constitutes acceptance of changes.
              </p>
            </section>

            <section>
              <h2 className="font-display text-base font-semibold text-[color:var(--text-primary)]">Contact</h2>
              <p className="mt-3">
                For privacy questions email: <ContactEmail />
              </p>
            </section>
          </div>
        </article>
      </div>
    </section>
  );
}
