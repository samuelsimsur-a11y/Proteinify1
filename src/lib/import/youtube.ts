const YOUTUBE_VIDEO_ID_RE = /^[a-zA-Z0-9_-]{6,}$/;

export function extractYouTubeVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0] ?? "";
      return YOUTUBE_VIDEO_ID_RE.test(id) ? id : null;
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (u.pathname === "/watch") {
        const id = u.searchParams.get("v") ?? "";
        return YOUTUBE_VIDEO_ID_RE.test(id) ? id : null;
      }
      if (u.pathname.startsWith("/shorts/")) {
        const id = u.pathname.split("/").filter(Boolean)[1] ?? "";
        return YOUTUBE_VIDEO_ID_RE.test(id) ? id : null;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export async function fetchYouTubeDescription(videoId: string): Promise<{
  title: string;
  description: string;
} | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.error("[import] YOUTUBE_API_KEY is not set");
    return null;
  }

  const endpoint = new URL("https://www.googleapis.com/youtube/v3/videos");
  endpoint.searchParams.set("part", "snippet");
  endpoint.searchParams.set("id", videoId);
  endpoint.searchParams.set("fields", "items(snippet(title,description))");
  endpoint.searchParams.set("key", apiKey);

  try {
    const res = await fetch(endpoint.toString(), { cache: "no-store" });
    if (!res.ok) return null;

    const json = (await res.json()) as {
      items?: Array<{ snippet?: { title?: string; description?: string } }>;
    };
    const snippet = json.items?.[0]?.snippet;
    if (!snippet?.title) return null;

    return {
      title: snippet.title,
      description: snippet.description ?? "",
    };
  } catch (err) {
    console.error("[import] YouTube API fetch failed:", err);
    return null;
  }
}
