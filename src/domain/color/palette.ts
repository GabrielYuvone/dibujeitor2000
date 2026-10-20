/**
 * Paleta de 30 colores de la escuela + presets de fondo y chroma key.
 * La paleta del usuario se persiste aparte (localStorage) en la capa de UI.
 */

export interface PaletteColor {
  name: string;
  hex: string;
}

/** 30 colores estándar de gouache/acuarela para animación tradicional. */
export const DEFAULT_PALETTE: PaletteColor[] = [
  { name: "Negro", hex: "#000000" },
  { name: "Blanco", hex: "#ffffff" },
  { name: "Gris carbón", hex: "#2b2b2b" },
  { name: "Gris medio", hex: "#6e6e6e" },
  { name: "Gris claro", hex: "#a6a6a6" },
  { name: "Rojo cadmio", hex: "#d23b2e" },
  { name: "Rojo Bermellón", hex: "#e2452f" },
  { name: "Rojo sombra", hex: "#8f2318" },
  { name: "Rosa fluorescente", hex: "#ff7f9f" },
  { name: "Salmón", hex: "#f79f7c" },
  { name: "Naranja", hex: "#f58220" },
  { name: "Amarillo cadmio", hex: "#ffd400" },
  { name: "Amarillo ocre", hex: "#e0a800" },
  { name: "Verde cadmio", hex: "#7fb800" },
  { name: "Verde esmeralda", hex: "#00b140" },
  { name: "Verde profundo", hex: "#046a38" },
  { name: "Verde oliva", hex: "#7a7a2e" },
  { name: "Verde agua", hex: "#3fbfae" },
  { name: "Menta", hex: "#a8e6cf" },
  { name: "Azul cobalto", hex: "#004098" },
  { name: "Azul ultramar", hex: "#1c3f94" },
  { name: "Azul cielo", hex: "#59a9e0" },
  { name: "Azul turquesa", hex: "#00a3c4" },
  { name: "Índigo", hex: "#3b2f8f" },
  { name: "Violeta", hex: "#7b3fa0" },
  { name: "Magenta", hex: "#e0009b" },
  { name: "Lila", hex: "#c3a2e0" },
  { name: "Marrón siena", hex: "#7b4a2d" },
  { name: "Marrón ocre", hex: "#a06b3b" },
  { name: "Sepia", hex: "#5c4423" },
];

export interface BackgroundPreset {
  id: string;
  name: string;
  hex: string;
}

/** Presets de color de fondo del lienzo. */
export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  { id: "white", name: "Blanco", hex: "#ffffff" },
  { id: "black", name: "Negro", hex: "#000000" },
  { id: "chroma-green", name: "Chroma key verde", hex: "#00b140" },
  { id: "chroma-blue", name: "Chroma key azul", hex: "#004098" },
  { id: "pure-green", name: "Verde puro", hex: "#00ff00" },
  { id: "pure-blue", name: "Azul puro", hex: "#0000ff" },
  { id: "magenta", name: "Magenta", hex: "#ff00ff" },
];

/** Colores de papel cebolla (anterior = naranja, posterior = azul). */
export const ONION_DEFAULT_COLORS = {
  previous: "#ff8c42",
  next: "#4d8cff",
} as const;
