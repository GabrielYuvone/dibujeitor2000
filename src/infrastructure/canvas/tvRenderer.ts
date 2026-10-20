/**
 * Renderizador del proyecto (edición TVPaint-like).
 *
 * TVPaint apila las capas como acetatos: cada capa es una lámina
 * transparente que se ve sobre la de abajo. La Light Table se aplica **por
 * capa**: cada capa tiene su propia bombilla, y al activarla se ven sus
 * cuadros vecinos teñidos (verde el pasado, naranja el futuro).
 */

import { buildDabs } from "@/domain/brush/dabs";
import type { Dab, Stroke } from "@/domain/brush/types";
import {
  buildLightTable,
  type LightTableEntry,
  type LightTableSettings,
} from "@/domain/lighttable/lightTable";
import type { ClipImage, Layer, Project } from "@/domain/project/model";
import { frameToInstanceIndex, imageIdAtFrame, projectDuration } from "@/domain/timeline/instances";

/* --- Caché de capas rasterizadas (clave: imagen + identidad de sus trazos) --- */

const layerCache = new Map<string, HTMLCanvasElement>();
const LAYER_CACHE_LIMIT = 64;

export function clearLayerCache(): void {
  layerCache.clear();
}

/**
 * Clave de caché de una imagen.
 *
 * Se basa en la **identidad de los trazos**, no en cuántos hay: si se
 * sustituye un trazo por otro (por ejemplo al rellenar) la clave anterior
 * volvería a ser válida y el render mostraría un dibujo obsoleto.
 */
function cacheKey(imageId: string, strokes: { id: string }[]): string {
  return `${imageId}#${strokes.map((stroke) => stroke.id).join(".")}`;
}

function drawDab(ctx: CanvasRenderingContext2D, dab: Dab): void {
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, dab.alpha));
  ctx.fillStyle = dab.color;
  ctx.translate(dab.x, dab.y);
  ctx.rotate(dab.angle);
  if (dab.shape === "square") {
    ctx.fillRect(-dab.radius, -dab.radius, dab.radius * 2, dab.radius * 2);
  } else {
    ctx.beginPath();
    ctx.ellipse(0, 0, Math.max(0.1, dab.radius * dab.aspect), Math.max(0.1, dab.radius), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function paintStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  if (stroke.kind === "bitmap" && stroke.bitmap) {
    const source = document.createElement("canvas");
    source.width = stroke.bitmap.width;
    source.height = stroke.bitmap.height;
    const sourceCtx = source.getContext("2d");
    if (sourceCtx) {
      const imageData = sourceCtx.createImageData(stroke.bitmap.width, stroke.bitmap.height);
      imageData.data.set(stroke.bitmap.data);
      sourceCtx.putImageData(imageData, 0, 0);
    }
    const point = stroke.points[0];
    if (point) {
      ctx.save();
      ctx.globalAlpha = stroke.settings.opacity;
      ctx.drawImage(source, point.x, point.y);
      ctx.restore();
    }
    return;
  }

  if (stroke.kind === "shape") {
    if (stroke.points.length < 2) return;
    ctx.save();
    ctx.globalCompositeOperation = stroke.composite;
    ctx.globalAlpha = stroke.settings.opacity;
    ctx.fillStyle = stroke.settings.color;
    ctx.strokeStyle = stroke.settings.color;
    ctx.lineWidth = Math.max(0.5, stroke.settings.size);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let index = 1; index < stroke.points.length; index += 1) {
      ctx.lineTo(stroke.points[index].x, stroke.points[index].y);
    }
    if (stroke.filled) {
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  const dabs = buildDabs({
    tool: stroke.tool,
    points: stroke.points,
    settings: stroke.settings,
    seed: stroke.seed,
  });
  ctx.save();
  ctx.globalCompositeOperation = stroke.composite;
  for (const dab of dabs) drawDab(ctx, dab);
  ctx.restore();
}

/** Pinta una lista de trazos respetando su orden. */
export function paintStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[]): void {
  for (const stroke of strokes) paintStroke(ctx, stroke);
}

/**
 * Tope de píxeles de una capa rasterizada.
 *
 * Un lienzo de 16000×16000 son 256 megapíxeles: 1 GB por capa. Se rasteriza
 * con un factor de reducción y se estira al tamaño real al componer, así el
 * editor sigue siendo usable con cualquier medida.
 */
export const MAX_RASTER_PIXELS = 8_388_608; // 2896×2896

/** Factor de reducción para no superar el tope de píxeles. */
export function rasterScaleFor(width: number, height: number): number {
  const pixels = width * height;
  if (pixels <= MAX_RASTER_PIXELS) return 1;
  return Math.sqrt(MAX_RASTER_PIXELS / pixels);
}

/** Rasteriza una imagen del proyecto a un canvas del tamaño del proyecto. */
export function rasterizeImage(
  image: ClipImage | undefined,
  width: number,
  height: number,
): HTMLCanvasElement {
  const scale = rasterScaleFor(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  if (image) {
    ctx.save();
    ctx.scale(scale, scale);
    paintStrokes(ctx, image.strokes);
    ctx.restore();
  }
  return canvas;
}

/** Canvas cacheado de una imagen del proyecto. */
function imageCanvas(project: Project, imageId: string): HTMLCanvasElement | null {
  const image = project.images[imageId];
  if (!image) return null;
  const key = cacheKey(image.id, image.strokes);
  const cached = layerCache.get(key);
  if (cached) return cached;
  const canvas = rasterizeImage(image, project.settings.width, project.settings.height);
  if (layerCache.size >= LAYER_CACHE_LIMIT) layerCache.clear();
  layerCache.set(key, canvas);
  return canvas;
}

/** Entradas de Light Table que corresponden a una capa. */
export function lightTableEntriesForLayer(
  layer: Layer,
  settings: LightTableSettings,
  currentFrame: number,
  totalFrames: number,
): LightTableEntry[] {
  if (!layer.lightTable || !settings.enabled) return [];
  return buildLightTable(settings, {
    currentFrame,
    totalFrames,
    imageIdAt: (frame) => imageIdAtFrame(layer, frame),
    instanceIdAt: (frame) => {
      const index = frameToInstanceIndex(layer, frame);
      return layer.instances[index]?.id ?? null;
    },
  });
}

export interface TvRenderOptions {
  lightTable?: LightTableSettings;
  /** Trazo en curso que todavía no está en el store. */
  draft?: Stroke | null;
  backgroundColor?: string;
  /** Dibuja la textura de papel. */
  papers?: boolean;
  /** Muestra la grilla de thirds. */
  guides?: boolean;
  width?: number;
  height?: number;
}

/**
 * Renderiza el proyecto completo en el cuadro indicado.
 */
export function renderProject(
  ctx: CanvasRenderingContext2D,
  project: Project,
  frameIndex: number,
  options: TvRenderOptions = {},
): void {
  const width = options.width ?? project.settings.width;
  const height = options.height ?? project.settings.height;
  const backgroundColor = options.backgroundColor ?? project.settings.backgroundColor;
  const totalFrames = Math.max(1, projectDuration(project.layers));

  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, width, height);

  if (options.papers) {
    drawPaperTexture(ctx, width, height);
  }

  const onionEntries: { layer: Layer; entries: LightTableEntry[] }[] = [];
  if (options.lightTable) {
    for (const layer of project.layers) {
      if (!layer.visible) continue;
      const entries = lightTableEntriesForLayer(layer, options.lightTable, frameIndex, totalFrames);
      if (entries.length > 0) onionEntries.push({ layer, entries });
    }
  }

  // 1) Papel cebolla: primero el fondo de cada capa, con su tinte.
  for (const { layer, entries } of onionEntries) {
    for (const entry of entries) {
      const imageId = imageIdAtFrame(layer, entry.frame);
      if (!imageId) continue;
      const source = imageCanvas(project, imageId);
      if (!source) continue;

      const tinted = tintCanvas(source, entry.tint, width, height);
      ctx.save();
      ctx.globalAlpha = entry.opacity * layer.opacity;
      ctx.drawImage(tinted, 0, 0, width, height);
      ctx.restore();
    }
  }

  // 2) Contenido actual de cada capa, de abajo hacia arriba.
  for (const layer of project.layers) {
    if (!layer.visible) continue;
    const imageId = imageIdAtFrame(layer, frameIndex);
    if (!imageId) continue;
    const source = imageCanvas(project, imageId);
    if (!source) continue;
    ctx.save();
    ctx.globalAlpha = layer.opacity;
    ctx.drawImage(source, 0, 0, width, height);
    ctx.restore();
  }

  if (options.draft) {
    paintStrokes(ctx, [options.draft]);
  }

  if (options.guides) {
    ctx.save();
    ctx.strokeStyle = "rgba(0, 120, 255, 0.35)";
    ctx.lineWidth = 1;
    for (let index = 1; index < 3; index += 1) {
      ctx.beginPath();
      ctx.moveTo((width / 3) * index, 0);
      ctx.lineTo((width / 3) * index, height);
      ctx.moveTo(0, (height / 3) * index);
      ctx.lineTo(width, (height / 3) * index);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.restore();
}

/** Copia un canvas tiñéndolo del color indicado (sólo la tinta). */
function tintCanvas(
  source: HTMLCanvasElement,
  color: string,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.drawImage(source, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
  return canvas;
}

/** Textura sutil de papel (se dibuja con un patrón determinista). */
function drawPaperTexture(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = "#6b5b45";
  let seed = 7;
  for (let y = 0; y < height; y += 4) {
    for (let x = 0; x < width; x += 4) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      if (seed % 7 === 0) ctx.fillRect(x, y, 2, 2);
    }
  }
  ctx.restore();
}

/**
 * Miniatura de una instancia para la línea de tiempo.
 * Devuelve un canvas pequeño con el dibujo de la imagen.
 */
export function renderThumbnail(
  image: ClipImage | undefined,
  targetWidth: number,
  targetHeight: number,
  projectWidth: number,
  projectHeight: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  // Fondo tipo papel para que el dibujo se lea (como en TVPaint).
  ctx.fillStyle = "#f2efe6";
  ctx.fillRect(0, 0, targetWidth, targetHeight);
  if (!image || image.strokes.length === 0) {
    // Instancia vacía: damero para reconocerla de un vistazo.
    const size = 5;
    for (let y = 0; y < targetHeight; y += size) {
      for (let x = 0; x < targetWidth; x += size) {
        if (((x / size) | 0) % 2 === ((y / size) | 0) % 2) {
          ctx.fillStyle = "#d5d1c6";
          ctx.fillRect(x, y, size, size);
        }
      }
    }
    return canvas;
  }

  const scale = Math.min(targetWidth / projectWidth, targetHeight / projectHeight);
  const offsetX = (targetWidth - projectWidth * scale) / 2;
  const offsetY = (targetHeight - projectHeight * scale) / 2;

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  paintStrokes(ctx, image.strokes);
  ctx.restore();
  return canvas;
}
