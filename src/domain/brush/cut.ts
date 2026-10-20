/**
 * Corte de un dibujo con una región rectangular.
 *
 * Es la operación de la herramienta "Corte": todo lo que cae dentro de la
 * región desaparece. Para los trazos vectoriales no alcanza con borrar la
 * lista de trazos: un trazo que cruza la región debe quedar partido en los
 * tramos que quedan fuera, y los mapas de bits pierden los píxeles de la
 * región.
 *
 * Función pura: devuelve trazos nuevos, sin tocar los received.
 */

import { createId } from "./stroke";
import type { Stroke, StrokePoint } from "./types";

export interface CutRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** ¿El punto cae dentro de la región? */
export function isInsideRegion(point: { x: number; y: number }, region: CutRegion): boolean {
  return (
    point.x >= region.x &&
    point.x <= region.x + region.width &&
    point.y >= region.y &&
    point.y <= region.y + region.height
  );
}

/** Normaliza la región para que tenga coordenadas y tamaño positivos. */
export function normalizeRegion(region: CutRegion): CutRegion {
  return {
    x: region.width < 0 ? region.x + region.width : region.x,
    y: region.height < 0 ? region.y + region.height : region.y,
    width: Math.abs(region.width),
    height: Math.abs(region.height),
  };
}

/**
 * Recorta un segmento contra la región (algoritmo de Liang–Barsky).
 *
 * Devuelve el intervalo de parámetros [t0, t1] del segmento que cae dentro
 * de la región, o `null` si el segmento entero queda fuera.
 */
function clipSegment(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  region: CutRegion,
): { t0: number; t1: number } | null {
  let t0 = 0;
  let t1 = 1;
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const p = [-dx, dx, -dy, dy];
  const q = [
    p0.x - region.x,
    region.x + region.width - p0.x,
    p0.y - region.y,
    region.y + region.height - p0.y,
  ];

  for (let i = 0; i < 4; i += 1) {
    if (p[i] === 0) {
      if (q[i] < 0) return null;
      continue;
    }
    const r = q[i] / p[i];
    if (p[i] < 0) {
      if (r > t1) return null;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return null;
      if (r < t1) t1 = r;
    }
  }
  return { t0, t1 };
}

/** Punto del segmento en el parámetro t. */
function lerpPoint(
  p0: StrokePoint,
  p1: StrokePoint,
  t: number,
): StrokePoint {
  return {
    x: p0.x + (p1.x - p0.x) * t,
    y: p0.y + (p1.y - p0.y) * t,
    pressure: p0.pressure,
    t: p0.t + (p1.t - p0.t) * t,
  };
}

/**
 * Parte una polilínea en los tramos que quedan fuera de la región.
 *
 * Se trabaja por segmentos, no por puntos: un trazo recto puede cruzar la
 * región sin tener ningún vértice dentro y aun así hay que cortarlo.
 */
function splitPoints(points: StrokePoint[], region: CutRegion): StrokePoint[][] {
  if (points.length < 2) return points.length === 1 ? [points] : [];

  const pieces: { a: StrokePoint; b: StrokePoint }[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index];
    const p1 = points[index + 1];
    const clipped = clipSegment(p0, p1, region);
    if (!clipped) {
      pieces.push({ a: p0, b: p1 });
      continue;
    }
    if (clipped.t0 > 0) pieces.push({ a: p0, b: lerpPoint(p0, p1, clipped.t0) });
    if (clipped.t1 < 1) pieces.push({ a: lerpPoint(p0, p1, clipped.t1), b: p1 });
  }

  const runs: StrokePoint[][] = [];
  let current: StrokePoint[] = [];
  for (const piece of pieces) {
    const last = current[current.length - 1];
    const continues = last && Math.abs(last.x - piece.a.x) < 0.001 && Math.abs(last.y - piece.a.y) < 0.001;
    if (!continues && current.length > 0) {
      runs.push(current);
      current = [];
    }
    current.push(piece.a);
    current.push(piece.b);
  }
  if (current.length > 0) runs.push(current);
  return runs;
}

/** Quita los píxeles de la región de un mapa de bits. */
export function eraseRegionFromBitmap(stroke: Stroke, region: CutRegion): Stroke | null {
  if (!stroke.bitmap) return stroke;
  const { bitmap } = stroke;
  const area = normalizeRegion(region);
  const data = new Uint8ClampedArray(bitmap.data);
  const x0 = Math.max(0, Math.floor(area.x));
  const y0 = Math.max(0, Math.floor(area.y));
  const x1 = Math.min(bitmap.width, Math.ceil(area.x + area.width));
  const y1 = Math.min(bitmap.height, Math.ceil(area.y + area.height));
  let remaining = 0;
  for (let y = 0; y < bitmap.height; y += 1) {
    for (let x = 0; x < bitmap.width; x += 1) {
      const inside = x >= x0 && x < x1 && y >= y0 && y < y1;
      const offset = (y * bitmap.width + x) * 4;
      if (inside) {
        data[offset + 3] = 0;
      } else if (data[offset + 3] > 0) {
        remaining += 1;
      }
    }
  }
  if (remaining === 0) return null;
  return { ...stroke, bitmap: { ...bitmap, data } };
}

/** ¿La polilínea toca la región (por un vértice o por un segmento)? */
export function strokeTouchesRegion(points: StrokePoint[], region: CutRegion): boolean {
  for (const point of points) {
    if (isInsideRegion(point, region)) return true;
  }
  for (let index = 0; index < points.length - 1; index += 1) {
    if (clipSegment(points[index], points[index + 1], region) !== null) return true;
  }
  return false;
}

/**
 * Aplica el corte a una lista de trazos.
 *
 * Devuelve la lista resultante: los trazos que no tocan la región se
 * copian tal cual, los que la cruzan se parten y los mapas de bits
 * pierden los píxeles de la región.
 */
export function cutStrokes(strokes: Stroke[], region: CutRegion): Stroke[] {
  const area = normalizeRegion(region);
  const result: Stroke[] = [];

  for (const stroke of strokes) {
    if (stroke.kind === "bitmap" && stroke.bitmap) {
      const trimmed = eraseRegionFromBitmap(stroke, area);
      if (trimmed) result.push(trimmed);
      continue;
    }

    if (stroke.points.length === 0) {
      result.push(stroke);
      continue;
    }

    if (!strokeTouchesRegion(stroke.points, area)) {
      result.push(stroke);
      continue;
    }

    const runs = splitPoints(stroke.points, area);
    for (const run of runs) {
      // Un punto suelto no dibuja nada: se descarta para no dejar motas.
      if (run.length < 2) continue;
      result.push({
        ...stroke,
        id: createId("stroke"),
        points: run,
      });
    }
  }

  return result;
}
