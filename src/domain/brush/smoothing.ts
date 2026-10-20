/**
 * "Line Smoothing" / estabilizador de pivotes.
 *
 * TVPaint permite suavizar el trazo en vivo (o después) para que la línea
 * quede como un dibujo a mano "de_LINEAS" estable. Acá se implementan dos
 * filtros: media móvil (suaviza el temblor) y Chaikin (redondea la curva).
 */

import type { Point2D } from "@/domain/geometry/shapes";
import type { StrokePoint } from "@/domain/brush/types";

/** Media móvil sobre las coordenadas; preserva presión y tiempo. */
export function movingAverage(points: StrokePoint[], windowSize: number): StrokePoint[] {
  if (windowSize <= 1 || points.length < 3) return points.map((point) => ({ ...point }));
  const half = Math.floor(windowSize / 2);

  return points.map((point, index) => {
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    for (let offset = -half; offset <= half; offset += 1) {
      const neighbour = points[index + offset];
      if (!neighbour) continue;
      sumX += neighbour.x;
      sumY += neighbour.y;
      count += 1;
    }
    return {
      x: sumX / count,
      y: sumY / count,
      pressure: point.pressure,
      t: point.t,
    };
  });
}

/** Redondeo de Chaikin: cada segmento se subdivide en dos. */
export function chaikinSmooth(points: Point2D[], iterations = 1): Point2D[] {
  let current = points.map((point) => ({ ...point }));
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    if (current.length < 3) break;
    const next: Point2D[] = [current[0]];
    for (let i = 0; i < current.length - 1; i += 1) {
      const a = current[i];
      const b = current[i + 1];
      next.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
      next.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    next.push(current[current.length - 1]);
    current = next;
  }
  return current;
}

/**
 * Suavizado combinado con intensidad 0 - 1.
 *
 * `amount` 0 devuelve el trazo intacto; 1 aplica media móvil de 5 puntos más
 * dos iteraciones de Chaikin.
 */
export function smoothStroke(points: StrokePoint[], amount: number): StrokePoint[] {
  if (amount <= 0 || points.length < 3) return points.map((point) => ({ ...point }));
  const clamped = Math.min(1, amount);
  const windowSize = Math.max(2, Math.round(1 + clamped * 4));
  const averaged = movingAverage(points, windowSize);
  const smoothed = chaikinSmooth(averaged, clamped >= 0.7 ? 2 : 1);
  return smoothed.map((point, index) => ({
    x: point.x,
    y: point.y,
    pressure: averaged[index]?.pressure ?? 0.5,
    t: points[index]?.t ?? index * 16,
  }));
}

/**
 * Estabilizador de pivotes ("Pegs Stabilizer").
 *
 * Además de suavizar, ancla el trazo a una línea guía: si el trazo se desvía
 * poco del eje, se corrige. Es la función que TVPaint usa paradigitalizar
 * dibujos escaneados.
 */
export function stabilizeToPegs(
  points: StrokePoint[],
  peg: Point2D,
  direction: Point2D,
  strength: number,
): StrokePoint[] {
  if (points.length === 0) return [];
  const length = Math.hypot(direction.x, direction.y) || 1;
  const axis = { x: direction.x / length, y: direction.y / length };
  const clamped = Math.min(1, Math.max(0, strength));

  return points.map((point) => {
    const dx = point.x - peg.x;
    const dy = point.y - peg.y;
    const along = dx * axis.x + dy * axis.y;
    const across = dx * -axis.y + dy * axis.x;
    const corrected = across * (1 - clamped);
    return {
      x: peg.x + axis.x * along + -axis.y * corrected,
      y: peg.y + axis.y * along + axis.x * corrected,
      pressure: point.pressure,
      t: point.t,
    };
  });
}
