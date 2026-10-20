import type { StrokePoint } from "./types";
import { clamp } from "../color/hex";

/**
 * Estabilización exponencial del trazo.
 *
 * smoothing = 0 → el trazo sigue al lápiz al píxel.
 * smoothing = 1 → suavizado casi total (el trazo "flota" detrás del lápiz).
 */
export function stabilizePoints(points: StrokePoint[], smoothing: number): StrokePoint[] {
  const amount = clamp(smoothing, 0, 1);
  if (amount === 0 || points.length < 2) return points.map((p) => ({ ...p }));

  // Nunca congelamos el trazo: un factor residual mínimo mantiene la respuesta.
  const factor = Math.max(0.05, 1 - amount * 0.95);
  const smoothed: StrokePoint[] = [{ ...points[0] }];

  for (let i = 1; i < points.length; i += 1) {
    const prev = smoothed[i - 1];
    const raw = points[i];
    smoothed.push({
      x: prev.x + (raw.x - prev.x) * factor,
      y: prev.y + (raw.y - prev.y) * factor,
      pressure: prev.pressure + (raw.pressure - prev.pressure) * factor,
      t: raw.t,
    });
  }

  return smoothed;
}

/**
 * Re-muestrea una polilínea a intervalos regulares de distancia (arc length).
 * Es lo que permite que el pincel no dependa de la frecuencia del puntero.
 */
export function resampleByDistance(points: StrokePoint[], spacing: number): StrokePoint[] {
  if (points.length === 0) return [];
  if (points.length === 1) return [{ ...points[0] }];

  const step = Math.max(0.01, spacing);
  const output: StrokePoint[] = [{ ...points[0] }];
  let carry = 0;

  for (let i = 1; i < points.length; i += 1) {
    const from = points[i - 1];
    const to = points[i];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const segmentLength = Math.hypot(dx, dy);
    if (segmentLength === 0) continue;

    let travelled = carry;
    while (travelled + step <= segmentLength) {
      travelled += step;
      const ratio = travelled / segmentLength;
      output.push({
        x: from.x + dx * ratio,
        y: from.y + dy * ratio,
        pressure: from.pressure + (to.pressure - from.pressure) * ratio,
        t: from.t + (to.t - from.t) * ratio,
      });
    }
    carry = travelled - segmentLength;
  }

  const last = points[points.length - 1];
  const lastOutput = output[output.length - 1];
  if (Math.hypot(last.x - lastOutput.x, last.y - lastOutput.y) > step * 0.25) {
    output.push({ ...last });
  }

  return output;
}

/** Normaliza la presión de un dispositivo sin soporte (mouse/táctil). */
export function normalizePressure(pressure: number | undefined): number {
  if (pressure === undefined || Number.isNaN(pressure)) return 0.5;
  if (pressure <= 0) return 0.5; // el mouse reporta 0 o 0.5 al presionar
  return clamp(pressure, 0, 1);
}
