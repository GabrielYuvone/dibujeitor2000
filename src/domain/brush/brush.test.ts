import { describe, expect, it } from "vitest";

import { buildDabs, compositeForTool } from "./dabs";
import { createRng } from "./rng";
import { normalizePressure, resampleByDistance, stabilizePoints } from "./stabilize";
import { buildShapePoints, normalizeRect } from "./shapes";
import { settingsForTool, switchTool } from "./toolMemory";
import { DEFAULT_BRUSH_SETTINGS, type BrushSettings, type StrokePoint } from "./types";

function path(count = 8, length = 100): StrokePoint[] {
  return Array.from({ length }, (_, i) => ({
    x: i * (length / (count - 1)),
    y: 20,
    pressure: 0.5,
    t: i * 16,
  }));
}

function settings(overrides: Partial<BrushSettings> = {}): BrushSettings {
  return { ...DEFAULT_BRUSH_SETTINGS, ...overrides };
}

describe("brush/rng", () => {
  it("es determinista para una misma semilla", () => {
    const a = createRng(42);
    const b = createRng(42);
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
  });

  it("produce valores dentro del rango", () => {
    const rng = createRng(7);
    for (let i = 0; i < 50; i += 1) {
      const value = rng.range(3, 9);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(9);
    }
  });
});

describe("brush/stabilize", () => {
  it("sin suavizado devuelve los puntos idénticos", () => {
    const points = path();
    expect(stabilizePoints(points, 0)).toEqual(points);
  });

  it("con suavizado el trazo sigue al lápiz con retardo", () => {
    const points = path();
    const smoothed = stabilizePoints(points, 0.8);
    expect(smoothed[0]).toEqual(points[0]);
    expect(smoothed[smoothed.length - 1].x).toBeLessThan(points[points.length - 1].x);
  });

  it("nunca congela el trazo", () => {
    const points = path();
    const smoothed = stabilizePoints(points, 1);
    expect(smoothed[smoothed.length - 1].x).toBeGreaterThan(smoothed[0].x);
  });

  it("re-muestrea a intervalos regulares", () => {
    const points = path(2, 100);
    const resampled = resampleByDistance(points, 10);
    expect(resampled.length).toBeGreaterThanOrEqual(10);
    expect(resampled[0].x).toBeCloseTo(0, 5);
  });

  it("normaliza la presión de dispositivos sin sensor", () => {
    expect(normalizePressure(undefined)).toBe(0.5);
    expect(normalizePressure(0)).toBe(0.5);
    expect(normalizePressure(0.8)).toBeCloseTo(0.8, 5);
  });
});

describe("brush/dabs — lápiz", () => {
  it("produce dabs cuadrados con opacidad reducida", () => {
    const dabs = buildDabs({
      tool: "pencil",
      points: path(),
      settings: settings({ size: 10, opacity: 1 }),
      seed: 1,
    });
    expect(dabs.length).toBeGreaterThan(0);
    expect(dabs.every((d) => d.shape === "square")).toBe(true);
    expect(dabs[0].alpha).toBeCloseTo(0.5, 5);
  });

  it("aplica jitter: las posiciones no son idénticas al camino", () => {
    const dabs = buildDabs({
      tool: "pencil",
      points: path(),
      settings: settings({ size: 12 }),
      seed: 3,
    });
    const uniqueY = new Set(dabs.map((d) => d.y.toFixed(3)));
    expect(uniqueY.size).toBeGreaterThan(1);
  });
});

describe("brush/dabs — pincel", () => {
  it("usa un radio igual a la mitad del tamaño y trazo redondo", () => {
    const dabs = buildDabs({
      tool: "brush",
      points: path(),
      settings: settings({ size: 20 }),
      seed: 2,
    });
    expect(dabs[0].radius).toBe(10);
    expect(dabs[0].shape).toBe("round");
    expect(dabs[0].alpha).toBe(1);
  });

  it("reduce el radio con la presión si está habilitada", () => {
    const points = path(4);
    const lowPressure = points.map((p) => ({ ...p, pressure: 0 }));
    const dabs = buildDabs({
      tool: "brush",
      points: lowPressure,
      settings: settings({ size: 20, pressureEnabled: true, minSizePressure: 0.25 }),
      seed: 2,
    });
    expect(dabs[0].radius).toBeCloseTo(2.5, 5);
  });
});

describe("brush/dabs — tinta", () => {
  it("genera anchos variables", () => {
    const dabs = buildDabs({
      tool: "ink",
      points: path(20),
      settings: settings({ size: 12 }),
      seed: 9,
    });
    const radii = new Set(dabs.map((d) => d.radius.toFixed(3)));
    expect(radii.size).toBeGreaterThan(3);
  });

  it("incluye salpicaduras y blobs (gotas de radio pequeño y grande)", () => {
    const dabs = buildDabs({
      tool: "ink",
      points: path(60, 600),
      settings: settings({ size: 14 }),
      seed: 11,
    });
    const radii = dabs.map((d) => d.radius);
    expect(Math.min(...radii)).toBeLessThan(1.5);
    expect(Math.max(...radii)).toBeGreaterThan(4);
  });

  it("es determinista: misma semilla, mismos dabs", () => {
    const input = { tool: "ink" as const, points: path(12), settings: settings({ size: 10 }), seed: 5 };
    expect(buildDabs(input)).toEqual(buildDabs(input));
  });
});

describe("brush/dabs — acuarela", () => {
  it("no es circular: genera cerdas perpendiculares al trazo", () => {
    const dabs = buildDabs({
      tool: "watercolor",
      points: path(6, 120),
      settings: settings({ size: 20, opacity: 1 }),
      seed: 4,
    });
    // El trazo es horizontal, luego las cerdas son verticales (ángulo ~PI/2).
    expect(dabs[0].aspect).toBeGreaterThan(1);
    expect(Math.abs(Math.abs(dabs[0].angle) - Math.PI / 2)).toBeLessThan(0.2);
  });

  it("las cerdas centrales son más oscuras que las de los bordes", () => {
    const dabs = buildDabs({
      tool: "watercolor",
      points: path(4, 60),
      settings: settings({ size: 24, opacity: 1 }),
      seed: 8,
    });
    const byX = [...dabs].sort((a, b) => a.x - b.x);
    const middle = byX[Math.floor(byX.length / 2)];
    const edge = byX[0];
    expect(middle.alpha).toBeGreaterThan(edge.alpha);
  });

  it("usa composición multiply y pierde pintura al final del trazo", () => {
    expect(compositeForTool("watercolor")).toBe("multiply");

    const dabs = buildDabs({
      tool: "watercolor",
      points: path(40, 400),
      settings: settings({ size: 16, opacity: 1 }),
      seed: 6,
    });
    const firstThird = dabs.slice(0, Math.floor(dabs.length / 3));
    const lastThird = dabs.slice(-Math.floor(dabs.length / 3));
    const avg = (list: typeof dabs) => list.reduce((acc, d) => acc + d.alpha, 0) / list.length;
    expect(avg(lastThird)).toBeLessThan(avg(firstThird));
  });
});

describe("brush/dabs — goma", () => {
  it("usa destination-out", () => {
    expect(compositeForTool("eraser")).toBe("destination-out");
  });

  it("la goma suave reduce el alfa según la dureza", () => {
    const soft = buildDabs({
      tool: "eraser",
      points: path(3),
      settings: settings({ size: 10, opacity: 1, hardness: 0.2, softEraser: true }),
      seed: 1,
    });
    const solid = buildDabs({
      tool: "eraser",
      points: path(3),
      settings: settings({ size: 10, opacity: 1, hardness: 0.2, softEraser: false }),
      seed: 1,
    });
    expect(soft[0].alpha).toBeLessThan(solid[0].alpha);
  });
});

describe("brush/shapes", () => {
  it("la línea une los dos extremos", () => {
    const points = buildShapePoints("line", { x: 0, y: 0 }, { x: 10, y: 20 });
    expect(points).toHaveLength(2);
    expect(points[1]).toMatchObject({ x: 10, y: 20 });
  });

  it("el rectángulo cierra el contorno", () => {
    const points = buildShapePoints("rectangle", { x: 0, y: 0 }, { x: 10, y: 5 });
    expect(points[0]).toMatchObject({ x: 0, y: 0 });
    expect(points[points.length - 1]).toMatchObject({ x: 0, y: 0 });
  });

  it("la elipse empieza y termina en el mismo punto", () => {
    const points = buildShapePoints("ellipse", { x: 0, y: 0 }, { x: 20, y: 10 });
    const first = points[0];
    const last = points[points.length - 1];
    expect(first.x).toBeCloseTo(last.x, 5);
    expect(first.y).toBeCloseTo(last.y, 5);
  });

  it("normaliza rectángulos arrastrados en diagonal", () => {
    expect(normalizeRect({ x: 30, y: 40 }, { x: 10, y: 10 })).toEqual({
      x: 10,
      y: 10,
      width: 20,
      height: 30,
    });
  });
});

describe("brush/toolMemory", () => {
  it("recupera los ajustes por defecto si la herramienta nunca se usó", () => {
    expect(settingsForTool({}, "ink").size).toBe(DEFAULT_BRUSH_SETTINGS.size);
  });

  it("al cambiar de herramienta guarda los ajustes actuales y restaura los nuevos", () => {
    const pencilSettings = settings({ size: 3, color: "#ff0000" });
    const memory = {};
    const first = switchTool(memory, "pencil", pencilSettings, "ink");
    expect(first.memory.pencil?.size).toBe(3);

    const inkSettings = settings({ size: 30, color: "#0000ff" });
    const second = switchTool(first.memory, "ink", inkSettings, "pencil");
    expect(second.settings.size).toBe(3);
    expect(second.settings.color).toBe("#ff0000");
  });
});
