import { describe, expect, it } from "vitest";

import { cutStrokes, eraseRegionFromBitmap, isInsideRegion, normalizeRegion } from "./cut";
import { createStroke } from "./stroke";
import { DEFAULT_BRUSH_SETTINGS, type Stroke } from "./types";

function linea(x1: number, x2: number, y = 10): Stroke {
  return createStroke("ink", [
    { x: x1, y },
    { x: (x1 + x2) / 2, y },
    { x: x2, y },
  ]);
}

describe("brush/cut", () => {
  it("detecta los puntos dentro de la región", () => {
    const region = { x: 0, y: 0, width: 10, height: 10 };
    expect(isInsideRegion({ x: 5, y: 5 }, region)).toBe(true);
    expect(isInsideRegion({ x: 15, y: 5 }, region)).toBe(false);
  });

  it("normaliza las regiones con tamaño negativo", () => {
    expect(normalizeRegion({ x: 20, y: 20, width: -10, height: -5 })).toEqual({
      x: 10,
      y: 15,
      width: 10,
      height: 5,
    });
  });

  it("parte un trazo que cruza la región", () => {
    const trazos = cutStrokes([linea(0, 100)], { x: 40, y: 0, width: 20, height: 20 });
    expect(trazos).toHaveLength(2);
    expect(trazos[0].points[0].x).toBe(0);
    expect(trazos[0].points[trazos[0].points.length - 1].x).toBeCloseTo(40);
    expect(trazos[1].points[0].x).toBeCloseTo(60);
    expect(trazos[1].points[trazos[1].points.length - 1].x).toBe(100);
  });

  it("parte un trazo de dos puntos que cruza la región", () => {
    const trazo = createStroke("ink", [
      { x: 0, y: 10 },
      { x: 100, y: 10 },
    ]);
    const trazos = cutStrokes([trazo], { x: 40, y: 0, width: 20, height: 20 });
    expect(trazos).toHaveLength(2);
    expect(trazos[0].points).toHaveLength(2);
    expect(trazos[1].points).toHaveLength(2);
  });

  it("elimina por completo el trazo que está dentro de la región", () => {
    const trazos = cutStrokes([linea(40, 60)], { x: 0, y: 0, width: 100, height: 100 });
    expect(trazos).toHaveLength(0);
  });

  it("deja intacto el trazo que no toca la región", () => {
    const original = linea(0, 20);
    const trazos = cutStrokes([original], { x: 100, y: 100, width: 10, height: 10 });
    expect(trazos).toHaveLength(1);
    expect(trazos[0].id).toBe(original.id);
  });

  it("borra los píxeles de la región en un mapa de bits", () => {
    const bitmap = { width: 4, height: 4, data: new Uint8ClampedArray(4 * 4 * 4).fill(255) };
    const stroke: Stroke = {
      id: "b1",
      kind: "bitmap",
      tool: "bitmap",
      points: [{ x: 0, y: 0, pressure: 0.5, t: 0 }],
      settings: { ...DEFAULT_BRUSH_SETTINGS, color: "#000000" },
      seed: 1,
      composite: "source-over",
      createdAt: 0,
      bitmap,
    };
    const trimmed = eraseRegionFromBitmap(stroke, { x: 0, y: 0, width: 2, height: 2 });
    expect(trimmed).not.toBeNull();
    expect(trimmed?.bitmap?.data[3]).toBe(0); // píxel (0,0) borrado
    expect(trimmed?.bitmap?.data[(3 * 4 + 3) * 4 + 3]).toBe(255); // píxel (3,3) intacto
  });

  it("descarta el mapa de bits si la región lo borra por completo", () => {
    const bitmap = { width: 2, height: 2, data: new Uint8ClampedArray(2 * 2 * 4).fill(255) };
    const stroke: Stroke = {
      id: "b2",
      kind: "bitmap",
      tool: "bitmap",
      points: [{ x: 0, y: 0, pressure: 0.5, t: 0 }],
      settings: { ...DEFAULT_BRUSH_SETTINGS, color: "#000000" },
      seed: 1,
      composite: "source-over",
      createdAt: 0,
      bitmap,
    };
    const trazos = cutStrokes([stroke], { x: 0, y: 0, width: 10, height: 10 });
    expect(trazos).toHaveLength(0);
  });
});
