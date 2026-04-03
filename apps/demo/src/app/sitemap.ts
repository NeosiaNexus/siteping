import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: "https://siteping.dev", lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: "https://siteping.dev/demo", lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
  ];
}
