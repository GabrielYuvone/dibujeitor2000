/**
 * Geometría de las formas del Main Panel.
 *
 * TVPaint tiene herramientas separadas para líneas, rectángulos, círculos y
 * splines. Todas se reducen a una polilínea de puntos, que es lo que el
 * motor de trazos sabe dibujar.
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Genera la polilínea de las formas a partir de dos puntos arrastrados.
 *
 * Es la operación que usan las herramientas Línea, Rectángulo y Elipse del
 * Main Panel: el usuario arrastra y la forma se define entre el punto de
 * inicio y el punto actual del puntero.
 */
export function buildShapePoints(
  shape: "line" | "rectangle" | "ellipse" | "spline",
  start: Point2D,
  end: Point2D,
): Point2D[] {
  switch (shape) {
    case "line":
      return linePoints(start, end);

    case "rectangle":
      return rectanglePoints(normalizeRect(start, end));

    case "ellipse": {
      const rx = Math.abs(end.x - start.x) / 2;
      const ry = Math.abs(end.y - start.y) / 2;
      const cx = (start.x + end.x) / 2;
      const cy = (start.y + end.y) / 2;
      const steps = Math.max(16, Math.round((rx + ry) / 2));
      const points: Point2D[] = [];
      for (let i = 0; i <= steps; i += 1) {
        const angle = (i / steps) * Math.PI * 2;
        points.push({ x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry });
      }
      return points;
    }

    case "spline":
      return splinePoints([start, end], false, 8);

    default:
      return linePoints(start, end);
  }
}

export function normalizeRect(a: Point2D, b: Point2D): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

export function isPointInRect(point: Point2D, rect: Rect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

/** Línea recta entre dos puntos. */
export function linePoints(from: Point2D, to: Point2D): Point2D[] {
  return [{ x: from.x, y: from.y }, { x: to.x, y: to.y }];
}

/** Contorno de un rectángulo (o su diagonal en modo corte). */
export function rectanglePoints(rect: Rect): Point2D[] {
  const { x, y, width, height } = rect;
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
    { x, y },
  ];
}

/** Elipse (o círculo si `ry` es igual a `rx`). */
export function ellipsePoints(
  center: Point2D,
  rx: number,
  ry: number,
  steps = 48,
  startAngle = 0,
  endAngle = Math.PI * 2,
): Point2D[] {
  const points: Point2D[] = [];
  const span = endAngle - startAngle;
  const count = Math.max(2, Math.round((steps * Math.abs(span)) / (Math.PI * 2)));
  for (let i = 0; i <= count; i += 1) {
    const angle = startAngle + (span * i) / count;
    points.push({
      x: center.x + Math.cos(angle) * rx,
      y: center.y + Math.sin(angle) * ry,
    });
  }
  return points;
}

/**
 * Spline (curva suave) que pasa por los puntos de control.
 *
 * Se usa Catmull-Rom convertido a Bézier: es estable, pasa exactamente por los
 * controles y no necesita subdividedores como el motor de Canvas.
 */
export function splinePoints(
  controls: Point2D[],
  closed = false,
  stepsPerSegment = 12,
): Point2D[] {
  if (controls.length < 2) return controls.map((point) => ({ ...point }));
  if (controls.length === 2) return closed ? [...controls, { ...controls[0] }] : linePoints(controls[0], controls[1]);

  const points: Point2D[] = [];
  const segmentCount = closed ? controls.length : controls.length - 1;

  for (let i = 0; i < segmentCount; i += 1) {
    const p0 = controls[(i - 1 + controls.length) % controls.length];
    const p1 = controls[i % controls.length];
    const p2 = controls[(i + 1) % controls.length];
    const p3 = controls[(i + 2) % controls.length];

    for (let step = 0; step < stepsPerSegment; step += 1) {
      const t = step / stepsPerSegment;
      points.push(catmullRomPoint(p0, p1, p2, p3, t));
    }
  }

  points.push({ ...controls[(controls.length - 1) % controls.length] });
  return points;
}

function catmullRomPoint(p0: Point2D, p1: Point2D, p2: Point2D, p3: Point2D, t: number): Point2D {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x:
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y:
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

/** Polígono regular de `sides` lados Useful para fondos y referencias. */
export function polygonPoints(center: Point2D, radius: number, sides: number): Point2D[] {
  const points: Point2D[] = [];
  for (let i = 0; i < sides; i += 1) {
    const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
    points.push({
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    });
  }
  return points;
}
