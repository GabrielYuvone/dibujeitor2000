/**
 * Las formas viven en `@/domain/geometry/shapes` (fuente única de verdad).
 * Este archivo mantiene la ruta anterior para no romper imports.
 */

export {
  buildShapePoints,
  isPointInRect,
  linePoints,
  normalizeRect,
  rectanglePoints,
  ellipsePoints,
  splinePoints,
} from "@/domain/geometry/shapes";
export type { Point2D, Rect } from "@/domain/geometry/shapes";
