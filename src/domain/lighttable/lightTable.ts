/**
 * Light Table: el papel cebolla de TVPaint.
 *
 * Diferencias clave respecto del "onion skin" genérico:
 *  - El cuadro actual es el "0" y se muestra siempre a opacidad plena.
 *  - Los cuadros **anteriores se tiñen de verde** y los **posteriores de
 *    naranja** (no rojo/azul como en otras apps).
 *  - Cada cuadro tiene su propio control de opacidad, que se ajusta desde el
 *    panel "Light Table" haciendo clic y arrastrando sobre el número.
 *  - Modo "Out of Pegs": aunque los cuadros vecinos estén vacíos, se muestra el
 *    último dibujo anterior (el "pivote" previo) y el próximo.
 */

export type LightTableSide = "previous" | "next";

export interface LightTableSettings {
  /** Interruptor maestro de la Light Table. */
  enabled: boolean;
  /** Color de los cuadros anteriores (verde por defecto). */
  previousColor: string;
  /** Color de los cuadros posteriores (naranja por defecto). */
  nextColor: string;
  /** Opacidad por distancia (índice 0 = cuadro inmediatamente anterior). */
  previousOpacity: number[];
  /** Opacidad por distancia (índice 0 = cuadro inmediatamente posterior). */
  nextOpacity: number[];
  /** Cuántos cuadros a cada lado se pueden mostrar (TVPaint llega a 10). */
  maxFrames: number;
  /** Dibujar el papel cebolla por encima del dibujo actual. */
  blendToFront: boolean;
  /** Mostrar el pivote anterior/siguiente aunque el rango esté vacío. */
  outOfPegs: boolean;
  /** Modo de trabajo: por cuadro o por instancia. */
  mode: "frame" | "instance";
}

export const LIGHT_TABLE_MAX = 10;

export function defaultLightTableSettings(): LightTableSettings {
  return {
    enabled: true,
    previousColor: "#00b140",
    nextColor: "#ff7a00",
    previousOpacity: [0.45, 0.32, 0.22, 0.16, 0.12, 0.09, 0.07, 0.05, 0.04, 0.03],
    nextOpacity: [0.45, 0.32, 0.22, 0.16, 0.12, 0.09, 0.07, 0.05, 0.04, 0.03],
    maxFrames: 3,
    blendToFront: false,
    outOfPegs: true,
    mode: "frame",
  };
}

/** Opacidad para una distancia dada (con caída por defecto si no hay valor). */
export function opacityAtDistance(values: number[], distance: number): number {
  const index = distance - 1;
  if (index < 0) return 0;
  if (index < values.length) return values[index];
  const last = values[values.length - 1] ?? 0.1;
  return Math.max(0, last * 0.6);
}

export interface LightTableEntry {
  /** Cuadro del proyecto del que sale la imagen. */
  frame: number;
  side: LightTableSide;
  /** Tinte aplicado. */
  tint: string;
  /** Opacidad final (0 - 1). */
  opacity: number;
  /** Distancia respecto del cuadro actual (1 = vecino). */
  distance: number;
  /** Id de la imagen a mostrar. */
  imageId: string;
  /** Id de la instancia de la que sale (modo instancia). */
  instanceId: string | null;
  /** Marcado cuando viene del pivote ("out of pegs"). */
  outOfPegs: boolean;
}

export interface LightTableContext {
  /** Cuadro actual. */
  currentFrame: number;
  /** Cuadros totales del proyecto. */
  totalFrames: number;
  /** Imagen visible en un cuadro (o null si está vacío). */
  imageIdAt: (frame: number) => string | null;
  /** Instancia visible en un cuadro (o null si está vacío). */
  instanceIdAt?: (frame: number) => string | null;
}

/**
 * Construye la lista de cuadros que muestra la Light Table.
 *
 * Se devuelven de más lejano a más cercano para que el render los apile en
 * orden (el más cercano queda encima).
 */
export function buildLightTable(
  settings: LightTableSettings,
  context: LightTableContext,
): LightTableEntry[] {
  if (!settings.enabled) return [];

  const entries: LightTableEntry[] = [];
  const max = Math.min(settings.maxFrames, LIGHT_TABLE_MAX);

  const collect = (side: LightTableSide) => {
    const opacities = side === "previous" ? settings.previousOpacity : settings.nextOpacity;
    const tint = side === "previous" ? settings.previousColor : settings.nextColor;
    const direction = side === "previous" ? -1 : 1;
    const usedFrames = new Set<number>();

    for (let distance = 1; distance <= max; distance += 1) {
      const frame = context.currentFrame + direction * distance;
      if (frame < 0 || frame >= context.totalFrames) continue;
      const imageId = context.imageIdAt(frame);
      if (!imageId) continue;
      usedFrames.add(frame);
      entries.push({
        frame,
        side,
        tint,
        opacity: opacityAtDistance(opacities, distance),
        distance,
        imageId,
        instanceId: context.instanceIdAt?.(frame) ?? null,
        outOfPegs: false,
      });
    }

    if (!settings.outOfPegs) return;

    // "Out of pegs": si el rango inmediato está vacío, se busca el dibujo
    // anterior o siguiente más lejano con contenido.
    const nearest = [...usedFrames].sort((a, b) =>
      side === "previous" ? b - a : a - b,
    )[0];
    const emptyNearby =
      usedFrames.size === 0 ||
      Math.abs(nearest - context.currentFrame) > max;

    if (!emptyNearby) return;

    for (let distance = max + 1; distance < context.totalFrames; distance += 1) {
      const frame = context.currentFrame + direction * distance;
      if (frame < 0 || frame >= context.totalFrames) continue;
      const imageId = context.imageIdAt(frame);
      if (!imageId) continue;
      entries.push({
        frame,
        side,
        tint,
        opacity: Math.min(0.35, opacityAtDistance(opacities, max + 1) * 0.8),
        distance,
        imageId,
        instanceId: context.instanceIdAt?.(frame) ?? null,
        outOfPegs: true,
      });
      break;
    }
  };

  collect("previous");
  collect("next");

  // De más lejano a más cercano: el render apila y el vecino queda arriba.
  return entries.sort((a, b) => b.distance - a.distance);
}

/** Cambia la opacidad de un cuadro de la Light Table. */
export function setFrameOpacity(
  settings: LightTableSettings,
  side: LightTableSide,
  distance: number,
  opacity: number,
): LightTableSettings {
  const clamped = Math.min(1, Math.max(0, opacity));
  const key = side === "previous" ? "previousOpacity" : "nextOpacity";
  const values = [...settings[key]];
  while (values.length < distance) values.push(0.1);
  values[distance - 1] = clamped;
  return { ...settings, [key]: values };
}

/** Activa o desactiva un cuadro de la Light Table (opacidad 0 = apagado). */
export function toggleFrame(
  settings: LightTableSettings,
  side: LightTableSide,
  distance: number,
): LightTableSettings {
  const key = side === "previous" ? "previousOpacity" : "nextOpacity";
  const values = [...settings[key]];
  const current = values[distance - 1] ?? 0;
  return setFrameOpacity(settings, side, distance, current > 0 ? 0 : 0.45);
}
