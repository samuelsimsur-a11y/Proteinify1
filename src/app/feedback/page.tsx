"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

type SearchRecord = Record<string, string | string[] | undefined>;

function pick(sp: SearchRecord, key: string): string {
  const v = sp[key];
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

function FeedbackContent() {
  const sp = useSearchParams();
  const searchParams: SearchRecord = {
    resultId: sp.get("resultId") ?? undefined,
    dish: sp.get("dish") ?? undefined,
    version: sp.get("version") ?? undefined,
    rating: sp.get("rating") ?? undefined,
    tag: sp.get("tag") ?? undefined,
  };
  const resultId = pick(searchParams, "resultId");
  const dish = pick(searchParams, "dish");
  const version = pick(searchParams, "version");
  const rating = pick(searchParams, "rating");
  const tag = pick(searchParams, "tag");

  return (
    <div className="px-4 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <div className="pf-card p-6">
          <h1 className="font-display text-lg font-semibold text-[color:var(--text-primary)]">Feedback</h1>
          <p className="mt-2 text-sm text-[color:var(--text-muted)]">
            Thanks. Nothing is stored on our side — this page echoes the link parameters so you can paste them into your
            feedback workflow.
          </p>

          <p className="mt-3 text-sm text-[color:var(--text-muted)]">
            Help us make every dish better.
          </p>

          <div className="mt-4 grid gap-2 text-sm">
            <div>
              <span className="font-semibold text-[color:var(--text-primary)]">resultId:</span> {resultId}
            </div>
            <div>
              <span className="font-semibold text-[color:var(--text-primary)]">dish:</span> {dish}
            </div>
            <div>
              <span className="font-semibold text-[color:var(--text-primary)]">version:</span> {version}
            </div>
            <div>
              <span className="font-semibold text-[color:var(--text-primary)]">rating:</span> {rating}
            </div>
            {tag ? (
              <div>
                <span className="font-semibold text-[color:var(--text-primary)]">tag:</span> {tag}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FeedbackPage() {
  return (
    <Suspense fallback={<div className="px-4 py-10" />}>
      <FeedbackContent />
    </Suspense>
  );
}
