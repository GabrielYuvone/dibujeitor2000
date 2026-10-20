/**
 * Operaciones sobre la capa rasterizada: relleno por inundación, copia y
 * pegado de selecciones.
 *
 * El modelo del proyecto guarda trazos (datos), pero el relleno, la
 * eyedropper y el portapapeles necesitan píxeles. Este módulo es el puente:
 * rasteriza la capa, opera sobre píxeles y devuelve un trazo de mapa de bits
 * que se puede guardar en el proyecto.
 */

import { floodFill } from "@/domain/fill/floodFill";
import { parseHex } from "@/domain/color/hex";
import { createId } from "@/domain/brush/stroke";
import { DEFAULT_BRUSH_SETTINGS, type BitmapPayload, type BrushSettings, type Stroke } from "@/domain/brush/types";
import type { ClipImage, Project } from "@/domain/project/model";
import { imageIdAtFrame } from "@/domain/timeline/instances";
import { paintStrokes } from "@/infrastructure/canvas/tvRenderer";

export interface RasterLayer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

/** Rasteriza el contenido de una capa en el cuadro indicado. */
export function rasterizeLayer(
  project: Project,
  frameIndex: number,
  layerId: string,
): RasterLayer | null {
  const layer = project.layers.find((item) => item.id === layerId);
  if (!layer) return null;
  const imageId = imageIdAtFrame(layer, frameIndex);
  const image = imageId ? project.images[imageId] : undefined;

  const canvas = document.createElement("canvas");
  canvas.width = project.settings.width;
  canvas.height = project.settings.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  if (image) paintStrokes(ctx, image.strokes);
  return { canvas, ctx };
}

/** Rasteriza una imagen concreta del proyecto. */
export function rasterizeImageOf(project: Project, imageId: string): RasterLayer | null {
  const image: ClipImage | undefined = project.images[imageId];
  const canvas = document.createElement("canvas");
  canvas.width = project.settings.width;
  canvas.height = project.settings.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  if (image) paintStrokes(ctx, image.strokes);
  return { canvas, ctx };
}

/** Convierte un canvas en un payload de mapa de bits. */
export function canvasToBitmap(canvas: HTMLCanvasElement): BitmapPayload {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return { width: canvas.width, height: canvas.height, data: new Uint8ClampedArray(4) };
  }
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { width: canvas.width, height: canvas.height, data: imageData.data };
}

/** Crea un trazo de mapa de bits a partir de un canvas. */
export function createBitmapStroke(
  source: HTMLCanvasElement,
  settings: Partial<BrushSettings> = {},
  origin: { x: number; y: number } = { x: 0, y: 0 },
): Stroke {
  const ctx = source.getContext("2d");
  const bitmap: BitmapPayload = ctx
    ? canvasToBitmap(source)
    : { width: source.width, height: source.height, data: new Uint8ClampedArray(4) };

  return {
    id: createId("stroke"),
    kind: "bitmap",
    tool: "bitmap",
    points: [{ x: origin.x, y: origin.y, pressure: 0.5, t: 0 }],
    settings: { ...DEFAULT_BRUSH_SETTINGS, ...settings },
    seed: 1,
    composite: "source-over",
    createdAt: Date.now(),
    bitmap,
  };
}

export interface FillOutcome {
  stroke: Stroke | null;
  filledPixels: number;
}

/**
 * Aplica el relleno por inundación sobre una capa rasterizada.
 *
 * Devuelve un trazo de mapa de bits que contiene **sólo la región rellenada**
 * (el diferencial contra el dibujo original). Ese trazo se *añade* a los
 * trazos vectoriales de la imagen en lugar de reemplazarlos: así el
 * dibujo sigue siendo vectorial y el undo devuelve el estado anterior.
 */
export function applyFloodFill(
  project: Project,
  frameIndex: number,
  layerId: string,
  x: number,
  y: number,
  colorHex: string,
  tolerance: number,
): FillOutcome {
  const raster = rasterizeLayer(project, frameIndex, layerId);
  const rgb = parseHex(colorHex);
  if (!raster || !rgb) return { stroke: null, filledPixels: 0 };

  const width = raster.canvas.width;
  const height = raster.canvas.height;
  const imageData = raster.ctx.getImageData(0, 0, width, height);
  const original = imageData.data;
  const result = floodFill(
    { width, height, data: original },
    Math.floor(x),
    Math.floor(y),
    rgb,
    tolerance,
  );

  if (!result.changed) return { stroke: null, filledPixels: 0 };

  // Diferencial: sólo los píxeles que el relleno cambió, con el color nuevo.
  const filled = result.buffer.data;
  const patch = new Uint8ClampedArray(filled.length);
  for (let i = 0; i < filled.length; i += 4) {
    const changed =
      filled[i] !== original[i] ||
      filled[i + 1] !== original[i + 1] ||
      filled[i + 2] !== original[i + 2] ||
      filled[i + 3] !== original[i + 3];
    if (changed) {
      patch[i] = filled[i];
      patch[i + 1] = filled[i + 1];
      patch[i + 2] = filled[i + 2];
      patch[i + 3] = filled[i + 3];
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { stroke: null, filledPixels: 0 };
  ctx.putImageData(new ImageData(patch, width, height), 0, 0);

  return {
    stroke: createBitmapStroke(canvas, { color: colorHex }),
    filledPixels: result.filled,
  };
}

/** Muestrea el color de un punto del lienzo. */
export function sampleColorAt(
  project: Project,
  frameIndex: number,
  x: number,
  y: number,
  layerId?: string,
): string | null {
  const raster = rasterizeLayer(project, frameIndex, layerId ?? project.layers[0]?.id ?? "");
  if (!raster) return null;
  const px = Math.floor(x);
  const py = Math.floor(y);
  if (px < 0 || py < 0 || px >= raster.canvas.width || py >= raster.canvas.height) return null;

  const data = raster.ctx.getImageData(px, py, 1, 1).data;
  const hex = `#${[data[0], data[1], data[2]]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
  return hex;
}

/** Extrae la región seleccionada como bitmap. */
export function extractRegion(
  project: Project,
  frameIndex: number,
  layerId: string,
  region: { x: number; y: number; width: number; height: number },
): BitmapPayload | null {
  const raster = rasterizeLayer(project, frameIndex, layerId);
  if (!raster) return null;

  const x = Math.max(0, Math.floor(region.x));
  const y = Math.max(0, Math.floor(region.y));
  const width = Math.max(1, Math.floor(region.width));
  const height = Math.max(1, Math.floor(region.height));

  const data = raster.ctx.getImageData(x, y, width, height).data;
  return { width, height, data };
}
