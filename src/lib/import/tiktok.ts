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
} | null> {
  try {
    const endpoint = new URL("https://www.tiktok.com/oembed");
    endpoint.searchParams.set("url", url);
    const res = await fetch(endpoint.toString(), { cache: "no-store" });
    if (!res.ok) return null;

    const json = (await res.json()) as {
      title?: string;
      author_name?: string;
    };
    const caption = (json.title ?? "").trim();
    const authorName = (json.author_name ?? "").trim();
    if (!caption) return null;
    return { caption, authorName };
  } catch (err) {
    console.error("[import] TikTok oEmbed fetch failed:", err);
    return null;
  }
}
