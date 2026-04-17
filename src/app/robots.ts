import type { MetadataRoute } from "next";
import { getAppBaseUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/admin",
          "/settings",
          "/new",
          "/onboarding",
          "/messages",
          "/notifications",
          "/api",
        ],
      },
    ],
    sitemap: `${getAppBaseUrl().replace(/\/+$/, "")}/sitemap.xml`,
  };
}
