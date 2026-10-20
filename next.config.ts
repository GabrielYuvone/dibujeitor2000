import type { NextConfig } from "next";

/**
 * DIBUJEITOR PRO — configuración de Next.js.
 *
 * Los headers COOP/COEP son obligatorios: ffmpeg.wasm en modo multi-hilo
 * necesita SharedArrayBuffer, que los navegadores sólo exponen en contextos
 * cross-origin-isolated.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  /**
   * El preview se sirve desde un host `*.e2b.app`: sin esta lista, Next
   * bloquea los recursos de desarrollo (HMR) y el navegador muestra avisos.
   */
  allowedDevOrigins: ["*.e2b.app", "localhost", "127.0.0.1"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
