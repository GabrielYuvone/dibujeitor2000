/**
 * Redimensionado del lienzo.
 *
 * TVPaint permite cambiar el tamaño del lienzo en cualquier momento: el
 * dibujo puede quedarse en su lugar (se ve más o menos encuadrado) o
 * escalarse para acompañar al nuevo formato. Como los trazos son datos
 * vectoriales, escalar es trivial y exacto.
 */

import type { Project } from "@/domain/project/model";

export interface ResizeOptions {
  width: number;
  height: number;
  /** Escala el dibujo existente para que cubra el nuevo lienzo. */
  scaleContent: boolean;
  /** Mantiene la proporción original (usa el factor menor). */
  keepAspectRatio?: boolean;
}

export const MIN_CANVAS_SIZE = 16;
export const MAX_CANVAS_SIZE = 16384;

/** Limita un valor al rango permitido y lo redondea a píxeles enteros. */
export function clampCanvasSize(value: number): number {
  if (!Number.isFinite(value)) return MIN_CANVAS_SIZE;
  return Math.round(Math.max(MIN_CANVAS_SIZE, Math.min(MAX_CANVAS_SIZE, value)));
}

/** Factor de escala del lienzo. */
export function scaleFactors(
  project: Project,
  options: ResizeOptions,
): { x: number; y: number } {
  const currentWidth = project.settings.width || 1;
  const currentHeight = project.settings.height || 1;
  const x = options.width / currentWidth;
  const y = options.height / currentHeight;

  if (!options.keepAspectRatio) return { x, y };

  const factor = Math.min(x, y);
  return { x: factor, y: factor };
}

/**
 * Devuelve el proyecto con el lienzo del tamaño pedido.
 *
 * Las imágenes que quedan fuera del nuevo lienzo no se borran: se conservan
 * por si el animador vuelve a agrandar el lienzo (TVPaint tampoco las
 * descarta).
 */
export function resizeProject(project: Project, options: ResizeOptions): Project {
  const width = clampCanvasSize(options.width);
  const height = clampCanvasSize(options.height);
  if (width === project.settings.width && height === project.settings.height) return project;

  const factors = scaleFactors(project, { ...options, width, height });
  const shouldScale = options.scaleContent && (factors.x !== 1 || factors.y !== 1);

  if (!shouldScale) {
    return {
      ...project,
      settings: { ...project.settings, width, height },
      updatedAt: Date.now(),
    };
  }

  const images = Object.fromEntries(
    Object.entries(project.images).map(([id, image]) => [
      id,
      {
        ...image,
        strokes: image.strokes.map((stroke) => ({
          ...stroke,
          points: stroke.points.map((point) => ({
            ...point,
            x: point.x * factors.x,
            y: point.y * factors.y,
          })),
          settings: {
            ...stroke.settings,
            size: Math.max(0.5, stroke.settings.size * Math.min(factors.x, factors.y)),
          },
        })),
      },
    ]),
  );

  return {
    ...project,
    settings: { ...project.settings, width, height },
    images,
    updatedAt: Date.now(),
  };
}
