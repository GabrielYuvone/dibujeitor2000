/**
 * Orquestador de exportación (Cap. 15).
 */

import { extensionFor, mimeFor, resolveExportFrames, type ExportOptions } from "@/domain/export/plan";
import type { Project } from "@/domain/project/model";
import { projectDuration } from "@/domain/timeline/instances";
import { exportGif, type ProgressCallback } from "@/infrastructure/export/gif";
import { exportWebm } from "@/infrastructure/export/webm";
import { exportMp4 } from "@/infrastructure/export/mp4";
import { renderFrameCanvas, canvasToBlob } from "@/infrastructure/export/frameRenderer";

export interface ExportResult {
  blob: Blob;
  filename: string;
  mimeType: string;
}

/** Exporta el proyecto completo según el formato pedido. */
export async function exportProject(
  project: Project,
  options: ExportOptions,
  onProgress?: ProgressCallback,
  audioBlob?: Blob,
): Promise<ExportResult> {
  const extension = extensionFor(options.format);
  const mimeType = mimeFor(options.format);
  const filename = `${project.name.replace(/[^\w\-]+/g, "_")}.${extension}`;

  switch (options.format) {
    case "gif": {
      const blob = await exportGif(project, options, onProgress);
      return { blob, filename, mimeType };
    }
    case "webm": {
      const blob = await exportWebm(project, options, onProgress);
      return { blob, filename, mimeType };
    }
    case "mp4": {
      const blob = await exportMp4(project, options, onProgress, audioBlob);
      return { blob, filename, mimeType };
    }
    case "png":
    case "jpeg": {
      const blob = await exportImageSequence(project, options, onProgress);
      return { blob, filename, mimeType };
    }
  }
}

/**
 * Secuencia de imágenes: se descargan cuadro por cuadro con nombre numerado.
 * (Exportar un ZIP completo queda pendiente para una versión posterior.)
 */
export async function exportImageSequence(
  project: Project,
  options: ExportOptions,
  onProgress?: ProgressCallback,
): Promise<Blob> {
  const frames = resolveExportFrames(projectDuration(project.layers), options);
  const type = options.format === "jpeg" ? "image/jpeg" : "image/png";
  const quality = options.quality / 100;
  const last: Blob[] = [];

  for (const [position, frameIndex] of frames.entries()) {
    const canvas = renderFrameCanvas(
      project,
      frameIndex,
      options.width,
      options.height,
      options.backgroundColor,
    );
    const blob = await canvasToBlob(canvas, type, quality);
    last.push(blob);

    const name = `${project.name.replace(/[^\w\-]+/g, "_")}-${String(frameIndex + 1).padStart(4, "0")}.${
      options.format === "jpeg" ? "jpg" : "png"
    }`;
    downloadBlob(blob, name);

    onProgress?.((position + 1) / Math.max(1, frames.length));
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  return last[last.length - 1] ?? new Blob([], { type });
}

/** Descarga un blob en el navegador. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
