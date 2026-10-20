import type { RGB } from "./hex";

/**
 * Distancia euclidiana en espacio RGB (3 canales, sin alfa).
 * Es la métrica que usa el relleno por tolerancia: comparar el color semilla
 * contra el píxel vecino sin mezclar el canal alfa evita que zonas
 * semitransparentes "escapen" del relleno.
 */
export function euclideanRgbDistance(a: RGB, b: RGB): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/** Distancia máxima posible en RGB (255 * sqrt(3)). */
export const MAX_RGB_DISTANCE = Math.sqrt(3 * 255 * 255);
