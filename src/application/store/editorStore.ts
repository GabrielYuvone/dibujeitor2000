/**
 * Estado del editor (edición TVPaint-like).
 *
 * El store es la única puerta de entrada a los datos: la interfaz nunca
 * muta el proyecto directamente, siempre pide una acción. Eso hace que el
 * historial (undo/redo) sea trivial y que el dominio siga siendo puro.
 */

import { create } from "zustand";

import {
  type BrushKind,
  type BrushSettings,
  type MainTool,
  type Stroke,
} from "@/domain/brush/types";
import { createId } from "@/domain/brush/stroke";
import { createBrushMemory, mergeBrushSettings, settingsForBrush } from "@/domain/brush/brushes";
import {
  defaultLightTableSettings,
  type LightTableSettings,
  type LightTableSide,
} from "@/domain/lighttable/lightTable";
import { createProject } from "@/domain/project/factory";
import { resizeProject } from "@/domain/project/resize";
import type { ClipImage, Layer, Project } from "@/domain/project/model";
import {
  addEmptyExposure,
  addExposures,
  deleteInstance,
  duplicateInstance,
  frameToInstanceIndex,
  insertEmptyInstance,
  layerDuration,
  moveInstance,
  projectDuration,
  repeatExposure,
  repeatHold,
  setExposures,
  splitInstance,
} from "@/domain/timeline/instances";
import {
  canRedo,
  canUndo,
  createHistory,
  pushHistory,
  redoHistory,
  undoHistory,
  type History,
} from "@/domain/undo/history";

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EditorState {
  project: Project;
  /** Cuadro actual del playhead (índice global del proyecto). */
  currentFrame: number;
  history: History<Project>;

  /** Herramienta activa del Main Panel. */
  mainTool: MainTool;
  /** Pincel activo del Tool Panel. */
  brushKind: BrushKind;
  /** Parámetros del pincel activo. */
  brushSettings: BrushSettings;
  /** Ajustes recordados de cada pincel (cada uno conserva los suyos). */
  brushMemory: Record<BrushKind, BrushSettings>;
  /** Colores A y B del Color Panel (N las intercambia). */
  colorA: string;
  colorB: string;

  lightTable: LightTableSettings;
  /** Suavizado global de línea (icono del Main Panel). */
  lineSmoothing: boolean;
  smoothingAmount: number;
  /** Textura de papel. */
  papers: boolean;
  /**-plantilla de recortes. */
  stencilEnabled: boolean;
  showGuides: boolean;

  /** Selección rectangular activa. */
  selection: SelectionRect | null;
  /** Portapapeles (trazos copiados). */
  clipboard: Stroke[] | null;

  playing: boolean;
  zoom: number;
  pan: { x: number; y: number };
  fitToScreen: boolean;
  /** Mensaje breve en la barra de información. */
  status: string;
  dirty: boolean;
}

export interface EditorActions {
  newProject: (options?: { name?: string; width?: number; height?: number; fps?: number }) => void;
  loadProject: (project: Project) => void;
  renameProject: (name: string) => void;
  resizeCanvas: (
    width: number,
    height: number,
    options?: { scaleContent?: boolean; keepAspectRatio?: boolean },
  ) => void;
  setStatus: (status: string) => void;

  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  setMainTool: (tool: MainTool) => void;
  setBrushKind: (kind: BrushKind) => void;
  setBrushSettings: (settings: Partial<BrushSettings>) => void;
  setColorA: (color: string) => void;
  setColorB: (color: string) => void;
  swapColors: () => void;

  setCurrentFrame: (frame: number) => void;
  nextFrame: () => void;
  prevFrame: () => void;
  firstFrame: () => void;
  lastFrame: () => void;

  addStroke: (stroke: Stroke) => void;
  replaceCurrentStrokes: (strokes: Stroke[]) => void;
  clearCurrentImage: () => void;
  deleteCurrentImage: () => void;
  setSelection: (selection: SelectionRect | null) => void;
  copySelection: () => void;
  pasteClipboard: () => void;

  addInstance: () => void;
  addExposure: () => void;
  insertEmptyInstance: () => void;
  duplicateCurrentInstance: () => void;
  deleteCurrentInstance: () => void;
  splitCurrentInstance: () => void;
  setCurrentInstanceExposures: (exposures: number) => void;
  repeatHoldFrames: (count: number) => void;
  repeatExposureFrames: (count: number) => void;
  moveCurrentInstance: (delta: number) => void;

  addLayer: (name?: string) => void;
  deleteLayer: (id: string) => void;
  renameLayer: (id: string, name: string) => void;
  setCurrentLayer: (id: string) => void;
  toggleLayerVisible: (id: string) => void;
  toggleLayerLocked: (id: string) => void;
  toggleLayerLightTable: (id: string) => void;
  setLayerOpacity: (id: string, opacity: number) => void;
  moveLayer: (id: string, delta: number) => void;

  updateLightTable: (settings: Partial<LightTableSettings>) => void;
  toggleLightTableFrame: (side: LightTableSide, distance: number) => void;

  setPlaying: (playing: boolean) => void;
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  setFitToScreen: (fit: boolean) => void;
  toggleLineSmoothing: () => void;
  togglePapers: () => void;
  toggleStencil: () => void;
  toggleGuides: () => void;
}

export type EditorStore = EditorState & EditorActions;

function cloneProject(project: Project): Project {
  return {
    ...project,
    settings: { ...project.settings },
    layers: project.layers.map((layer) => ({
      ...layer,
      instances: layer.instances.map((instance) => ({ ...instance })),
    })),
    images: Object.fromEntries(
      Object.entries(project.images).map(([id, image]) => [id, { ...image, strokes: [...image.strokes] }]),
    ),
    camera: { ...project.camera },
  };
}

function withLayer(project: Project, layerId: string, update: (layer: Layer) => Layer): Project {
  return {
    ...project,
    layers: project.layers.map((layer) => (layer.id === layerId ? update(layer) : layer)),
  };
}

const initialProject = createProject();

export const useEditorStore = create<EditorStore>((set, get) => {
  /** Aplica un cambio al proyecto guardando una instantánea en el historial. */
  const commit = (update: (project: Project) => Project) => {
    const { project, history } = get();
    const next = update(project);
    if (next === project) return;
    set({
      project: { ...next, updatedAt: Date.now() },
      history: pushHistory(history, cloneProject(project)),
      dirty: true,
    });
  };

  /** Cambia el proyecto sin guardar historial (cambios de vista/selección). */
  const silent = (update: (project: Project) => Project) => {
    const next = update(get().project);
    if (next === get().project) return;
    set({ project: next });
  };

  const currentLayerOf = (state: EditorState): Layer | undefined =>
    state.project.layers.find((layer) => layer.id === state.project.currentLayerId);

  return {
    project: initialProject,
    currentFrame: 0,
    history: createHistory<Project>(),

    mainTool: "stroke",
    brushKind: "pen",
    brushSettings: settingsForBrush("pen"),
    brushMemory: createBrushMemory(),
    colorA: "#000000",
    colorB: "#ffffff",

    lightTable: defaultLightTableSettings(),
    lineSmoothing: false,
    smoothingAmount: 0.5,
    papers: false,
    stencilEnabled: false,
    showGuides: false,

    selection: null,
    clipboard: null,

    playing: false,
    zoom: 1,
    pan: { x: 0, y: 0 },
    fitToScreen: true,
    status: "Listo",
    dirty: false,

    newProject: (options) => {
      set({
        project: createProject(options),
        currentFrame: 0,
        history: createHistory<Project>(),
        selection: null,
        clipboard: null,
        dirty: false,
        status: "Proyecto nuevo",
      });
    },

    loadProject: (project) => {
      set({
        project,
        currentFrame: 0,
        history: createHistory<Project>(),
        dirty: false,
        status: `Proyecto "${project.name}" cargado`,
      });
    },

    renameProject: (name) => {
      silent((project) => ({ ...project, name }));
    },

    resizeCanvas: (width, height, options = {}) => {
      commit((project) =>
        resizeProject(project, {
          width,
          height,
          scaleContent: options.scaleContent ?? false,
          keepAspectRatio: options.keepAspectRatio ?? false,
        }),
      );
      set({ status: `Lienzo: ${width}×${height} px` });
    },

    setStatus: (status) => set({ status }),

    undo: () => {
      const { history, project } = get();
      const result = undoHistory(history, cloneProject(project));
      if (!result) return;
      set({ project: result.snapshot, history: result.history, dirty: true, status: "Deshacer" });
    },

    redo: () => {
      const { history, project } = get();
      const result = redoHistory(history, cloneProject(project));
      if (!result) return;
      set({ project: result.snapshot, history: result.history, dirty: true, status: "Rehacer" });
    },

    canUndo: () => canUndo(get().history),
    canRedo: () => canRedo(get().history),

    setMainTool: (tool) => {
      // La goma es un pincel: sólo afecta al trazo libre. Si se elige una
      // forma con la goma activa, se vuelve a la pluma para que la forma no
      // termine borrando el dibujo.
      if (tool !== "stroke" && get().brushKind === "eraser") {
        const memory = get().brushMemory;
        set({
          mainTool: tool,
          brushKind: "pen",
          brushSettings: memory.pen,
          status: "La goma se aplica al Trazo libre; las formas usan la Pluma",
        });
        return;
      }
      set({ mainTool: tool });
    },

    setBrushKind: (kind) => {
      const memory = get().brushMemory;
      const settings = memory[kind] ?? settingsForBrush(kind);
      // La goma es un pincel de trazo libre: al elegirla se pasa al Trazo
      // para que el usuario pueda borrar de inmediato.
      if (kind === "eraser" && get().mainTool !== "stroke") {
        set({
          brushKind: kind,
          brushSettings: settings,
          mainTool: "stroke",
          status: "Goma activa: trazo libre para borrar",
        });
        return;
      }
      set({ brushKind: kind, brushSettings: settings });
    },

    setBrushSettings: (settings) => {
      const state = get();
      const merged = mergeBrushSettings(state.brushKind, state.brushSettings, settings);
      set({
        brushSettings: merged,
        brushMemory: { ...state.brushMemory, [state.brushKind]: merged },
      });
    },

    setColorA: (color) => set({ colorA: color }),
    setColorB: (color) => set({ colorB: color }),

    swapColors: () => {
      const { colorA, colorB } = get();
      set({ colorA: colorB, colorB: colorA, status: "Colores A/B intercambiados" });
    },

    setCurrentFrame: (frame) => {
      const total = Math.max(1, projectDuration(get().project.layers));
      set({ currentFrame: Math.max(0, Math.min(total - 1, Math.round(frame))) });
    },

    nextFrame: () => {
      const total = Math.max(1, projectDuration(get().project.layers));
      set({ currentFrame: Math.min(total - 1, get().currentFrame + 1) });
    },

    prevFrame: () => set({ currentFrame: Math.max(0, get().currentFrame - 1) }),
    firstFrame: () => set({ currentFrame: 0 }),
    lastFrame: () => {
      const total = Math.max(1, projectDuration(get().project.layers));
      set({ currentFrame: total - 1 });
    },

    addStroke: (stroke) => {
      const state = get();
      const layer = currentLayerOf(state);
      if (!layer || layer.locked) return;

      const frame = state.currentFrame;
      const instanceIndex = frameToInstanceIndex(layer, frame);
      const instance = layer.instances[instanceIndex];
      if (!instance) return;

      commit((project) => {
        const images = { ...project.images };
        let headImageId = instance.headImageId;

        if (!headImageId) {
          headImageId = createId("img");
          images[headImageId] = { id: headImageId, strokes: [stroke], createdAt: Date.now() };
        } else {
          const image = images[headImageId];
          if (!image) return project;
          images[headImageId] = { ...image, strokes: [...image.strokes, stroke] };
        }

        const layers = project.layers.map((projectLayer) => {
          if (projectLayer.id !== layer.id) return projectLayer;
          const instances = projectLayer.instances.map((projectInstance, index) =>
            index === instanceIndex ? { ...projectInstance, headImageId } : projectInstance,
          );
          return { ...projectLayer, instances };
        });

        return { ...project, layers, images };
      });
    },

    replaceCurrentStrokes: (strokes) => {
      const state = get();
      const layer = currentLayerOf(state);
      if (!layer) return;
      const instanceIndex = frameToInstanceIndex(layer, state.currentFrame);
      const headImageId = layer.instances[instanceIndex]?.headImageId;
      if (!headImageId) return;

      commit((project) => {
        const image = project.images[headImageId];
        if (!image) return project;
        return {
          ...project,
          images: { ...project.images, [headImageId]: { ...image, strokes } },
        };
      });
    },

    clearCurrentImage: () => {
      const state = get();
      const layer = currentLayerOf(state);
      if (!layer) return;
      const instanceIndex = frameToInstanceIndex(layer, state.currentFrame);
      const headImageId = layer.instances[instanceIndex]?.headImageId;
      if (!headImageId) return;

      commit((project) => {
        const image = project.images[headImageId];
        if (!image) return project;
        return {
          ...project,
          images: { ...project.images, [headImageId]: { ...image, strokes: [] } },
        };
      });
    },

    deleteCurrentImage: () => {
      const state = get();
      const layer = currentLayerOf(state);
      if (!layer) return;
      const instanceIndex = frameToInstanceIndex(layer, state.currentFrame);
      const headImageId = layer.instances[instanceIndex]?.headImageId;
      if (!headImageId) return;

      commit((project) => {
        const images = { ...project.images };
        delete images[headImageId];
        const layers = project.layers.map((projectLayer) => {
          if (projectLayer.id !== layer.id) return projectLayer;
          const instances = projectLayer.instances.map((projectInstance, index) =>
            index === instanceIndex ? { ...projectInstance, headImageId: null } : projectInstance,
          );
          return { ...projectLayer, instances };
        });
        return { ...project, layers, images };
      });
    },

    setSelection: (selection) => set({ selection }),

    copySelection: () => {
      const state = get();
      const layer = currentLayerOf(state);
      const selection = state.selection;
      if (!layer || !selection) return;
      const instanceIndex = frameToInstanceIndex(layer, state.currentFrame);
      const headImageId = layer.instances[instanceIndex]?.headImageId;
      const image = headImageId ? state.project.images[headImageId] : undefined;
      if (!image) return;

      const copied = image.strokes.filter((stroke) =>
        stroke.points.some(
          (point) =>
            point.x >= selection.x &&
            point.x <= selection.x + selection.width &&
            point.y >= selection.y &&
            point.y <= selection.y + selection.height,
        ),
      );
      set({ clipboard: copied, status: `${copied.length} trazo(s) copiado(s)` });
    },

    pasteClipboard: () => {
      const state = get();
      const clipboard = state.clipboard;
      if (!clipboard || clipboard.length === 0) return;
      const offset = 12;
      const strokes = clipboard.map((stroke) => ({
        ...stroke,
        id: createId("stroke"),
        points: stroke.points.map((point) => ({ ...point, x: point.x + offset, y: point.y + offset })),
      }));
      strokes.forEach((stroke) => get().addStroke(stroke));
      set({ status: `${strokes.length} trazo(s) pegado(s)` });
    },

    addInstance: () => {
      const state = get();
      const layer = currentLayerOf(state);
      if (!layer) return;
      const instanceIndex = frameToInstanceIndex(layer, state.currentFrame);

      commit((project) =>
        withLayer(project, layer.id, (projectLayer) => {
          const instances = [...projectLayer.instances];
          instances.splice(instanceIndex + 1, 0, {
            id: createId("inst"),
            headImageId: null,
            exposures: 0,
          });
          return { ...projectLayer, instances };
        }),
      );
      set({ currentFrame: Math.min(projectDuration(get().project.layers) - 1, state.currentFrame + 1) });
    },

    addExposure: () => {
      const state = get();
      const layer = currentLayerOf(state);
      if (!layer) return;
      const instanceIndex = frameToInstanceIndex(layer, state.currentFrame);
      commit((project) =>
        withLayer(project, layer.id, (projectLayer) =>
          addExposures(projectLayer, instanceIndex, 1),
        ),
      );
    },

    insertEmptyInstance: () => {
      const state = get();
      const layer = currentLayerOf(state);
      if (!layer) return;
      const instanceIndex = frameToInstanceIndex(layer, state.currentFrame);
      commit((project) =>
        withLayer(project, layer.id, (projectLayer) =>
          insertEmptyInstance(projectLayer, instanceIndex + 1, createId("inst")),
        ),
      );
    },

    duplicateCurrentInstance: () => {
      const state = get();
      const layer = currentLayerOf(state);
      if (!layer) return;
      const instanceIndex = frameToInstanceIndex(layer, state.currentFrame);
      commit((project) =>
        withLayer(project, layer.id, (projectLayer) =>
          duplicateInstance(projectLayer, instanceIndex, createId("inst")),
        ),
      );
    },

    deleteCurrentInstance: () => {
      const state = get();
      const layer = currentLayerOf(state);
      if (!layer || layer.instances.length <= 1) return;
      const instanceIndex = frameToInstanceIndex(layer, state.currentFrame);
      commit((project) =>
        withLayer(project, layer.id, (projectLayer) => deleteInstance(projectLayer, instanceIndex)),
      );
    },

    splitCurrentInstance: () => {
      const state = get();
      const layer = currentLayerOf(state);
      if (!layer) return;
      const instanceIndex = frameToInstanceIndex(layer, state.currentFrame);
      const offset = state.currentFrame - instanceStartOf(layer, instanceIndex);
      if (offset <= 0) return;
      commit((project) =>
        withLayer(project, layer.id, (projectLayer) =>
          splitInstance(projectLayer, instanceIndex, offset, createId("inst")),
        ),
      );
    },

    setCurrentInstanceExposures: (exposures) => {
      const state = get();
      const layer = currentLayerOf(state);
      if (!layer) return;
      const instanceIndex = frameToInstanceIndex(layer, state.currentFrame);
      commit((project) =>
        withLayer(project, layer.id, (projectLayer) =>
          setExposures(projectLayer, instanceIndex, exposures),
        ),
      );
    },

    repeatHoldFrames: (count) => {
      const state = get();
      const layer = currentLayerOf(state);
      if (!layer) return;
      commit((project) =>
        withLayer(project, layer.id, (projectLayer) =>
          repeatHold(projectLayer, count, () => createId("inst")),
        ),
      );
    },

    repeatExposureFrames: (count) => {
      const state = get();
      const layer = currentLayerOf(state);
      if (!layer) return;
      commit((project) =>
        withLayer(project, layer.id, (projectLayer) => repeatExposure(projectLayer, count)),
      );
    },

    moveCurrentInstance: (delta) => {
      const state = get();
      const layer = currentLayerOf(state);
      if (!layer) return;
      const instanceIndex = frameToInstanceIndex(layer, state.currentFrame);
      commit((project) =>
        withLayer(project, layer.id, (projectLayer) =>
          moveInstance(projectLayer, instanceIndex, instanceIndex + delta),
        ),
      );
    },

    addLayer: (name) => {
      const state = get();
      const layerId = createId("layer");
      const color = ["#4a9eff", "#f2a33c", "#57c98a", "#e0629b"][state.project.layers.length % 4];
      commit((project) => {
        const layer: Layer = {
          id: layerId,
          name: name ?? `Capa ${project.layers.length + 1}`,
          kind: "animation",
          color,
          instances: [{ id: createId("inst"), headImageId: null, exposures: 0 }],
          visible: true,
          locked: false,
          opacity: 1,
          lightTable: true,
          loop: false,
        };
        return { ...project, layers: [...project.layers, layer], currentLayerId: layerId };
      });
    },

    deleteLayer: (id) => {
      const state = get();
      if (state.project.layers.length <= 1) return;
      commit((project) => {
        const layers = project.layers.filter((layer) => layer.id !== id);
        return {
          ...project,
          layers,
          currentLayerId:
            project.currentLayerId === id ? (layers[layers.length - 1]?.id ?? "") : project.currentLayerId,
        };
      });
    },

    renameLayer: (id, name) => {
      commit((project) =>
        withLayer(project, id, (layer) => ({ ...layer, name })),
      );
    },

    setCurrentLayer: (id) => silent((project) => ({ ...project, currentLayerId: id })),

    toggleLayerVisible: (id) =>
      commit((project) => withLayer(project, id, (layer) => ({ ...layer, visible: !layer.visible }))),

    toggleLayerLocked: (id) =>
      commit((project) => withLayer(project, id, (layer) => ({ ...layer, locked: !layer.locked }))),

    toggleLayerLightTable: (id) =>
      commit((project) => withLayer(project, id, (layer) => ({ ...layer, lightTable: !layer.lightTable }))),

    setLayerOpacity: (id, opacity) =>
      commit((project) =>
        withLayer(project, id, (layer) => ({ ...layer, opacity: Math.max(0, Math.min(1, opacity)) })),
      ),

    moveLayer: (id, delta) =>
      commit((project) => {
        const index = project.layers.findIndex((layer) => layer.id === id);
        const target = index + delta;
        if (index < 0 || target < 0 || target >= project.layers.length) return project;
        const layers = [...project.layers];
        const [moved] = layers.splice(index, 1);
        layers.splice(target, 0, moved);
        return { ...project, layers };
      }),

    updateLightTable: (settings) =>
      set({ lightTable: { ...get().lightTable, ...settings } }),

    toggleLightTableFrame: (side, distance) => {
      const { lightTable } = get();
      const key = side === "previous" ? "previousOpacity" : "nextOpacity";
      const values = [...lightTable[key]];
      const current = values[distance - 1] ?? 0;
      const next = [...values];
      while (next.length < distance) next.push(0.1);
      next[distance - 1] = current > 0 ? 0 : 0.45;
      set({ lightTable: { ...lightTable, [key]: next } });
    },

    setPlaying: (playing) => set({ playing }),
    setZoom: (zoom) => set({ zoom: Math.max(0.05, Math.min(16, zoom)), fitToScreen: false }),
    setPan: (pan) => set({ pan, fitToScreen: false }),
    setFitToScreen: (fit) => set({ fitToScreen: fit, pan: { x: 0, y: 0 } }),

    toggleLineSmoothing: () => set({ lineSmoothing: !get().lineSmoothing }),
    togglePapers: () => set({ papers: !get().papers }),
    toggleStencil: () => set({ stencilEnabled: !get().stencilEnabled }),
    toggleGuides: () => set({ showGuides: !get().showGuides }),
  };
});

/* --- Ganchos de depuración (sólo en desarrollo) --- */
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as Record<string, unknown>).__dibujeitor = useEditorStore;
}

/** Cuadro inicial de una instancia dentro de su capa. */
function instanceStartOf(layer: Layer, instanceIndex: number): number {
  let cursor = 0;
  for (let index = 0; index < instanceIndex; index += 1) {
    const instance = layer.instances[index];
    cursor += 1 + (instance?.exposures ?? 0);
  }
  return cursor;
}

/* --- Selectores derivados --- */

export function selectCurrentLayer(state: EditorState): Layer | undefined {
  return state.project.layers.find((layer) => layer.id === state.project.currentLayerId);
}

export function selectCurrentImage(state: EditorState): ClipImage | undefined {
  const layer = selectCurrentLayer(state);
  if (!layer) return undefined;
  const instanceIndex = frameToInstanceIndex(layer, state.currentFrame);
  const headImageId = layer.instances[instanceIndex]?.headImageId;
  return headImageId ? state.project.images[headImageId] : undefined;
}

export function selectTotalFrames(state: EditorState): number {
  return Math.max(1, projectDuration(state.project.layers));
}

export function selectLayerDuration(layer: Layer): number {
  return layerDuration(layer);
}
