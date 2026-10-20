/**
 * Plan de exportación (Cap. 15): qué cuadros y con qué parámetros se exporta.
 */

export type ExportFormat = "mp4" | "webm" | "gif" | "png" | "jpeg";

export interface ExportOptions {
  format: ExportFormat;
  width: number;
  height: number;
  fps: number;
  /** Primer cuadro a exportar (inclusive). */
  start: number;
  /** Último cuadro a exportar (inclusive). */
  end: number;
  backgroundColor: string;
  /** Calidad 1 - 100. */
  quality: number;
}

/** Lista de índices de cuadro a exportar, ya acotada y normalizada. */
export function resolveExportFrames(totalFrames: number, options: ExportOptions): number[] {
  if (totalFrames <= 0) return [];

  const start = Math.max(0, Math.min(options.start, options.end));
  const end = Math.min(totalFrames - 1, Math.max(options.start, options.end));

  if (end < start) return [];

  const frames: number[] = [];
  for (let index = start; index <= end; index += 1) {
    frames.push(index);
  }
  return frames;
}

/** Duración estimada de la exportación en segundos. */
export function estimateDuration(frameCount: number, fps: number): number {
  if (fps <= 0) return 0;
  return frameCount / fps;
}

/** Extensión de archivo según el formato. */
export function extensionFor(format: ExportFormat): string {
  switch (format) {
    case "mp4":
      return "mp4";
    case "webm":
      return "webm";
    case "gif":
      return "gif";
    case "png":
      return "png";
    case "jpeg":
      return "jpg";
  }
}

/** MIME type del blob exportado. */
export function mimeFor(format: ExportFormat): string {
  switch (format) {
    case "mp4":
      return "video/mp4";
    case "webm":
      return "video/webm";
    case "gif":
      return "image/gif";
    case "png":
      return "image/png";
    case "jpeg":
      return "image/jpeg";
  }
}
