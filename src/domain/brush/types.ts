/**
 * Contratos del sistema de dibujo (edición TVPaint-like).
 *
 * El dominio no sabe nada de Canvas: produce "dabs" (gotas de tinta) y trazos
 * geométricos. La capa de presentación los traduce a llamadas de Canvas 2D.
 * Esa frontera es lo que permite testear el comportamiento del pincel sin
 * navegador.
 *
 * A diferencia de la edición base, acá hay dos niveles:
 *  - `MainTool`: la herramienta del *Main Panel* (trazo, línea, rectángulo...).
 *  - `BrushKind`: el pincel concreto que usa la herramienta de trazo
 *    (pluma, lápiz, marcador, aerógrafo, acuarela, goma).
 */

export type ToolId =
  | "pencil"
  | "brush"
  | "ink"
  | "watercolor"
  | "eraser"
  | "bitmap";

/** Herramientas del motor de dabs. */
export const ENGINE_TOOLS: ToolId[] = ["pencil", "brush", "ink", "watercolor", "eraser"];

/** Pinceles disponibles en el Tool Panel. */
export type BrushKind = "pen" | "pencil" | "marker" | "airbrush" | "watercolor" | "eraser";

/** Cada pincel delega en un comportamiento del motor de dabs. */
export const BRUSH_ENGINE_TOOL: Record<BrushKind, ToolId> = {
  pen: "ink",
  pencil: "pencil",
  marker: "brush",
  airbrush: "brush",
  watercolor: "watercolor",
  eraser: "eraser",
};

/** Herramientas del Main Panel (las que se eligen con un clic). */
export type MainTool =
  | "stroke"
  | "line"
  | "rectangle"
  | "ellipse"
  | "spline"
  | "bucket"
  | "cut"
  | "selection"
  | "transform"
  | "crop"
  | "camera"
  | "eyedropper"
  | "pan"
  | "zoom";

/** Herramientas que producen un trazo nuevo en el lienzo. */
export const DRAWING_MAIN_TOOLS: MainTool[] = ["stroke", "line", "rectangle", "ellipse", "spline"];

/** Tipos de trazo almacenados. */
export type StrokeKind = "paint" | "shape" | "bitmap";

/** Formas geométricas del Main Panel. */
export type ShapeKind = "line" | "rectangle" | "ellipse" | "spline";

export interface BrushSettings {
  /** Grosor del pincel en px (0.5 - 100). */
  size: number;
  /** Color del trazo en hex. */
  color: string;
  /** Opacidad 0.05 - 1. */
  opacity: number;
  /** Dureza 0 - 1 (borde de la gota). */
  hardness: number;
  /** Grano 0 - 1 (lápiz, acuarela). */
  grain: number;
  /** Flujo 0 - 1 (aerógrafo). */
  flow: number;
  /** Estabilización 0 - 1 (suavizado exponencial). */
  smoothing: number;
  /** Sensibilidad a la presión del lápiz/tableta. */
  pressureEnabled: boolean;
  /** Tamaño mínimo cuando la presión es mínima (0 - 1). */
  minSizePressure: number;
  /** Tolerancia del relleno por inundación (0 - 100). */
  fillTolerance: number;
  /** Goma con bordes suaves. */
  softEraser: boolean;
}

export interface StrokePoint {
  x: number;
  y: number;
  /** Presión 0 - 1 (0.5 si el dispositivo no la reporta). */
  pressure: number;
  /** Marca de tiempo en ms, para el sellado de la brocha. */
  t: number;
}

export type CompositeMode = "source-over" | "destination-out" | "multiply";

export interface Dab {
  x: number;
  y: number;
  /** Radio del dab en px. */
  radius: number;
  /** Relación de ejes: 1 = círculo, >1 = elipse orientada. */
  aspect: number;
  /** Orientación en radianes. */
  angle: number;
  /** Alfa 0 - 1. */
  alpha: number;
  shape: "round" | "square";
  color: string;
}

export interface Stroke {
  id: string;
  kind: StrokeKind;
  /** Motor de dabs usado (sólo para `kind === "paint"`). */
  tool: ToolId;
  /** Pincel del Tool Panel que originó el trazo. */
  brush?: BrushKind;
  /** Forma geométrica (sólo para `kind === "shape"`). */
  shape?: ShapeKind;
  points: StrokePoint[];
  settings: BrushSettings;
  /** Semilla del PRNG: garantiza que al re-renderizar el trazo sea idéntico. */
  seed: number;
  composite: CompositeMode;
  createdAt: number;
  /** Contenido ráster (copiar/pegar de una selección). */
  bitmap?: BitmapPayload;
  /** Las formas pueden ir rellenas. */
  filled?: boolean;
}

/** Imagen en memoria usada por copiar/pegar y por los stickers de biblioteca. */
export interface BitmapPayload {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/** Configuración por defecto del pincel. */
export const DEFAULT_BRUSH_SETTINGS: BrushSettings = {
  size: 8,
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
};

export function cloneBrushSettings(settings: BrushSettings): BrushSettings {
  return { ...settings };
}
