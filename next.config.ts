import type { NextConfig } from "next";

/**
 * CSP mirata: consente solo iframe Tuttocampo WidgetV2 sulle pagine genitori squadra.
 * Non imposta default-src (evita di spezzare script/immagini esistenti).
 */
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/genitore/squadra",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-src 'self' https://www.tuttocampo.it",
          },
        ],
      },
      {
        source: "/dev/squadra-widgets-lab",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-src 'self' https://www.tuttocampo.it",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
