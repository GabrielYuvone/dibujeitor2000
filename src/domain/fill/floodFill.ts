/**
 * Relleno por inundación (flood fill) sobre un buffer de píxeles plano.
 *
 * Es una función pura: recibe píxeles y devuelve píxeles nuevos. La capa de
 * presentación se encarga de leerlos del canvas y volver a escribirlos.
 * Trabajar con RGBA plano y no con ImageData permite testearlo sin navegador.
 */

import { euclideanRgbDistance } from "../color/distance";
import { clamp } from "../color/hex";
import type { RGB } from "../color/hex";

export interface PixelBuffer {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/** Umbral máximo de distancia euclidiana RGB tolerateda (Cap. 15). */
export const MAX_FILL_DISTANCE = 200;

export function createPixelBuffer(
  width: number,
  height: number,
  fill: [number, number, number, number] = [0, 0, 0, 255],
): PixelBuffer {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fill[0];
    data[i + 1] = fill[1];
    data[i + 2] = fill[2];
    data[i + 3] = fill[3];
  }
  return { width, height, data };
}

export interface FillResult {
  buffer: PixelBuffer;
  changed: boolean;
  filled: number;
}

/** Convierte la tolerancia 0-100 a una distancia euclidiana máxima. */
export function toleranceToDistance(tolerance: number): number {
  const normalized = clamp(tolerance, 0, 100) / 100;
  return Math.min(MAX_FILL_DISTANCE, normalized * MAX_FILL_DISTANCE);
}

/**
 * Umbral bajo el cual un píxel se considera "transparente".
 *
 * Importa porque en una capa de animación el fondo es transparente: sin
 * mirar el alfa, el relleno se filtraría a través del dibujo (el negro
 * transparente y el negro de la tinta comparten RGB) y taparía todo el
 * lienzo.
 */
export const TRANSPARENT_THRESHOLD = 128;

/**
 * Rellena la región contigua (4-vecinos) que rodea al punto semilla y cuyo
 * color está dentro de la tolerancia. No modifica el buffer recibido.
 *
 * La comparación respeta el canal alfa: el relleno se queda dentro de la
 * región del mismo "material" (transparente u opaco) que el píxel semilla.
 */
export function floodFill(
  buffer: PixelBuffer,
  startX: number,
  startY: number,
  color: RGB,
  tolerance: number,
): FillResult {
  const { width, height } = buffer;
  const x = Math.floor(startX);
  const y = Math.floor(startY);

  if (x < 0 || y < 0 || x >= width || y >= height) {
    return { buffer, changed: false, filled: 0 };
  }

  const data = new Uint8ClampedArray(buffer.data);
  const seedIndex = (y * width + x) * 4;
  const seed: RGB = { r: data[seedIndex], g: data[seedIndex + 1], b: data[seedIndex + 2] };
  const maxDistance = toleranceToDistance(tolerance);
  const seedTransparent = data[seedIndex + 3] < TRANSPARENT_THRESHOLD;

  const matches = (index: number): boolean => {
    const transparent = data[index + 3] < TRANSPARENT_THRESHOLD;
    // No se puede pasar de una zona transparente a una pintada ni al revés.
    if (transparent !== seedTransparent) return false;
    // En la zona transparente todo es el mismo "material": se llena entera.
    if (seedTransparent) return true;
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    return euclideanRgbDistance(seed, { r, g, b }) <= maxDistance;
  };

  const visited = new Uint8Array(width * height);
  const stack: number[] = [y * width + x];
  let filled = 0;

  while (stack.length > 0) {
    const pixelIndex = stack.pop() as number;
    if (visited[pixelIndex]) continue;
    visited[pixelIndex] = 1;

    const pixelOffset = pixelIndex * 4;
    if (!matches(pixelOffset)) continue;

    data[pixelOffset] = color.r;
    data[pixelOffset + 1] = color.g;
    data[pixelOffset + 2] = color.b;
    data[pixelOffset + 3] = 255;
    filled += 1;

    const px = pixelIndex % width;
    const py = Math.floor(pixelIndex / width);

    if (px > 0) stack.push(pixelIndex - 1);
    if (px < width - 1) stack.push(pixelIndex + 1);
    if (py > 0) stack.push(pixelIndex - width);
    if (py < height - 1) stack.push(pixelIndex + width);
  }

  return {
    buffer: { width, height, data },
    changed: filled > 0,
    filled,
  };
}
