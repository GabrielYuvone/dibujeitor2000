import { describe, expect, it } from "vitest";

import { createProject } from "@/domain/project/factory";
import { resizeProject, clampCanvasSize, scaleFactors } from "@/domain/project/resize";
import type { Stroke } from "@/domain/brush/types";

function projectWithStroke() {
  const project = createProject({ width: 1000, height: 500 });
  const stroke: Stroke = {
    id: "s1",
    kind: "paint",
    tool: "ink",
    points: [
      { x: 100, y: 50, pressure: 0.5, t: 0 },
      { x: 200, y: 100, pressure: 0.5, t: 16 },
    ],
    settings: {
      size: 10,
      color: "#000000",
      opacity: 1,
      hardness: 0.5,
      grain: 0,
      flow: 1,
      smoothing: 0,
      pressureEnabled: false,
      minSizePressure: 0.2,
      fillTolerance: 20,
      softEraser: false,
    },
    seed: 1,
    composite: "source-over",
    createdAt: 0,
  };
  const image = { id: "img-1", strokes: [stroke], createdAt: 0 };
  const layer = project.layers[0];
  layer.instances[0].headImageId = image.id;
  return { ...project, images: { [image.id]: image } };
}

describe("redimensionado del lienzo", () => {
  it("acota el tamaño a un rango utilizable", () => {
    expect(clampCanvasSize(10)).toBe(16);
    expect(clampCanvasSize(99999)).toBe(16384);
    expect(clampCanvasSize(1920.4)).toBe(1920);
    expect(clampCanvasSize(Number.NaN)).toBe(16);
  });

  it("cambia las dimensiones del lienzo", () => {
    const project = resizeProject(createProject({ width: 800, height: 600 }), {
      width: 1920,
      height: 1080,
      scaleContent: false,
    });
    expect(project.settings.width).toBe(1920);
    expect(project.settings.height).toBe(1080);
  });

  it("sin escalar, el dibujo conserva sus coordenadas", () => {
    const project = projectWithStroke();
    const resized = resizeProject(project, {
      width: 2000,
      height: 1000,
      scaleContent: false,
    });
    const stroke = resized.images["img-1"].strokes[0];
    expect(stroke.points[0].x).toBe(100);
    expect(stroke.points[0].y).toBe(50);
  });

  it("escalando, el dibujo se ajusta al nuevo lienzo", () => {
    const project = projectWithStroke();
    const resized = resizeProject(project, {
      width: 2000,
      height: 1000,
      scaleContent: true,
    });
    const stroke = resized.images["img-1"].strokes[0];
    expect(stroke.points[0].x).toBe(200);
    expect(stroke.points[0].y).toBe(100);
    expect(stroke.points[1].x).toBe(400);
    expect(stroke.settings.size).toBe(20);
  });

  it("mantener la proporción usa el factor menor", () => {
    const project = createProject({ width: 1000, height: 500 });
    const factors = scaleFactors(project, {
      width: 2000,
      height: 2000,
      scaleContent: true,
      keepAspectRatio: true,
    });
    expect(factors.x).toBe(2);
    expect(factors.y).toBe(2);
  });

  it("redimensionar al mismo tamaño no altera el proyecto", () => {
    const project = createProject({ width: 800, height: 600 });
    const resized = resizeProject(project, {
      width: 800,
      height: 600,
      scaleContent: true,
    });
    expect(resized).toBe(project);
  });
});
