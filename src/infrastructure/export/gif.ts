/**
 * Exportación a GIF animado con `gifenc`.
 */

import { GIFEncoder, applyPalette, quantize } from "gifenc";

import { resolveExportFrames, type ExportOptions } from "@/domain/export/plan";
import type { Project } from "@/domain/project/model";
import { projectDuration } from "@/domain/timeline/instances";
import { renderFrameCanvas } from "@/infrastructure/export/frameRenderer";

export type ProgressCallback = (ratio: number) => void;

export async function exportGif(
  project: Project,
  options: ExportOptions,
  onProgress?: ProgressCallback,
): Promise<Blob> {
  const frames = resolveExportFrames(projectDuration(project.layers), options);
  const encoder = GIFEncoder();

  for (const [position, frameIndex] of frames.entries()) {
    const canvas = renderFrameCanvas(
      project,
      frameIndex,
      options.width,
      options.height,
      options.backgroundColor,
    );
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const palette = quantize(imageData.data, 256);
    const indexed = applyPalette(imageData.data, palette);

    encoder.writeFrame(indexed, canvas.width, canvas.height, {
      palette,
      delay: Math.round(1000 / Math.max(1, options.fps)),
      repeat: 0,
    });

    onProgress?.((position + 1) / Math.max(1, frames.length));
    // Cede el hilo para que la interfaz pueda actualizar la barra de progreso.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  encoder.finish();
  return new Blob([encoder.bytes() as BlobPart], { type: "image/gif" });
}
