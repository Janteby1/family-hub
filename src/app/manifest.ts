import type { MetadataRoute } from "next";
import { APP_NAME } from "@/lib/app-name";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    // Home-screen labels truncate fast — "Anteby Family Hub" fits better
    // as just "Anteby" under the icon than the full name would.
    short_name: APP_NAME.split(" ")[0],
    start_url: "/",
    display: "standalone",
    background_color: "#fbf7f0",
    theme_color: "#c15a26",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
