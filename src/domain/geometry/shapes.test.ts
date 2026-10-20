import { describe, expect, it } from "vitest";
import {
  ellipsePoints,
  isPointInRect,
  linePoints,
  normalizeRect,
  polygonPoints,
  rectanglePoints,
  splinePoints,
} from "@/domain/geometry/shapes";

describe("formas del Main Panel", () => {
  it("la línea une los dos extremos", () => {
    const points = linePoints({ x: 0, y: 0 }, { x: 10, y: 20 });
    expect(points).toHaveLength(2);
    expect(points[1]).toEqual({ x: 10, y: 20 });
  });

  it("el rectángulo se normaliza desde dos esquinas", () => {
    const rect = normalizeRect({ x: 30, y: 40 }, { x: 10, y: 10 });
    expect(rect).toEqual({ x: 10, y: 10, width: 20, height: 30 });
  });

  it("el contorno del rectángulo cierra el trazo", () => {
    const points = rectanglePoints({ x: 0, y: 0, width: 10, height: 5 });
    expect(points).toHaveLength(5);
    expect(points[0]).toEqual(points[4]);
  });

  it("detecta un punto dentro del rectángulo", () => {
    const rect = { x: 0, y: 0, width: 10, height: 10 };
    expect(isPointInRect({ x: 5, y: 5 }, rect)).toBe(true);
    expect(isPointInRect({ x: 15, y: 5 }, rect)).toBe(false);
  });

  it("la elipse respeta los radios", () => {
    const points = ellipsePoints({ x: 0, y: 0 }, 10, 5, 24);
    const maxX = Math.max(...points.map((p) => p.x));
    const maxY = Math.max(...points.map((p) => p.y));
    expect(maxX).toBeCloseTo(10, 1);
    expect(maxY).toBeCloseTo(5, 1);
  });

  it("el spline pasa por los puntos de control", () => {
    const controls = [
      { x: 0, y: 0 },
      { x: 50, y: 80 },
      { x: 100, y: 0 },
    ];
    const points = splinePoints(controls, false, 10);
    expect(points[0]).toEqual(controls[0]);
    expect(points[points.length - 1]).toEqual(controls[2]);
    // El arco sube hasta el control central.
    const peak = Math.max(...points.map((p) => p.y));
    expect(peak).toBeGreaterThan(70);
    expect(peak).toBeLessThanOrEqual(80);
  });

  it("el polígono regular tiene tantos lados como se piden", () => {
    expect(polygonPoints({ x: 0, y: 0 }, 10, 6)).toHaveLength(6);
  });
});
