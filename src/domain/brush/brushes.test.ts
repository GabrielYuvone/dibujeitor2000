import { describe, expect, it } from "vitest";

import { BRUSH_PRESETS, createBrushMemory, mergeBrushSettings, settingsForBrush } from "./brushes";

describe("brush/brushes", () => {
  it("cada pincel tiene sus propios valores por defecto", () => {
    expect(settingsForBrush("pen").size).toBe(6);
    expect(settingsForBrush("eraser").size).toBe(28);
    expect(settingsForBrush("airbrush").opacity).toBeLessThan(1);
  });

  it("la memoria inicial tiene una entrada por pincel", () => {
    const memory = createBrushMemory();
    expect(Object.keys(memory).sort()).toEqual(BRUSH_PRESETS.map((preset) => preset.kind).sort());
    expect(memory.pencil.grain).toBeGreaterThan(0);
    expect(memory.eraser.grain).toBe(0);
  });

  it("los ajustes modificados se guardan en el pincel y no se heredan", () => {
    const memory = createBrushMemory();
    const tuned = mergeBrushSettings("pen", memory.pen, { size: 22 });
    expect(tuned.size).toBe(22);
    expect(tuned.grain).toBe(memory.pen.grain);
    // El lápiz conserva su propio grano: no hereda el de la pluma.
    expect(memory.pencil.grain).toBeGreaterThan(0);
  });
});
