import type { Metadata } from "next";
import { DemoSite } from "@/components/demo/demo-site";
import { WidgetInit } from "./widget-init";

export const metadata: Metadata = {
  title: "Live Demo",
  description: "Try SitePing live — draw annotations, leave comments, directly on a demo website.",
  openGraph: {
    title: "SitePing — Live Demo",
    description: "Try SitePing live — draw annotations, leave comments, directly on a demo website.",
    url: "https://siteping.dev/demo",
  },
};

export default function DemoPage() {
  return (
    <>
      <WidgetInit />
      <DemoSite />
    </>
  );
}
