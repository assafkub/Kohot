import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "כוחות – כדורגל שכונתי",
    short_name: "כוחות",
    description: "חלוקה מאוזנת לקבוצות בכדורגל השכונתי",
    start_url: "/",
    display: "standalone",
    dir: "rtl",
    lang: "he",
    background_color: "#f4f6f3",
    theme_color: "#047857",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
