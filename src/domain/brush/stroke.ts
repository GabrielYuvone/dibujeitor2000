import {
  DEFAULT_BRUSH_SETTINGS,
  type BrushKind,
  type BrushSettings,
  type ShapeKind,
  type Stroke,
  type StrokePoint,
  type ToolId,
} from "./types";

export interface Point2D {
  x: number;
  y: number;
}

let counter = 0;

/** Identificador estable y único dentro de la sesión. */
export function createId(prefix = "id"): string {
  counter += 1;
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}${random}`;
}

/** Crea un trazo listo para guardarse en un cuadro. */
export function createStroke(
  tool: ToolId,
  points: Point2D[],
  settings: Partial<BrushSettings> = {},
  seed = Math.floor(Math.random() * 1_000_000),
  extra: { kind?: Stroke["kind"]; brush?: BrushKind; shape?: ShapeKind; filled?: boolean } = {},
): Stroke {
  const strokePoints: StrokePoint[] = points.map((point, index) => ({
    x: point.x,
    y: point.y,
    pressure: 0.5,
    t: index * 16,
  }));

  return {
    id: createId("stroke"),
    kind: extra.kind ?? "paint",
    tool,
    brush: extra.brush,
    shape: extra.shape,
    filled: extra.filled,
    points: strokePoints,
    settings: { ...DEFAULT_BRUSH_SETTINGS, ...settings },
    seed,
    composite: tool === "eraser" ? "destination-out" : tool === "watercolor" ? "multiply" : "source-over",
    createdAt: Date.now(),
  };
}

/** Puntos de un círculo (útil para plantillas y figuras de referencia). */
export function circlePoints(cx: number, cy: number, radius: number, steps = 24): Point2D[] {
  const points: Point2D[] = [];
  for (let i = 0; i < steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2;
    points.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius });
  }
  return points;
}
