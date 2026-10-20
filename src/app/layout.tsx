import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "DIBUJEITOR TV",
  description:
    "Editor de animación 2D cuadro a cuadro con instancias, celdas de exposición y Light Table — Escuela Para Animadores de Rosario",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#26282e",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <body className="h-full overflow-hidden bg-background text-foreground">{children}</body>
    </html>
  );
}
