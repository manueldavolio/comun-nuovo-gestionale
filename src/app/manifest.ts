import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Comun Nuovo Calcio",
    short_name: "Comun Nuovo",
    start_url: "/",
    display: "standalone",
    background_color: "#0f2f6f",
    theme_color: "#0f2f6f",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
