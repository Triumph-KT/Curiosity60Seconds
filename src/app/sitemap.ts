import type { MetadataRoute } from "next";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { absoluteUrl } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const service = await createSupabaseServiceClient();
  const [{ data: users }, { data: posts }] = await Promise.all([
    service
      .from("users")
      .select("username,created_at")
      .eq("onboarded", true)
      .eq("status", "active")
      .not("username", "is", null),
    service
      .from("posts")
      .select("slug,published_at,updated_at,users!inner(username,onboarded,status)")
      .eq("status", "published")
      .eq("users.onboarded", true)
      .eq("users.status", "active"),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1.0 },
    { url: absoluteUrl("/people"), changeFrequency: "daily", priority: 0.9 },
    { url: absoluteUrl("/feed"), changeFrequency: "hourly", priority: 0.9 },
  ];

  const profileRoutes: MetadataRoute.Sitemap = (users ?? []).map((u) => ({
    url: absoluteUrl(`/u/${u.username}`),
    lastModified: u.created_at ? new Date(u.created_at) : undefined,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const postRoutes: MetadataRoute.Sitemap = (posts ?? []).map((p) => {
    const userRaw = p.users as { username: string } | Array<{ username: string }> | null;
    const user = Array.isArray(userRaw) ? userRaw[0] ?? null : userRaw;
    return {
      url: absoluteUrl(`/u/${user?.username ?? "unknown"}/${p.slug}`),
      lastModified: p.updated_at ? new Date(p.updated_at) : p.published_at ? new Date(p.published_at) : undefined,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    };
  });

  return [...staticRoutes, ...profileRoutes, ...postRoutes];
}
