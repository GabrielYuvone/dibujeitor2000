import { DEFAULT_BRUSH_SETTINGS, cloneBrushSettings, type BrushSettings, type ToolId } from "./types";

/**
 * Memoria de ajustes por herramienta (Cap. 4).
 *
 * "Cada herramienta recuerda su propio grosor, opacidad, color, dureza,
 * suavizado y tolerancia. Al cambiar de herramienta se guardan los seteos
 * actuales y se restauran los de la nueva."
 */
export type ToolMemory = Partial<Record<ToolId, BrushSettings>>;

export function createToolMemory(): ToolMemory {
  return {};
}

/** Guarda los ajustes actuales de una herramienta. Devuelve una memoria nueva. */
export function saveToolSettings(
  memory: ToolMemory,
  tool: ToolId,
  settings: BrushSettings,
): ToolMemory {
  return { ...memory, [tool]: cloneBrushSettings(settings) };
}

/** Recupera los ajustes de una herramienta, o los por defecto si nunca se usó. */
export function settingsForTool(
  memory: ToolMemory,
  tool: ToolId,
  fallback: BrushSettings = DEFAULT_BRUSH_SETTINGS,
): BrushSettings {
  const stored = memory[tool];
  return stored ? cloneBrushSettings(stored) : cloneBrushSettings(fallback);
}

/**
 * Cambio de herramienta: guarda los ajustes de la anterior y devuelve los de
 * la nueva, ya con la copia defensiva hecha.
 */
export function switchTool(
  memory: ToolMemory,
  currentTool: ToolId,
  currentSettings: BrushSettings,
  nextTool: ToolId,
  fallback: BrushSettings = DEFAULT_BRUSH_SETTINGS,
): { memory: ToolMemory; settings: BrushSettings } {
  const nextMemory = saveToolSettings(memory, currentTool, currentSettings);
  return { memory: nextMemory, settings: settingsForTool(nextMemory, nextTool, fallback) };
}
