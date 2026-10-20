import { describe, expect, it } from "vitest";
import {
  chaikinSmooth,
  movingAverage,
  smoothStroke,
  stabilizeToPegs,
} from "@/domain/brush/smoothing";
import type { StrokePoint } from "@/domain/brush/types";

function noisyLine(count: number): StrokePoint[] {
  return Array.from({ length: count }, (_, index) => ({
    x: index * 10,
    y: index * 10 + (index % 2 === 0 ? 0 : 4),
    pressure: 0.5,
    t: index * 16,
  }));
}

describe("line smoothing / estabilizador de pivotes", () => {
  it("la media móvil centra los puntos", () => {
    const points = noisyLine(5);
    const smoothed = movingAverage(points, 3);
    expect(smoothed[2].x).toBeCloseTo(20, 5);
    expect(smoothed[2].y).toBeCloseTo((14 + 20 + 34) / 3, 5);
  });

  it("Chaikin conserva los extremos", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 0 },
    ];
    const smoothed = chaikinSmooth(points, 1);
    expect(smoothed[0]).toEqual({ x: 0, y: 0 });
    expect(smoothed[smoothed.length - 1]).toEqual({ x: 20, y: 0 });
    expect(smoothed.length).toBeGreaterThan(points.length);
  });

  it("con suavizado 0 el trazo queda intacto", () => {
    const points = noisyLine(10);
    const smoothed = smoothStroke(points, 0);
    expect(smoothed[3]).toEqual(points[3]);
  });

  it("con suavizado 1 el trazo se suaviza", () => {
    const points = noisyLine(12);
    const smoothed = smoothStroke(points, 1);
    // Distancia media de los puntos respecto de la cuerda (invariante de escala).
    const zigzag = (list: StrokePoint[]) => {
      const first = list[0];
      const last = list[list.length - 1];
      const dx = last.x - first.x;
      const dy = last.y - first.y;
      const length = Math.hypot(dx, dy) || 1;
      const total = list.reduce((sum, point) => {
        const cross = Math.abs((point.x - first.x) * dy - (point.y - first.y) * dx);
        return sum + cross / length;
      }, 0);
      return total / list.length;
    };
    expect(zigzag(smoothed)).toBeLessThan(zigzag(points));
  });

  it("el estabilizador de pivotes corrige la desviación lateral", () => {
    const points: StrokePoint[] = [
      { x: 0, y: 1, pressure: 0.5, t: 0 },
      { x: 10, y: 2, pressure: 0.5, t: 16 },
      { x: 20, y: 1, pressure: 0.5, t: 32 },
    ];
    const stabilized = stabilizeToPegs(points, { x: 0, y: 0 }, { x: 1, y: 0 }, 1);
    expect(stabilized[0].y).toBeCloseTo(0, 5);
    expect(stabilized[1].y).toBeCloseTo(0, 5);
  });
});
