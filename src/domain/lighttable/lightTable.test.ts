import { describe, expect, it } from "vitest";
import {
  buildLightTable,
  defaultLightTableSettings,
  opacityAtDistance,
  setFrameOpacity,
  toggleFrame,
  type LightTableContext,
} from "@/domain/lighttable/lightTable";

const images: Record<number, string> = {
  0: "img-0",
  1: "img-1",
  2: "img-2",
  3: "img-3",
  4: "img-4",
};

function context(currentFrame: number, totalFrames = 5): LightTableContext {
  return {
    currentFrame,
    totalFrames,
    imageIdAt: (frame) => images[frame] ?? null,
    instanceIdAt: (frame) => `inst-${frame}`,
  };
}

describe("Light Table", () => {
  it("no produce entradas cuando está apagada", () => {
    const settings = { ...defaultLightTableSettings(), enabled: false };
    expect(buildLightTable(settings, context(2))).toHaveLength(0);
  });

  it("muestra los cuadros vecinos con tinte verde atrás y naranja adelante", () => {
    const settings = { ...defaultLightTableSettings(), maxFrames: 2 };
    const entries = buildLightTable(settings, context(2));
    const previous = entries.filter((e) => e.side === "previous");
    const next = entries.filter((e) => e.side === "next");
    // De más lejano a más cercano: así el render apila bien las capas.
    expect(previous.map((e) => e.frame)).toEqual([0, 1]);
    expect(next.map((e) => e.frame)).toEqual([4, 3]);
    expect(previous.every((e) => e.tint === settings.previousColor)).toBe(true);
    expect(next.every((e) => e.tint === settings.nextColor)).toBe(true);
  });

  it("el cuadro actual nunca aparece en la tabla", () => {
    const entries = buildLightTable(defaultLightTableSettings(), context(2));
    expect(entries.some((e) => e.frame === 2)).toBe(false);
  });

  it("la opacidad disminuye con la distancia", () => {
    const settings = { ...defaultLightTableSettings(), maxFrames: 3 };
    const entries = buildLightTable(settings, context(3));
    const distances = entries
      .filter((e) => e.side === "previous")
      .sort((a, b) => a.distance - b.distance)
      .map((e) => e.opacity);
    expect(distances[0]).toBeGreaterThan(distances[1]);
    expect(distances[1]).toBeGreaterThan(distances[2]);
  });

  it("no muestra cuadros fuera del proyecto", () => {
    const entries = buildLightTable(defaultLightTableSettings(), context(0));
    expect(entries.every((e) => e.frame >= 0)).toBe(true);
  });

  it("con Out of Pegs muestra el pivote aunque el rango esté vacío", () => {
    const settings = { ...defaultLightTableSettings(), maxFrames: 2, outOfPegs: true };
    const ctx: LightTableContext = {
      currentFrame: 3,
      totalFrames: 6,
      imageIdAt: (frame) => (frame === 0 ? "pivote" : null),
      instanceIdAt: () => "inst-1",
    };
    const entries = buildLightTable(settings, ctx);
    const peg = entries.find((e) => e.imageId === "pivote");
    expect(peg).toBeDefined();
    expect(peg?.outOfPegs).toBe(true);
    expect(peg?.side).toBe("previous");
  });

  it("sin Out of Pegs no busca dibujos lejanos", () => {
    const settings = { ...defaultLightTableSettings(), maxFrames: 2, outOfPegs: false };
    const ctx: LightTableContext = {
      currentFrame: 3,
      totalFrames: 6,
      imageIdAt: (frame) => (frame === 0 ? "pivote" : null),
      instanceIdAt: () => "inst-1",
    };
    expect(buildLightTable(settings, ctx)).toHaveLength(0);
  });

  it("apaga un cuadro al alternarlo y lo reactiva con opacidad por defecto", () => {
    const settings = defaultLightTableSettings();
    const off = toggleFrame(settings, "previous", 1);
    expect(off.previousOpacity[0]).toBe(0);
    const on = toggleFrame(off, "previous", 1);
    expect(on.previousOpacity[0]).toBeGreaterThan(0);
  });

  it("modifica la opacidad de un cuadro concreto", () => {
    const settings = setFrameOpacity(defaultLightTableSettings(), "next", 2, 0.8);
    expect(settings.nextOpacity[1]).toBe(0.8);
  });

  it("usa la caída por defecto cuando no hay valor guardado", () => {
    expect(opacityAtDistance([0.5], 1)).toBe(0.5);
    expect(opacityAtDistance([0.5], 4)).toBeLessThan(0.5);
    expect(opacityAtDistance([], 2)).toBeGreaterThan(0);
    expect(opacityAtDistance([], 2)).toBeLessThan(0.1);
  });
});
