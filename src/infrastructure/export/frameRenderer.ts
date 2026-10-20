/**
 * Renderizado de cuadros para exportación.
 */

import { renderProject } from "@/infrastructure/canvas/tvRenderer";
import type { Project } from "@/domain/project/model";

export interface RenderedFrame {
  canvas: HTMLCanvasElement;
  blob: Blob;
  index: number;
}

/** Renderiza un cuadro del proyecto en el tamaño pedido. */
export function renderFrameCanvas(
  project: Project,
  frameIndex: number,
  width: number,
  height: number,
  backgroundColor?: string,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));

  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const scaleX = canvas.width / project.settings.width;
  const scaleY = canvas.height / project.settings.height;
  ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);

  renderProject(ctx, project, frameIndex, { backgroundColor });
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("No se pudo generar la imagen"))),
      type,
      quality,
    );
  });
}

/** Exporta el cuadro actual como PNG o JPEG. */
export async function exportSingleFrame(
  project: Project,
  frameIndex: number,
  format: "png" | "jpeg",
  quality = 0.92,
): Promise<Blob> {
  const canvas = renderFrameCanvas(
    project,
    frameIndex,
    project.settings.width,
    project.settings.height,
  );
  return canvasToBlob(canvas, format === "jpeg" ? "image/jpeg" : "image/png", quality);
}
