/**
 * Fábrica de proyectos.
 *
 * Un proyecto nuevo de TVPaint trae una sola capa de animación con una
 * instancia vacía: el animador posa sobre ella.
 */

import { LAYER_COLORS, createCamera, type Layer, type Project } from "@/domain/project/model";
import { createId } from "@/domain/brush/stroke";

export interface NewProjectOptions {
  name?: string;
  width?: number;
  height?: number;
  fps?: number;
  backgroundColor?: string;
}

export function createLayer(name: string, kind: Layer["kind"] = "animation"): Layer {
  return {
    id: createId("layer"),
    name,
    kind,
    color: LAYER_COLORS[0],
    instances: [{ id: createId("inst"), headImageId: null, exposures: 0 }],
    visible: true,
    locked: false,
    opacity: 1,
    lightTable: true,
    loop: false,
  };
}

export function createProject(options: NewProjectOptions = {}): Project {
  const now = Date.now();
  const layer = createLayer("Capa 1");
  return {
    id: createId("proj"),
    name: options.name ?? "Proyecto sin título",
    createdAt: now,
    updatedAt: now,
    settings: {
      width: options.width ?? 1280,
      height: options.height ?? 720,
      fps: options.fps ?? 12,
      backgroundColor: options.backgroundColor ?? "#ffffff",
      paperColor: "#f4f1ea",
    },
    layers: [layer],
    images: {},
    audio: [],
    currentLayerId: layer.id,
    camera: createCamera(),
  };
}
