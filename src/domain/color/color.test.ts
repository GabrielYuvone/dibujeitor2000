import { describe, expect, it } from "vitest";

import {
  clamp,
  parseHex,
  parseHexToRgba,
  rgbToCss,
  rgbToHex,
  toHex,
} from "./hex";
import { euclideanRgbDistance } from "./distance";
import { BACKGROUND_PRESETS, DEFAULT_PALETTE } from "./palette";

describe("color/hex", () => {
  it("parsea hex de 3 y 6 dígitos", () => {
    expect(parseHex("#f00")).toEqual({ r: 255, g: 0, b: 0 });
    expect(parseHex("00ff00")).toEqual({ r: 0, g: 255, b: 0 });
    expect(parseHex("#004098")).toEqual({ r: 0, g: 64, b: 152 });
  });

  it("devuelve null ante hex inválido", () => {
    expect(parseHex("#gggggg")).toBeNull();
    expect(parseHex("")).toBeNull();
    expect(parseHex("#12345")).toBeNull();
  });

  it("parsea hex con canal alfa", () => {
    expect(parseHexToRgba("#ff000080")).toEqual({ r: 255, g: 0, b: 0, a: 128 });
    expect(parseHexToRgba("#f008")).toEqual({ r: 255, g: 0, b: 0, a: 136 });
  });

  it("convierte rgb a hex de 6 dígitos", () => {
    expect(rgbToHex({ r: 0, g: 64, b: 152 })).toBe("#004098");
    expect(rgbToHex({ r: 300, g: -5, b: 10.6 })).toBe("#ff000b");
  });

  it("convierte a css con y sin alfa", () => {
    expect(rgbToCss({ r: 1, g: 2, b: 3 })).toBe("rgb(1, 2, 3)");
    expect(rgbToCss({ r: 1, g: 2, b: 3 }, 0.5)).toBe("rgba(1, 2, 3, 0.5)");
  });

  it("normaliza colores inválidos a negro", () => {
    expect(toHex("no-es-color")).toBe("#000000");
    expect(toHex("#ABC")).toBe("#aabbcc");
  });

  it("clamp con NaN devuelve el mínimo", () => {
    expect(clamp(Number.NaN, 0, 10)).toBe(0);
    expect(clamp(20, 0, 10)).toBe(10);
    expect(clamp(-5, 0, 10)).toBe(0);
  });
});

describe("color/distance", () => {
  it("calcula distancia euclidiana en 3 canales", () => {
    expect(euclideanRgbDistance({ r: 0, g: 0, b: 0 }, { r: 0, g: 0, b: 0 })).toBe(0);
    expect(euclideanRgbDistance({ r: 0, g: 0, b: 0 }, { r: 3, g: 4, b: 0 })).toBe(5);
  });

  it("ignora el alfa (sólo RGB)", () => {
    const d1 = euclideanRgbDistance({ r: 10, g: 10, b: 10 }, { r: 20, g: 20, b: 20 });
    const d2 = euclideanRgbDistance({ r: 10, g: 10, b: 10 }, { r: 20, g: 20, b: 20 });
    expect(d1).toBe(d2);
  });
});

describe("color/palette", () => {
  it("expone exactamente 30 colores por defecto", () => {
    expect(DEFAULT_PALETTE).toHaveLength(30);
  });

  it("no tiene colores duplicados", () => {
    const hexes = DEFAULT_PALETTE.map((c) => c.hex.toLowerCase());
    expect(new Set(hexes).size).toBe(hexes.length);
  });

  it("todos los colores de la paleta son hex válidos", () => {
    for (const color of DEFAULT_PALETTE) {
      expect(parseHex(color.hex)).not.toBeNull();
    }
  });

  it("incluye los presets de chroma key verde y azul", () => {
    const green = BACKGROUND_PRESETS.find((p) => p.hex === "#00b140");
    const blue = BACKGROUND_PRESETS.find((p) => p.hex === "#004098");
    expect(green?.name).toBe("Chroma key verde");
    expect(blue?.name).toBe("Chroma key azul");
  });
});
