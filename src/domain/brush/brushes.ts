/**
 * Pinceles del Tool Panel.
 *
 * TVPaint usa un panel polimórfico: al elegir una herramienta, el panel
 * muestra los parámetros del pincel activo. Cada pincel tiene sus propios
 * valores por defecto y sus propios controles.
 */

import {
  BRUSH_ENGINE_TOOL,
  DEFAULT_BRUSH_SETTINGS,
  type BrushKind,
  type BrushSettings,
  type ToolId,
} from "./types";

export interface BrushPreset {
  kind: BrushKind;
  label: string;
  /** Descripción corta para el tooltip. */
  hint: string;
  /** Motor de dabs que implementa el pincel. */
  engine: ToolId;
  /** Parámetros por defecto del pincel. */
  defaults: Partial<BrushSettings>;
  /** Controles que el Tool Panel muestra para este pincel. */
  controls: BrushControl[];
}

export type BrushControl =
  | "size"
  | "color"
  | "opacity"
  | "hardness"
  | "grain"
  | "flow"
  | "soft";

export const BRUSH_PRESETS: BrushPreset[] = [
  {
    kind: "pen",
    label: "Pluma",
    hint: "Trazado a tinta con extremos afinados (cel shading).",
    engine: BRUSH_ENGINE_TOOL.pen,
    defaults: { size: 6, opacity: 1, hardness: 0.9, grain: 0, flow: 1 },
    controls: ["size", "color", "opacity"],
  },
  {
    kind: "pencil",
    label: "Lápiz",
    hint: "Trazo granuloso, ideal para bocetos rough.",
    engine: BRUSH_ENGINE_TOOL.pencil,
    defaults: { size: 4, opacity: 1, hardness: 0.35, grain: 0.6, flow: 1 },
    controls: ["size", "color", "opacity", "grain"],
  },
  {
    kind: "marker",
    label: "Marcador",
    hint: "Trazo plano y constante, como un rotulador.",
    engine: BRUSH_ENGINE_TOOL.marker,
    defaults: { size: 14, opacity: 0.65, hardness: 1, grain: 0, flow: 1 },
    controls: ["size", "color", "opacity"],
  },
  {
    kind: "airbrush",
    label: "Aerógrafo",
    hint: "Pincel suave de bajo flujo para sombreados.",
    engine: BRUSH_ENGINE_TOOL.airbrush,
    defaults: { size: 40, opacity: 0.18, hardness: 0.05, grain: 0, flow: 0.35 },
    controls: ["size", "color", "opacity", "flow"],
  },
  {
    kind: "watercolor",
    label: "Acuarela",
    hint: "Brocha con cerdas: centro oscuro y bordes deshilachados.",
    engine: BRUSH_ENGINE_TOOL.watercolor,
    defaults: { size: 22, opacity: 0.55, hardness: 0.25, grain: 0.5, flow: 0.8 },
    controls: ["size", "color", "opacity", "grain"],
  },
  {
    kind: "eraser",
    label: "Goma",
    hint: "Borra en modo suave o sólido.",
    engine: BRUSH_ENGINE_TOOL.eraser,
    defaults: { size: 28, opacity: 1, hardness: 0.4, grain: 0, flow: 1 },
    controls: ["size", "opacity", "hardness", "soft"],
  },
];

export function getBrushPreset(kind: BrushKind): BrushPreset {
  return BRUSH_PRESETS.find((preset) => preset.kind === kind) ?? BRUSH_PRESETS[0];
}

/**
 * Configuración por defecto de un pincel (sus propios valores).
 *
 * Cada pincel recuerda los ajustes con los que se usó por última vez: al
 * volver a él se recuperan, en vez de heredar los del pincel anterior (que
 * es lo que pasaba antes y hacía que, por ejemplo, la goma quedara con el
 * tamaño de la pluma).
 */
export function settingsForBrush(kind: BrushKind): BrushSettings {
  const preset = getBrushPreset(kind);
  return {
    ...DEFAULT_BRUSH_SETTINGS,
    ...preset.defaults,
  };
}

/** Memoria de ajustes de todos los pinceles, cada uno con sus valores. */
export function createBrushMemory(): Record<BrushKind, BrushSettings> {
  const memory = {} as Record<BrushKind, BrushSettings>;
  for (const preset of BRUSH_PRESETS) {
    memory[preset.kind] = settingsForBrush(preset.kind);
  }
  return memory;
}

/** Aplica unos cambios sobre la configuración de un pincel. */
export function mergeBrushSettings(
  kind: BrushKind,
  current: BrushSettings,
  patch: Partial<BrushSettings>,
): BrushSettings {
  return { ...current, ...patch, ...pickBrushOwned(kind, patch) };
}

/**
 * Parámetros que pertenecen a un pincel concreto y no se heredan.
 *
 * El color nunca se hereda (es de la paleta), y el resto se toma del pincel
 * activo.
 */
function pickBrushOwned(kind: BrushKind, patch: Partial<BrushSettings>): Partial<BrushSettings> {
  const owned: Partial<BrushSettings> = {};
  if (patch.size !== undefined) owned.size = patch.size;
  if (patch.opacity !== undefined) owned.opacity = patch.opacity;
  if (patch.hardness !== undefined) owned.hardness = patch.hardness;
  if (patch.grain !== undefined) owned.grain = patch.grain;
  if (patch.flow !== undefined) owned.flow = patch.flow;
  if (patch.fillTolerance !== undefined) owned.fillTolerance = patch.fillTolerance;
  void kind;
  return owned;
}

/** Atajo de teclado por pincel (como los presets de TVPaint). */
export const BRUSH_SHORTCUTS: Record<string, BrushKind> = {
  "1": "pen",
  "2": "pencil",
  "3": "marker",
  "4": "airbrush",
  "5": "watercolor",
  "6": "eraser",
};
