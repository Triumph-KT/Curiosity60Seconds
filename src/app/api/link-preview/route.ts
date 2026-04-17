import { NextResponse } from "next/server";

function extractMeta(html: string, property: string) {
  const propEscaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `<meta[^>]+(?:property|name)=["']${propEscaped}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    "i",
  );
  return html.match(regex)?.[1] ?? null;
}

function extractTitle(html: string) {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return titleMatch?.[1]?.trim() ?? null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get("url")?.trim();
  if (!rawUrl) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  let url: URL;
  try {
    url = new URL(rawUrl);
    if (!["http:", "https:"].includes(url.protocol)) {
      return NextResponse.json({ error: "Invalid protocol" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  try {
    const res = await fetch(url.toString(), {
      headers: { "user-agent": "Curiosity60Seconds-LinkPreviewBot/1.0" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return NextResponse.json({ error: "Failed to fetch url" }, { status: 400 });
    const html = await res.text();
    const title = extractMeta(html, "og:title") ?? extractTitle(html);
    const description = extractMeta(html, "og:description") ?? extractMeta(html, "description");
    const image = extractMeta(html, "og:image");
    return NextResponse.json({
      url: url.toString(),
      title: title ?? null,
      description: description ?? null,
      image: image ?? null,
    });
  } catch {
    return NextResponse.json({ error: "Preview unavailable" }, { status: 400 });
  }
}
