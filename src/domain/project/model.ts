/**
 * Modelo de proyecto (edición TVPaint-like).
 *
 * TVPaint no guarda "cuadros" sino *instancias*: cada instancia es un dibujo
 * (una imagen) que puede permanecer en pantalla varias unidades de tiempo
 * mediante *celdas de exposición*. Ése es el flujo de trabajo clásico de
 * animación: posar, mantener, y decidir cuánto dura cada dibujo.
 *
 *   Layer  ->  [ Instancia (cabeza + N exposiciones) , Instancia, ... ]
 *   Image  ->  la lista de trazos de un dibujo
 */

import type { Stroke } from "@/domain/brush/types";

export type LayerKind = "animation" | "background" | "camera";

/** Un dibujo: el contenido de una instancia. */
export interface ClipImage {
  id: string;
  strokes: Stroke[];
  createdAt: number;
  /** Etiqueta opcional (número de dibujo en TVPaint). */
  label?: string;
}

/** Contenedor de un dibujo con su duración en celdas de exposición. */
export interface Instance {
  id: string;
  /** Id de la imagen "cabeza"; `null` si la instancia está vacía. */
  headImageId: string | null;
  /** Número de celdas de exposición (duración = 1 + exposures). */
  exposures: number;
}

export interface Layer {
  id: string;
  name: string;
  kind: LayerKind;
  /** Color identificador de la capa en el Layer Stack. */
  color: string;
  instances: Instance[];
  visible: boolean;
  locked: boolean;
  /** Opacidad de la capa (0 - 1). */
  opacity: number;
  /** Bombilla de la Light Table activada para esta capa. */
  lightTable: boolean;
  /** Repetir la capa en bucle al reproducir. */
  loop: boolean;
}

export interface ProjectSettings {
  width: number;
  height: number;
  fps: number;
  backgroundColor: string;
  /** Color del papel (textura) de la escena. */
  paperColor: string;
}

export interface AudioClip {
  id: string;
  name: string;
  /** Cuadro inicial del clip en la línea de tiempo. */
  startFrame: number;
  /** Duración en cuadros. */
  duration: number;
  /** Blob almacenado en IndexedDB. */
  assetId: string;
  /** Volumen 0 - 1. */
  volume: number;
  /** Silenciado. */
  muted: boolean;
}

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
  rotation: number;
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  settings: ProjectSettings;
  /** Capas: el índice 0 es la capa inferior (apoyada en el fondo). */
  layers: Layer[];
  /** Pool de dibujos, indexados por id. */
  images: Record<string, ClipImage>;
  /** Pistas de audio de la línea de tiempo. */
  audio: AudioClip[];
  /** Capa activa (la única sobre la que se dibuja). */
  currentLayerId: string;
  camera: CameraState;
}

export const LAYER_COLORS = [
  "#4a9eff",
  "#f2a33c",
  "#57c98a",
  "#e0629b",
  "#a98bff",
  "#e0c341",
  "#4fc7c7",
  "#f27d4a",
];

export function createCamera(): CameraState {
  return { x: 0, y: 0, zoom: 1, rotation: 0 };
}
