export function isTikTokUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    return host.includes("tiktok.com");
  } catch {
    return false;
  }
}

export async function fetchTikTokCaption(url: string): Promise<{
  caption: string;
  authorName: string;
  canonicalUrl: string;
} | null> {
  try {
    // Resolve vm.tiktok short links to canonical /@user/video/... URLs first.
    let resolvedUrl = url;
    try {
      const head = await fetch(url, { method: "HEAD", redirect: "follow", cache: "no-store" });
      if (head.url) resolvedUrl = head.url;
    } catch {
      /* keep original URL */
    }

    const endpoint = new URL("https://www.tiktok.com/oembed");
    endpoint.searchParams.set("url", resolvedUrl);
    const res = await fetch(endpoint.toString(), { cache: "no-store" });
    if (!res.ok) return null;

    const json = (await res.json()) as {
      title?: string;
      author_name?: string;
      author_url?: string;
    };
    const caption = (json.title ?? "").trim();
    const authorName = (json.author_name ?? "").trim();
    if (!caption) return null;
    return { caption, authorName, canonicalUrl: resolvedUrl };
  } catch (err) {
    console.error("[import] TikTok oEmbed fetch failed:", err);
    return null;
  }
}
