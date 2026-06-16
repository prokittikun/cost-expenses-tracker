import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Savings Planner — วางแผนเก็บเงิน",
    short_name: "Savings Planner",
    description: "วางแผนและติดตามการเก็บเงินตามเป้าหมายของคุณ",
    start_url: "/",
    display: "standalone",
    background_color: "#F5F6F8",
    theme_color: "#1B2A4A",
    lang: "th",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/apple-icon.svg", type: "image/svg+xml", sizes: "180x180" },
    ],
  };
}
