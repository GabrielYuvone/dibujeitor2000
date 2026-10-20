import { clamp } from "../color/hex";
import { createRng } from "./rng";
import { resampleByDistance } from "./stabilize";
import type { BrushSettings, CompositeMode, Dab, StrokePoint, ToolId } from "./types";

export interface DabInput {
  tool: ToolId;
  points: StrokePoint[];
  settings: BrushSettings;
  seed: number;
}

/** Modo de composición con el que se aplica cada herramienta. */
export function compositeForTool(tool: ToolId): CompositeMode {
  if (tool === "eraser") return "destination-out";
  if (tool === "watercolor") return "multiply";
  return "source-over";
}

function pressureScale(settings: BrushSettings, pressure: number): number {
  if (!settings.pressureEnabled) return 1;
  const min = clamp(settings.minSizePressure, 0, 1);
  return min + (1 - min) * clamp(pressure, 0, 1);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Lápiz: textura de mina de grafito, dabs con jitter y opacidad reducida. */
function buildPencilDabs(points: StrokePoint[], settings: BrushSettings, seed: number): Dab[] {
  const rng = createRng(seed);
  const samples = resampleByDistance(points, Math.max(0.6, settings.size * 0.12));
  const dabs: Dab[] = [];

  for (const sample of samples) {
    const jitterAngle = rng.next() * Math.PI * 2;
    const jitterRadius = rng.next() * settings.size * 0.35;
    const radius = (settings.size / 2) * (0.55 + rng.next() * 0.9) * pressureScale(settings, sample.pressure);
    dabs.push({
      x: sample.x + Math.cos(jitterAngle) * jitterRadius,
      y: sample.y + Math.sin(jitterAngle) * jitterRadius,
      radius: Math.max(0.2, radius),
      aspect: 1,
      angle: jitterAngle,
      alpha: settings.opacity * 0.5,
      shape: "square",
      color: settings.color,
    });
  }

  return dabs;
}

/** Pincel: trazo suave y redondo, con ancho por presión opcional. */
function buildBrushDabs(points: StrokePoint[], settings: BrushSettings, seed: number): Dab[] {
  const rng = createRng(seed);
  const samples = resampleByDistance(points, Math.max(0.8, settings.size * 0.15));
  const dabs: Dab[] = [];

  for (const sample of samples) {
    const radius = (settings.size / 2) * pressureScale(settings, sample.pressure);
    dabs.push({
      x: sample.x,
      y: sample.y,
      radius: Math.max(0.25, radius),
      aspect: 1,
      angle: 0,
      alpha: settings.opacity,
      shape: "round",
      color: settings.color,
    });
  }

  return dabs;
}

/**
 * Pluma de tinta: flujo irregular (ancho variable), salpicaduras y blobs.
 */
function buildInkDabs(points: StrokePoint[], settings: BrushSettings, seed: number): Dab[] {
  const rng = createRng(seed);
  const samples = resampleByDistance(points, Math.max(1, settings.size * 0.18));
  const dabs: Dab[] = [];
  let inkLoad = 1;

  for (const sample of samples) {
    inkLoad = clamp(inkLoad - rng.next() * 0.02, 0.35, 1);
    const pressure = pressureScale(settings, sample.pressure);
    const flow = 0.75 + rng.next() * 0.5;
    const squeeze = rng.next() < 0.12 ? 0.55 : 1;
    const radius = Math.max(0.25, (settings.size / 2) * pressure * flow * squeeze * inkLoad);

    dabs.push({
      x: sample.x,
      y: sample.y,
      radius,
      aspect: 1,
      angle: 0,
      alpha: settings.opacity * clamp(inkLoad, 0, 1),
      shape: "round",
      color: settings.color,
    });

    // Salpicaduras: gotas de tinta que escapan del trazo.
    if (rng.next() < 0.06) {
      const angle = rng.next() * Math.PI * 2;
      const distance = settings.size * (0.4 + rng.next() * 1.4);
      dabs.push({
        x: sample.x + Math.cos(angle) * distance,
        y: sample.y + Math.sin(angle) * distance,
        radius: Math.max(0.15, settings.size * (0.05 + rng.next() * 0.12)),
        aspect: 1,
        angle: 0,
        alpha: settings.opacity * 0.45,
        shape: "round",
        color: settings.color,
      });
    }

    // Blobs: acumulaciones de tinta.
    if (rng.next() < 0.035) {
      dabs.push({
        x: sample.x + (rng.next() - 0.5) * settings.size * 0.6,
        y: sample.y + (rng.next() - 0.5) * settings.size * 0.6,
        radius: Math.max(0.3, settings.size * (0.3 + rng.next() * 0.35)),
        aspect: 0.75 + rng.next() * 0.5,
        angle: rng.next() * Math.PI,
        alpha: settings.opacity * 0.9,
        shape: "round",
        color: settings.color,
      });
    }
  }

  return dabs;
}

/**
 * Acuarela: simula una brocha con cerdas.
 *
 * No es un círculo: cada muestra del trazo genera una fila de trazos cortos
 * perpendiculares a la dirección del pincel. Las cerdas centrales cargan más
 * pintura (más oscuras), los bordes se deshilachan y al final del trazo la
 * brocha se queda sin pintura.
 */
function buildWatercolorDabs(points: StrokePoint[], settings: BrushSettings, seed: number): Dab[] {
  const rng = createRng(seed);
  const samples = resampleByDistance(points, Math.max(1.5, settings.size * 0.22));
  const bristles = clamp(Math.round(settings.size / 2.5), 3, 24);
  const bristleSpacing = (settings.size * 0.85) / bristles;
  const bristleLength = Math.max(1.5, settings.size * 0.35);
  const dabs: Dab[] = [];

  for (let i = 0; i < samples.length; i += 1) {
    const sample = samples[i];
    const prev = samples[Math.max(0, i - 1)];
    const next = samples[Math.min(samples.length - 1, i + 1)];
    const direction = Math.atan2(next.y - prev.y, next.x - prev.x);
    const perpendicular = direction + Math.PI / 2;

    // La brocha se seca: al final del trazo queda poca pintura.
    const progress = samples.length > 1 ? i / (samples.length - 1) : 1;
    const dryness = progress > 0.82 ? clamp((1 - progress) / 0.18, 0, 1) : 1;

    for (let b = 0; b < bristles; b += 1) {
      const normalized = bristles === 1 ? 0 : (b - (bristles - 1) / 2) / ((bristles - 1) / 2);
      const offset = normalized * (settings.size * 0.42);
      const edge = Math.abs(normalized);

      // Cerdas centrales más oscuras.
      const load = 0.3 + 0.7 * Math.pow(1 - edge, 1.4);

      // Deshilachado: los bordes pierden más pintura.
      const frayChance = 0.08 + edge * 0.35;
      const frayed = rng.next() < frayChance;

      // Al final del trazo algunas cerdas se rompen (poca pintura).
      const broken = dryness < 1 && rng.next() < (1 - dryness) * 0.8;

      const alpha = settings.opacity * load * dryness * (frayed ? 0.25 : 1) * (broken ? 0 : 1);
      if (alpha <= 0.01) continue;

      dabs.push({
        x: sample.x + Math.cos(perpendicular) * offset,
        y: sample.y + Math.sin(safePerpendicular(perpendicular)) * offset,
        radius: Math.max(0.3, settings.size * 0.06),
        aspect: bristleLength / Math.max(0.3, settings.size * 0.06),
        angle: perpendicular,
        alpha,
        shape: "round",
        color: settings.color,
      });
    }
  }

  return dabs;
}

/** Goma: destination-out, con modo suave o sólido. */
function buildEraserDabs(points: StrokePoint[], settings: BrushSettings, seed: number): Dab[] {
  const rng = createRng(seed);
  const samples = resampleByDistance(points, Math.max(0.8, settings.size * 0.12));
  const alpha = settings.softEraser ? settings.opacity * (0.15 + 0.85 * clamp(settings.hardness, 0, 1)) : settings.opacity;

  return samples.map((sample) => ({
    x: sample.x,
    y: sample.y,
    radius: Math.max(0.25, (settings.size / 2) * pressureScale(settings, sample.pressure)),
    aspect: 1,
    angle: 0,
    alpha,
    shape: "round" as const,
    color: settings.color,
  }));
}

/** Normaliza el ángulo: evita NaN si algún punto llegó corrupto. */
function safePerpendicular(angle: number): number {
  return Number.isFinite(angle) ? angle : 0;
}

/**
 * Genera las gotas de un trazo. Es la función central del motor de pincel:
 * determinista para una misma semilla y parámetros.
 */
export function buildDabs({ tool, points, settings, seed }: DabInput): Dab[] {
  if (!points || points.length === 0) return [];

  switch (tool) {
    case "pencil":
      return buildPencilDabs(points, settings, seed);
    case "brush":
      return buildBrushDabs(points, settings, seed);
    case "ink":
      return buildInkDabs(points, settings, seed);
    case "watercolor":
      return buildWatercolorDabs(points, settings, seed);
    case "eraser":
      return buildEraserDabs(points, settings, seed);
    default:
      return buildBrushDabs(points, settings, seed);
  }
}
